import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  defineBoolean,
  defineSecret,
  defineString,
} from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  CONSENT_VERSION,
  LEAD_RETENTION_MS,
  MAX_VALIDATION_ATTEMPTS,
  SESSION_TTL_MS,
  SUBSCRIBER_TERMS_VERSION,
} from "./constants.js";
import {
  analyzePhotoWithGemini,
  describeAiFailure,
  validatePhotoWithGemini,
} from "./gemini.js";
import {
  ANALYSIS_CACHE_TTL_MS,
  analysisCacheId,
  cachedAnalysisScores,
} from "./analysisCache.js";
import {
  monthKey,
  normalizePlan,
  photoValidationLimit,
  PLANS,
  PlanTier,
} from "./plans.js";
import { pendingSubscriptionFields } from "./subscriptions.js";
import {
  accountStatusSchema,
  captureLeadSchema,
  checkoutSchema,
  imageSchema,
  leadAssignmentSchema,
  leadIdSchema,
  patientConversionActionSchema,
  professionalStatusSchema,
  profilePatchSchema,
  slugify,
  startTriageSchema,
  teamMemberSchema,
} from "./validation.js";

if (getApps().length === 0) initializeApp();

const db = getFirestore();
const auth = getAuth();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = defineString("GEMINI_MODEL", {
  default: "gemini-3.6-flash",
});
const ENFORCE_APP_CHECK = defineBoolean("ENFORCE_APP_CHECK", {
  default: true,
});

setGlobalOptions({
  region: "southamerica-east1",
  maxInstances: 5,
  concurrency: 10,
});

type SessionState =
  | "started"
  | "validating"
  | "validated"
  | "analyzing"
  | "analyzed"
  | "captured";

interface SessionRecord {
  uid: string;
  accountId: string;
  professionalId: string | null;
  slug: string;
  expiresAtMs: number;
  state: SessionState;
  photoConsent: true;
  adultAndOwnershipConfirmed: true;
  photoConsentVersion: string;
  photoConsentAtMs: number;
  validationAttempts?: number;
  validationImageHash?: string;
  validation?: {
    isAdequate: boolean;
    feedback: string;
  };
  scores?: Record<string, unknown>;
  leadId?: string;
}

interface AccountRecord {
  ownerUid: string;
  professionalId: string;
  plan: PlanTier | "elite";
  status: "pending" | "active" | "overdue" | "paused";
  slug: string;
}

interface UserRecord {
  role?: "hq" | "clinic" | "professional";
  accountId?: string;
  professionalId?: string;
  slug?: string;
  status?: string;
}

interface ParseSuccess<T> {
  success: true;
  data: T;
}

interface ParseFailure {
  success: false;
  error: {
    issues: Array<{ message: string }>;
  };
}

interface InputSchema<T> {
  safeParse(value: unknown): ParseSuccess<T> | ParseFailure;
}

function parseInput<T>(schema: InputSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpsError(
      "invalid-argument",
      result.error.issues[0]?.message ?? "Dados inválidos.",
    );
  }
  return result.data;
}

function requireUid(request: { auth?: { uid: string } }): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  return request.auth.uid;
}

async function readUser(uid: string): Promise<UserRecord> {
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists) {
    throw new HttpsError("permission-denied", "Perfil de acesso não encontrado.");
  }
  return user.data() as UserRecord;
}

async function requireHq(uid: string): Promise<void> {
  const user = await readUser(uid);
  if (user.role !== "hq") {
    throw new HttpsError("permission-denied", "Acesso restrito à administração.");
  }
}

async function requireClinicManager(uid: string): Promise<
  UserRecord & { accountId: string }
> {
  const user = await readUser(uid);
  if (user.role !== "clinic" || !user.accountId) {
    throw new HttpsError(
      "permission-denied",
      "Acesso restrito à administração da clínica.",
    );
  }
  const account = await db.doc(`accounts/${user.accountId}`).get();
  if (
    !account.exists
    || account.data()?.status !== "active"
    || normalizePlan(account.data()?.plan) !== "network"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "A gestão de equipe exige uma conta Network ativa.",
    );
  }
  return { ...user, accountId: user.accountId };
}

function validateSession(session: SessionRecord, uid: string): void {
  if (session.uid !== uid) {
    throw new HttpsError("permission-denied", "Triagem inválida.");
  }
  if (session.expiresAtMs < Date.now()) {
    throw new HttpsError(
      "deadline-exceeded",
      "Esta triagem expirou. Comece novamente.",
    );
  }
}

function imageHash(imageBase64: string): string {
  return createHash("sha256").update(imageBase64).digest("hex");
}

async function releasePhotoValidationAttempt(
  accountId: string,
  sessionId: string,
  usageMonth: string,
  digest: string,
): Promise<void> {
  const sessionRef = db.doc(`triageSessions/${sessionId}`);
  const usageRef = db.doc(`usage/${accountId}_${usageMonth}`);
  await db.runTransaction(async (transaction) => {
    const [sessionSnap, usageSnap] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(usageRef),
    ]);
    if (
      !sessionSnap.exists
      || sessionSnap.data()?.state !== "validating"
      || sessionSnap.data()?.validationImageHash !== digest
    ) {
      return;
    }
    const attempts = Number(sessionSnap.data()?.validationAttempts ?? 1);
    const validations = Number(usageSnap.data()?.photoValidations ?? 1);
    transaction.set(
      usageRef,
      {
        accountId,
        month: usageMonth,
        photoValidations: Math.max(0, validations - 1),
        updatedAtMs: Date.now(),
      },
      { merge: true },
    );
    transaction.update(sessionRef, {
      state: "started",
      validationAttempts: Math.max(0, attempts - 1),
      updatedAtMs: Date.now(),
    });
  });
}

export const startTriage = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(startTriageSchema, request.data);
    const profileSnap = await db.doc(`publicProfiles/${input.slug}`).get();
    if (!profileSnap.exists || profileSnap.data()?.active !== true) {
      throw new HttpsError("not-found", "Este link de triagem não está ativo.");
    }

    const profile = profileSnap.data() as {
      accountId: string;
      professionalId?: string | null;
      ownerType?: "dentist" | "clinic";
    };
    const accountSnap = await db.doc(`accounts/${profile.accountId}`).get();
    if (!accountSnap.exists || accountSnap.data()?.status !== "active") {
      throw new HttpsError(
        "failed-precondition",
        "A assinatura deste link está inativa.",
      );
    }

    const sessionRef = db.collection("triageSessions").doc();
    const now = Date.now();
    await sessionRef.set({
      uid,
      accountId: profile.accountId,
      professionalId:
        profile.ownerType === "clinic" ? null : profile.professionalId ?? null,
      slug: input.slug,
      state: "started",
      photoConsent: true,
      adultAndOwnershipConfirmed: true,
      photoConsentVersion: input.consentVersion,
      photoConsentAtMs: now,
      validationAttempts: 0,
      createdAtMs: now,
      updatedAtMs: now,
      expiresAtMs: now + SESSION_TTL_MS,
    });

    return {
      sessionId: sessionRef.id,
      expiresAtMs: now + SESSION_TTL_MS,
    };
  },
);

export const validateSmilePhoto = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
    consumeAppCheckToken: ENFORCE_APP_CHECK,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(imageSchema, request.data);
    const sessionRef = db.doc(`triageSessions/${input.sessionId}`);
    const digest = imageHash(input.imageBase64);
    const usageMonth = monthKey();

    const reservation = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Triagem não encontrada.");
      }
      const session = snap.data() as SessionRecord;
      validateSession(session, uid);
      if (session.state === "captured") {
        throw new HttpsError(
          "failed-precondition",
          "Esta triagem já foi concluída.",
        );
      }
      if (session.state === "validating" || session.state === "analyzing") {
        throw new HttpsError(
          "aborted",
          "Já existe uma análise em andamento. Aguarde alguns segundos.",
        );
      }
      const attempts = Number(session.validationAttempts ?? 0);
      if (attempts >= MAX_VALIDATION_ATTEMPTS) {
        throw new HttpsError(
          "resource-exhausted",
          "O limite de tentativas desta triagem foi atingido. Comece novamente.",
        );
      }
      const accountRef = db.doc(`accounts/${session.accountId}`);
      const usageRef = db.doc(`usage/${session.accountId}_${usageMonth}`);
      const [accountSnap, usageSnap] = await Promise.all([
        transaction.get(accountRef),
        transaction.get(usageRef),
      ]);
      if (!accountSnap.exists || accountSnap.data()?.status !== "active") {
        throw new HttpsError("failed-precondition", "Assinatura inativa.");
      }
      const plan = normalizePlan(accountSnap.data()?.plan);
      const completedTriages = Number(usageSnap.data()?.triages ?? 0);
      const validations = Number(usageSnap.data()?.photoValidations ?? 0);
      if (completedTriages >= PLANS[plan].monthlyLeadLimit) {
        throw new HttpsError(
          "resource-exhausted",
          "O limite mensal de triagens deste plano foi atingido.",
        );
      }
      if (validations >= photoValidationLimit(plan)) {
        throw new HttpsError(
          "resource-exhausted",
          "O limite mensal de tentativas de foto deste plano foi atingido.",
        );
      }
      transaction.set(
        usageRef,
        {
          accountId: session.accountId,
          month: usageMonth,
          photoValidations: validations + 1,
          updatedAtMs: Date.now(),
        },
        { merge: true },
      );
      transaction.update(sessionRef, {
        state: "validating",
        validationAttempts: attempts + 1,
        validationImageHash: digest,
        updatedAtMs: Date.now(),
      });
      return { accountId: session.accountId };
    });

    try {
      const validation = await validatePhotoWithGemini(
        GEMINI_API_KEY.value(),
        GEMINI_MODEL.value(),
        input.imageBase64,
        input.mimeType,
      );
      await sessionRef.update({
        validation,
        state: validation.isAdequate ? "validated" : "started",
        updatedAtMs: Date.now(),
      });
      return validation;
    } catch (error) {
      console.error("Falha de validação da imagem", describeAiFailure(error));
      await releasePhotoValidationAttempt(
        reservation.accountId,
        input.sessionId,
        usageMonth,
        digest,
      );
      throw new HttpsError(
        "internal",
        "Não foi possível validar a foto. Tente novamente.",
      );
    }
  },
);

export const analyzeSmilePhoto = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
    consumeAppCheckToken: ENFORCE_APP_CHECK,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 90,
    memory: "512MiB",
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(imageSchema, request.data);
    const sessionRef = db.doc(`triageSessions/${input.sessionId}`);
    const usageMonth = monthKey();
    const usageRefId = `${input.sessionId}_${usageMonth}`;
    const digest = imageHash(input.imageBase64);
    const cacheRef = db.doc(`analysisCache/${analysisCacheId(digest)}`);

    const reservation = await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new HttpsError("not-found", "Triagem não encontrada.");
      }
      const session = sessionSnap.data() as SessionRecord;
      validateSession(session, uid);
      if (session.scores) {
        return { existing: session.scores, cached: null, session };
      }
      if (
        session.state !== "validated"
        || session.validation?.isAdequate !== true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Valide a foto antes da análise.",
        );
      }
      if (session.validationImageHash !== digest) {
        throw new HttpsError(
          "failed-precondition",
          "A foto mudou depois da validação. Valide novamente.",
        );
      }

      const accountRef = db.doc(`accounts/${session.accountId}`);
      const usageRef = db.doc(`usage/${session.accountId}_${usageMonth}`);
      const [accountSnap, usageSnap, cacheSnap] = await Promise.all([
        transaction.get(accountRef),
        transaction.get(usageRef),
        transaction.get(cacheRef),
      ]);
      if (!accountSnap.exists) {
        throw new HttpsError("not-found", "Conta não encontrada.");
      }
      const account = accountSnap.data() as AccountRecord;
      if (account.status !== "active") {
        throw new HttpsError("failed-precondition", "Assinatura inativa.");
      }
      const plan = PLANS[normalizePlan(account.plan)];
      const used = Number(usageSnap.data()?.triages ?? 0);
      const cached = cachedAnalysisScores(cacheSnap.data());
      if (used >= plan.monthlyLeadLimit) {
        throw new HttpsError(
          "resource-exhausted",
          "O limite mensal de triagens deste plano foi atingido.",
        );
      }

      transaction.set(
        usageRef,
        {
          accountId: session.accountId,
          month: usageMonth,
          triages: used + 1,
          updatedAtMs: Date.now(),
        },
        { merge: true },
      );
      transaction.set(
        db.doc(`usageReservations/${usageRefId}`),
        {
          accountId: session.accountId,
          sessionId: input.sessionId,
          month: usageMonth,
          state: cached ? "consumed" : "reserved",
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        },
      );
      transaction.update(
        sessionRef,
        cached
          ? {
              scores: cached,
              state: "analyzed",
              analyzedAtMs: Date.now(),
              updatedAtMs: Date.now(),
            }
          : {
              state: "analyzing",
              updatedAtMs: Date.now(),
            },
      );
      return { existing: null, cached, session };
    });

    if (reservation.existing) return reservation.existing;
    if (reservation.cached) return reservation.cached;

    try {
      const scores = await analyzePhotoWithGemini(
        GEMINI_API_KEY.value(),
        GEMINI_MODEL.value(),
        input.imageBase64,
        input.mimeType,
      );
      await db.runTransaction(async (transaction) => {
        const now = Date.now();
        transaction.update(sessionRef, {
          scores,
          state: "analyzed",
          analyzedAtMs: now,
          updatedAtMs: now,
        });
        transaction.update(db.doc(`usageReservations/${usageRefId}`), {
          state: "consumed",
          updatedAtMs: now,
        });
        // Somente o resultado e o hash criptográfico são reutilizados; a imagem
        // nunca é gravada no cache.
        transaction.set(cacheRef, {
          scores,
          createdAtMs: now,
          expiresAtMs: now + ANALYSIS_CACHE_TTL_MS,
        });
      });
      return scores;
    } catch (error) {
      console.error("Falha de análise da imagem", describeAiFailure(error));
      await releaseUsageReservation(usageRefId, input.sessionId, usageMonth);
      throw new HttpsError(
        "internal",
        "Não foi possível analisar a foto. Tente novamente.",
      );
    }
  },
);

async function releaseUsageReservation(
  reservationId: string,
  sessionId: string,
  usageMonth: string,
): Promise<void> {
  const sessionRef = sessionId
    ? db.doc(`triageSessions/${sessionId}`)
    : null;
  const reservationRef = db.doc(`usageReservations/${reservationId}`);
  await db.runTransaction(async (transaction) => {
    const reservationSnap = await transaction.get(reservationRef);
    if (
      !reservationSnap.exists
      || reservationSnap.data()?.state !== "reserved"
    ) {
      return;
    }
    const reservation = reservationSnap.data();
    const accountId = String(reservation?.accountId ?? "");
    const month = String(reservation?.month ?? usageMonth);
    if (!accountId || !month) return;

    const sessionSnap = sessionRef
      ? await transaction.get(sessionRef)
      : null;
    const usageRef = db.doc(`usage/${accountId}_${month}`);
    const usageSnap = await transaction.get(usageRef);
    const used = Number(usageSnap.data()?.triages ?? 1);
    transaction.set(
      usageRef,
      {
        accountId,
        month,
        triages: Math.max(0, used - 1),
        updatedAtMs: Date.now(),
      },
      { merge: true },
    );
    if (sessionRef && sessionSnap?.exists) {
      transaction.update(sessionRef, {
        state: "validated",
        updatedAtMs: Date.now(),
      });
    }
    transaction.set(
      reservationRef,
      {
        state: "released",
        updatedAtMs: Date.now(),
      },
      { merge: true },
    );
  });
}

export const captureLead = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(captureLeadSchema, request.data);
    const sessionRef = db.doc(`triageSessions/${input.sessionId}`);

    return db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new HttpsError("not-found", "Triagem não encontrada.");
      }
      const session = sessionSnap.data() as SessionRecord;
      validateSession(session, uid);
      if (session.leadId) return { leadId: session.leadId };
      if (session.state !== "analyzed" || !session.scores) {
        throw new HttpsError(
          "failed-precondition",
          "Conclua a análise antes de continuar.",
        );
      }
      if (
        session.photoConsent !== true
        || session.adultAndOwnershipConfirmed !== true
        || session.photoConsentVersion !== CONSENT_VERSION
      ) {
        throw new HttpsError(
          "failed-precondition",
          "O consentimento da foto não foi registrado.",
        );
      }

      const leadRef = db.collection("leads").doc();
      const now = Date.now();
      const scores = session.scores as Record<string, unknown>;
      transaction.set(leadRef, {
        accountId: session.accountId,
        professionalId: session.professionalId,
        dentistId: session.professionalId,
        lead: {
          name: input.name,
          whatsapp: input.whatsapp,
          email: "",
          location: "",
        },
        scores,
        photoAdequate: true,
        matchStatus: session.professionalId ? "matched" : "idle",
        status: "new",
        source: "bio",
        intentCategory: scores.intentCategory ?? "Avaliação estética",
        recommendedSpecialty:
          scores.recommendedSpecialty ?? "Cirurgião-dentista",
        consentPatient: true,
        photoConsent: true,
        photoConsentAtMs: session.photoConsentAtMs,
        contactConsent: input.contactConsent,
        privacyConsent: input.privacyConsent,
        consentVersion: input.consentVersion,
        consentTimestamp: now,
        retentionUntilMs: now + LEAD_RETENTION_MS,
        createdAt: now,
        createdAtMs: now,
        updatedAtMs: now,
      });
      transaction.update(sessionRef, {
        leadId: leadRef.id,
        state: "captured",
        capturedAtMs: now,
        updatedAtMs: now,
      });
      return { leadId: leadRef.id };
    });
  },
);

export const recordPatientConversionAction = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(patientConversionActionSchema, request.data);
    const sessionRef = db.doc(`triageSessions/${input.sessionId}`);

    return db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new HttpsError("not-found", "Triagem não encontrada.");
      }
      const session = sessionSnap.data() as SessionRecord;
      validateSession(session, uid);
      if (!session.leadId || session.state !== "captured") {
        throw new HttpsError(
          "failed-precondition",
          "Compartilhe seu contato antes de escolher o próximo passo.",
        );
      }

      const leadRef = db.doc(`leads/${session.leadId}`);
      const leadSnap = await transaction.get(leadRef);
      if (
        !leadSnap.exists
        || leadSnap.data()?.accountId !== session.accountId
        || leadSnap.data()?.contactConsent !== true
      ) {
        throw new HttpsError(
          "permission-denied",
          "A autorização de contato não foi encontrada.",
        );
      }

      const now = Date.now();
      const lead = leadSnap.data() ?? {};
      const update: Record<string, unknown> = {
        updatedAtMs: now,
      };
      if (input.action === "contact_requested") {
        update.contactPreference = "professional_contact";
        update.contactRequestedAtMs = lead.contactRequestedAtMs ?? now;
      } else {
        update.contactPreference = "patient_whatsapp";
        update.patientOpenedWhatsAppAtMs = lead.patientOpenedWhatsAppAtMs ?? now;
      }
      transaction.update(leadRef, update);
      return { ok: true };
    });
  },
);

export const createPendingSubscription = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = requireUid(request);
    if (request.auth?.token.firebase?.sign_in_provider === "anonymous") {
      throw new HttpsError(
        "failed-precondition",
        "Crie sua conta profissional antes de continuar.",
      );
    }
    const input = parseInput(checkoutSchema, request.data);
    if (request.auth?.token.email?.toLowerCase() !== input.email) {
      throw new HttpsError(
        "permission-denied",
        "O email informado não corresponde ao login.",
      );
    }

    const plan = normalizePlan(input.plan);
    const accessRole = plan === "network" ? "clinic" : "professional";
    const now = Date.now();
    const subscription = pendingSubscriptionFields(input, now);
    const userRef = db.doc(`users/${uid}`);
    const existingUser = await userRef.get();
    if (
      existingUser.exists
      && !["professional", "clinic"].includes(existingUser.data()?.role)
    ) {
      throw new HttpsError(
        "permission-denied",
        "Este acesso não pode contratar uma assinatura profissional.",
      );
    }
    let accountId = existingUser.data()?.accountId as string | undefined;
    let professionalId = existingUser.data()?.professionalId as
      | string
      | undefined;
    let slug = existingUser.data()?.slug as string | undefined;

    if (accountId && professionalId && slug) {
      const accountRef = db.doc(`accounts/${accountId}`);
      const account = await accountRef.get();
      if (!account.exists || account.data()?.ownerUid !== uid) {
        throw new HttpsError(
          "permission-denied",
          "A conta vinculada a este email é inválida.",
        );
      }
      if (account.data()?.status === "active") {
        throw new HttpsError(
          "already-exists",
          "Esta conta já possui uma assinatura ativa.",
        );
      }
      const batch = db.batch();
      batch.set(
        userRef,
        {
          email: input.email,
          role: accessRole,
          status: "pending",
          updatedAtMs: now,
        },
        { merge: true },
      );
      batch.set(
        accountRef,
        {
          accountName: input.name,
          paymentReference: accountId,
          ...subscription,
        },
        { merge: true },
      );
      batch.set(
        db.doc(`professionals/${professionalId}`),
        {
          name: input.name,
          email: input.email,
          whatsapp: input.whatsapp,
          specialty: input.specialty,
          plan,
          isActive: false,
          updatedAtMs: now,
        },
        { merge: true },
      );
      batch.set(
        db.doc(`publicProfiles/${slug}`),
        {
          slug,
          accountId,
          professionalId,
          name: input.name,
          whatsapp: input.whatsapp,
          specialty: input.specialty,
          plan,
          ownerType: plan === "network" ? "clinic" : "dentist",
          active: false,
          updatedAtMs: now,
        },
        { merge: true },
      );
      await batch.commit();
    } else {
      accountId = `acc_${uid}`;
      professionalId = `pro_${uid}`;
      const baseSlug = slugify(input.name) || "profissional";
      slug = `${baseSlug}-${uid.slice(0, 6).toLowerCase()}`;
      const batch = db.batch();
      batch.set(userRef, {
        uid,
        email: input.email,
        role: accessRole,
        accountId,
        professionalId,
        slug,
        status: "pending",
        createdAtMs: now,
        updatedAtMs: now,
      });
      batch.set(db.doc(`accounts/${accountId}`), {
        id: accountId,
        ownerUid: uid,
        professionalId,
        slug,
        accountName: input.name,
        paymentReference: accountId,
        ...subscription,
        createdAtMs: now,
      });
      batch.set(db.doc(`professionals/${professionalId}`), {
        id: professionalId,
        accountId,
        ownerUid: uid,
        name: input.name,
        email: input.email,
        whatsapp: input.whatsapp,
        specialty: input.specialty,
        publicSlug: slug,
        plan,
        role: "dentist",
        isActive: false,
        createdAt: now,
        createdAtMs: now,
        updatedAtMs: now,
      });
      batch.set(db.doc(`publicProfiles/${slug}`), {
        slug,
        accountId,
        professionalId,
        name: input.name,
        whatsapp: input.whatsapp,
        specialty: input.specialty,
        plan,
        ownerType: plan === "network" ? "clinic" : "dentist",
        active: false,
        createdAtMs: now,
        updatedAtMs: now,
      });
      await batch.commit();
    }

    if (!accountId || !professionalId || !slug) {
      throw new HttpsError("internal", "Não foi possível preparar a conta.");
    }
    return { accountId, plan, status: "pending" as const };
  },
);

export const updateProfessionalProfile = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(profilePatchSchema, request.data);
    const user = await readUser(uid);
    if (
      !["professional", "clinic"].includes(user.role ?? "")
      || !user.accountId
      || !user.professionalId
      || !user.slug
    ) {
      throw new HttpsError(
        "permission-denied",
        "Perfil profissional não encontrado.",
      );
    }
    const accountSnap = await db.doc(`accounts/${user.accountId}`).get();
    if (!accountSnap.exists || accountSnap.data()?.status !== "active") {
      throw new HttpsError("failed-precondition", "Esta conta está inativa.");
    }

    const professionalRef = db.doc(`professionals/${user.professionalId}`);
    const professionalSnap = await professionalRef.get();
    const professional = professionalSnap.data();
    const now = Date.now();
    const patch = {
      ...input,
      updatedAtMs: now,
    };
    const batch = db.batch();
    batch.set(professionalRef, patch, { merge: true });
    batch.set(
      db.doc(`publicProfiles/${user.slug}`),
      {
        slug: user.slug,
        accountId: user.accountId,
        professionalId: user.professionalId,
        name: professional?.name ?? "",
        specialty: professional?.specialty ?? "",
        whatsapp: input.whatsapp,
        city: input.city,
        state: input.state,
        bio: input.bio,
        plan: normalizePlan(accountSnap.data()?.plan),
        active: true,
        updatedAtMs: now,
      },
      { merge: true },
    );
    await batch.commit();
    return { ok: true };
  },
);

export const setAccountStatus = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(accountStatusSchema, request.data);
    const accountRef = db.doc(`accounts/${input.accountId}`);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      throw new HttpsError("not-found", "Conta não encontrada.");
    }
    const account = accountSnap.data() as AccountRecord;
    const plan = input.plan
      ? normalizePlan(input.plan)
      : normalizePlan(account.plan);
    const active = input.status === "active";
    const accessRole = plan === "network" ? "clinic" : "professional";
    const now = Date.now();
    const professionalRef = db.doc(
      `professionals/${account.professionalId}`,
    );
    const professionalSnap = await professionalRef.get();
    const professional = professionalSnap.data();

    const batch = db.batch();
    batch.update(accountRef, {
      plan,
      tier: plan,
      requestedPlan: plan,
      monthlyLeadLimit: PLANS[plan].monthlyLeadLimit,
      ownerType: plan === "network" ? "clinic" : "dentist",
      seatsTotal: PLANS[plan].includedSeats,
      extraSeatPrice: PLANS[plan].extraSeatPrice,
      status: input.status,
      isActive: active,
      activatedAtMs: active
        ? Number(accountSnap.data()?.activatedAtMs ?? now)
        : accountSnap.data()?.activatedAtMs ?? null,
      activatedBy: active ? uid : accountSnap.data()?.activatedBy ?? null,
      activatedPlan: active
        ? plan
        : accountSnap.data()?.activatedPlan ?? null,
      activatedPrice: active
        ? PLANS[plan].price
        : accountSnap.data()?.activatedPrice ?? null,
      paymentStatus: active
        ? "confirmed"
        : input.status === "overdue"
          ? "overdue"
          : "paused",
      paymentConfirmedAtMs: active
        ? now
        : accountSnap.data()?.paymentConfirmedAtMs ?? null,
      paymentConfirmedBy: active
        ? uid
        : accountSnap.data()?.paymentConfirmedBy ?? null,
      renewAtMs: active
        ? now + 30 * 24 * 60 * 60 * 1000
        : accountSnap.data()?.renewAtMs ?? null,
      updatedAtMs: now,
    });
    batch.set(
      db.doc(`users/${account.ownerUid}`),
      {
        role: accessRole,
        status: input.status,
        updatedAtMs: now,
      },
      { merge: true },
    );
    batch.set(
      professionalRef,
      {
        plan,
        isActive: active,
        updatedAtMs: now,
      },
      { merge: true },
    );
    batch.set(
      db.doc(`publicProfiles/${account.slug}`),
      {
        accountId: input.accountId,
        professionalId: account.professionalId,
        slug: account.slug,
        name: professional?.name ?? "",
        whatsapp: professional?.whatsapp ?? "",
        specialty: professional?.specialty ?? "",
        city: professional?.city ?? "",
        state: professional?.state ?? "",
        bio: professional?.bio ?? "",
        plan,
        ownerType: plan === "network" ? "clinic" : "dentist",
        active,
        updatedAtMs: now,
      },
      { merge: true },
    );
    await batch.commit();
    await auth.setCustomUserClaims(account.ownerUid, {
      role: accessRole,
      accountId: input.accountId,
      professionalId: account.professionalId,
      accountStatus: input.status,
    });
    return { ok: true };
  },
);

export const createTeamMember = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const managerUid = requireUid(request);
    const manager = await requireClinicManager(managerUid);
    const input = parseInput(teamMemberSchema, request.data);
    const accountRef = db.doc(`accounts/${manager.accountId}`);
    const accountSnap = await accountRef.get();
    const seatsTotal = Number(
      accountSnap.data()?.seatsTotal ?? PLANS.network.includedSeats,
    );
    const activeMembers = await db
      .collection("professionals")
      .where("accountId", "==", manager.accountId)
      .where("isActive", "==", true)
      .get();
    if (activeMembers.size >= seatsTotal) {
      throw new HttpsError(
        "resource-exhausted",
        `Todos os ${seatsTotal} acessos da conta estão em uso.`,
      );
    }

    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email: input.email,
        password: input.temporaryPassword,
        displayName: input.name,
        disabled: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("email-already-exists")) {
        throw new HttpsError("already-exists", "Este email já possui um acesso.");
      }
      throw error;
    }

    const professionalId = `pro_${firebaseUser.uid}`;
    const slugBase = slugify(input.name) || "dentista";
    const slug = `${slugBase}-${firebaseUser.uid.slice(0, 6).toLowerCase()}`;
    const now = Date.now();
    const batch = db.batch();
    batch.set(db.doc(`users/${firebaseUser.uid}`), {
      uid: firebaseUser.uid,
      email: input.email,
      role: "professional",
      accountId: manager.accountId,
      professionalId,
      slug,
      status: "active",
      createdAtMs: now,
      updatedAtMs: now,
    });
    batch.set(db.doc(`professionals/${professionalId}`), {
      id: professionalId,
      accountId: manager.accountId,
      ownerUid: firebaseUser.uid,
      name: input.name,
      email: input.email,
      whatsapp: input.whatsapp,
      specialty: input.specialty,
      teamTag: input.teamTag,
      publicSlug: slug,
      plan: "network",
      role: "dentist",
      isActive: true,
      createdAt: now,
      createdAtMs: now,
      updatedAtMs: now,
    });
    batch.set(db.doc(`publicProfiles/${slug}`), {
      slug,
      accountId: manager.accountId,
      professionalId,
      ownerType: "dentist",
      name: input.name,
      whatsapp: input.whatsapp,
      specialty: input.specialty,
      plan: "network",
      active: true,
      createdAtMs: now,
      updatedAtMs: now,
    });
    batch.set(
      accountRef,
      {
        seatsUsed: FieldValue.increment(1),
        updatedAtMs: now,
      },
      { merge: true },
    );
    try {
      await auth.setCustomUserClaims(firebaseUser.uid, {
        role: "professional",
        accountId: manager.accountId,
        professionalId,
        accountStatus: "active",
      });
      await batch.commit();
    } catch (error) {
      await auth.deleteUser(firebaseUser.uid).catch(() => undefined);
      throw error;
    }
    return { professionalId, slug };
  },
);

export const setTeamMemberStatus = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const managerUid = requireUid(request);
    const manager = await requireClinicManager(managerUid);
    const input = parseInput(professionalStatusSchema, request.data);
    const professionalRef = db.doc(`professionals/${input.professionalId}`);
    const professionalSnap = await professionalRef.get();
    if (
      !professionalSnap.exists
      || professionalSnap.data()?.accountId !== manager.accountId
    ) {
      throw new HttpsError("not-found", "Profissional não encontrado.");
    }
    if (professionalSnap.data()?.ownerUid === managerUid) {
      throw new HttpsError(
        "failed-precondition",
        "O administrador principal não pode ser desativado por este painel.",
      );
    }
    const currentlyActive = professionalSnap.data()?.isActive === true;
    if (currentlyActive === input.isActive) return { ok: true };
    if (input.isActive) {
      const [accountSnap, activeMembers] = await Promise.all([
        db.doc(`accounts/${manager.accountId}`).get(),
        db
          .collection("professionals")
          .where("accountId", "==", manager.accountId)
          .where("isActive", "==", true)
          .get(),
      ]);
      const seatsTotal = Number(
        accountSnap.data()?.seatsTotal ?? PLANS.network.includedSeats,
      );
      if (activeMembers.size >= seatsTotal) {
        throw new HttpsError(
          "resource-exhausted",
          `Todos os ${seatsTotal} acessos da conta estão em uso.`,
        );
      }
    }

    const memberUid = String(professionalSnap.data()?.ownerUid ?? "");
    const slug = String(professionalSnap.data()?.publicSlug ?? "");
    const now = Date.now();
    const batch = db.batch();
    batch.update(professionalRef, {
      isActive: input.isActive,
      updatedAtMs: now,
    });
    if (memberUid) {
      batch.set(
        db.doc(`users/${memberUid}`),
        {
          status: input.isActive ? "active" : "paused",
          updatedAtMs: now,
        },
        { merge: true },
      );
    }
    if (slug) {
      batch.set(
        db.doc(`publicProfiles/${slug}`),
        { active: input.isActive, updatedAtMs: now },
        { merge: true },
      );
    }
    batch.set(
      db.doc(`accounts/${manager.accountId}`),
      {
        seatsUsed: FieldValue.increment(input.isActive ? 1 : -1),
        updatedAtMs: now,
      },
      { merge: true },
    );
    await batch.commit();
    if (memberUid) {
      await auth.updateUser(memberUid, { disabled: !input.isActive });
    }
    return { ok: true };
  },
);

export const assignLead = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const managerUid = requireUid(request);
    const manager = await requireClinicManager(managerUid);
    const input = parseInput(leadAssignmentSchema, request.data);
    const leadRef = db.doc(`leads/${input.leadId}`);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists || leadSnap.data()?.accountId !== manager.accountId) {
      throw new HttpsError("not-found", "Lead não encontrado.");
    }
    if (input.professionalId) {
      const professional = await db
        .doc(`professionals/${input.professionalId}`)
        .get();
      if (
        !professional.exists
        || professional.data()?.accountId !== manager.accountId
        || professional.data()?.isActive !== true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Escolha um profissional ativo desta clínica.",
        );
      }
    }
    await leadRef.update({
      professionalId: input.professionalId,
      dentistId: input.professionalId,
      matchStatus: input.professionalId ? "matched" : "idle",
      assignedAtMs: Date.now(),
      assignedBy: managerUid,
      updatedAtMs: Date.now(),
    });
    return { ok: true };
  },
);

export const deleteLead = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(leadIdSchema, request.data);
    const [user, leadSnap] = await Promise.all([
      readUser(uid),
      db.doc(`leads/${input.leadId}`).get(),
    ]);
    if (!leadSnap.exists) {
      throw new HttpsError("not-found", "Lead não encontrado.");
    }
    const accountId = String(leadSnap.data()?.accountId ?? "");
    const ownsAccount = user.accountId === accountId;
    const ownsLead =
      user.role === "professional"
      && user.professionalId === leadSnap.data()?.professionalId;
    const managesClinic = user.role === "clinic" && ownsAccount;
    if (user.role !== "hq" && !ownsLead && !managesClinic) {
      throw new HttpsError(
        "permission-denied",
        "Você não pode excluir este lead.",
      );
    }
    await leadSnap.ref.delete();
    return { ok: true };
  },
);

export const cleanupExpiredTriageSessions = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const now = Date.now();
    const [expiredSessions, expiredAnalysisCache] = await Promise.all([
      db
        .collection("triageSessions")
        .where("expiresAtMs", "<", now)
        .limit(500)
        .get(),
      db
        .collection("analysisCache")
        .where("expiresAtMs", "<", now)
        .limit(500)
        .get(),
    ]);
    if (!expiredSessions.empty) {
      const sessionBatch = db.batch();
      expiredSessions.docs.forEach((document) => sessionBatch.delete(document.ref));
      await sessionBatch.commit();
    }
    if (!expiredAnalysisCache.empty) {
      const cacheBatch = db.batch();
      expiredAnalysisCache.docs.forEach((document) => cacheBatch.delete(document.ref));
      await cacheBatch.commit();
    }
  },
);

export const cleanupExpiredLeads = onSchedule(
  {
    schedule: "every day 03:30",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const expired = await db
      .collection("leads")
      .where("retentionUntilMs", "<", Date.now())
      .limit(500)
      .get();
    if (expired.empty) return;
    const batch = db.batch();
    expired.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  },
);

export const cleanupStaleUsageReservations = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const stale = await db
      .collection("usageReservations")
      .where("state", "==", "reserved")
      .where("createdAtMs", "<", Date.now() - 10 * 60 * 1000)
      .limit(100)
      .get();
    for (const reservation of stale.docs) {
      const data = reservation.data();
      await releaseUsageReservation(
        reservation.id,
        String(data.sessionId ?? ""),
        String(data.month ?? monthKey()),
      );
    }
  },
);

export {
  CONSENT_VERSION,
  SUBSCRIBER_TERMS_VERSION,
};
