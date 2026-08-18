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
import { generateBusinessAssistant, scopeBusinessLeads } from "./assistant.js";
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
  canStartTrial,
  startTrialFields,
  trialStatusAt,
  TRIAL_DURATION_MS,
} from "./lifecycle.js";
import {
  accountStatusSchema,
  assistantRequestSchema,
  captureLeadSchema,
  checkoutSchema,
  dailyPostSchema,
  dailyPostAssignmentRequestSchema,
  dailyPostEventSchema,
  dailyPostTemplateSchema,
  hqProfessionalPatchSchema,
  imageSchema,
  leadAssignmentSchema,
  leadIdSchema,
  patientConversionActionSchema,
  professionalStatusSchema,
  professionalArchiveSchema,
  professionalRestoreSchema,
  professionalSlugSchema,
  professionalTrialSchema,
  profilePatchSchema,
  slugify,
  startTriageSchema,
  teamMemberSchema,
} from "./validation.js";
import { assertSlugAllowed } from "./slug.js";
import {
  chooseDailyPostTemplate,
  dailyPostAssignmentDocumentId,
  DAILY_POST_LIBRARY_REVISION,
  localDateKey,
  SeedDailyPostTemplate,
} from "./dailyPostLibrary.js";

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
  ownerType?: "dentist" | "clinic";
  trialStatus?: "not_started" | "active" | "expired" | "converted";
  trialStartedAtMs?: number;
  trialEndsAtMs?: number;
  trialUntil?: number;
  trialEligible?: boolean;
  subscriptionStatus?: string;
  paymentStatus?: string;
  statusBeforeArchive?: string;
}

interface UserRecord {
  role?: "hq" | "clinic" | "professional";
  accountId?: string;
  professionalId?: string;
  slug?: string;
  status?: string;
}

interface ProfessionalRecord {
  id?: string;
  accountId?: string;
  ownerUid?: string;
  name?: string;
  email?: string;
  whatsapp?: string;
  specialty?: string;
  city?: string;
  state?: string;
  bio?: string;
  bioLink?: string;
  profileImage?: string;
  standardMessage?: string;
  templates?: string[];
  teamTag?: string;
  isOnDuty?: boolean;
  publicSlug?: string;
  isActive?: boolean;
  status?: "active" | "trial" | "subscriber" | "inactive" | "archived";
  trialStatus?: "not_started" | "active" | "expired" | "converted";
  trialStartedAtMs?: number;
  trialEndsAtMs?: number;
  trialUntil?: number;
  archivedAtMs?: number;
  archivedBy?: string;
  statusBeforeArchive?: string;
  isDemo?: boolean;
  isProtected?: boolean;
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

type AdminAuditAction =
  | "account_status_changed"
  | "professional_profile_updated"
  | "professional_trial_started"
  | "professional_archived"
  | "professional_restored"
  | "professional_slug_changed"
  | "daily_post_updated"
  | "assistant_requested";

type FirestoreWriter = { set: (...args: any[]) => unknown };

function addAdminAudit(writer: FirestoreWriter, input: {
  actorUid: string;
  action: AdminAuditAction;
  accountId: string;
  professionalId?: string | null;
  details?: Record<string, unknown>;
  now: number;
}): void {
  writer.set(db.collection("adminAuditLogs").doc(), {
    actorUid: input.actorUid,
    action: input.action,
    accountId: input.accountId,
    professionalId: input.professionalId ?? null,
    details: input.details ?? {},
    createdAtMs: input.now,
  });
}

function addSubscriptionHistory(writer: FirestoreWriter, input: {
  actorUid: string;
  accountId: string;
  professionalId?: string | null;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string;
  now: number;
}): void {
  writer.set(db.collection("subscriptionHistory").doc(), {
    actorUid: input.actorUid,
    accountId: input.accountId,
    professionalId: input.professionalId ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    reason: input.reason ?? "",
    createdAtMs: input.now,
  });
}

function assertAdminTarget(
  accountId: string,
  professionalId: string,
  account: FirebaseFirestore.DocumentData,
  professional: FirebaseFirestore.DocumentData,
): void {
  if (professional.accountId !== accountId) {
    throw new HttpsError("permission-denied", "O profissional não pertence à conta selecionada.");
  }
  if (professional.isDemo === true || professional.isProtected === true) return;
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

async function resolvePublicProfileSlug(slug: string): Promise<{
  slug: string;
  snapshot: FirebaseFirestore.DocumentSnapshot;
}> {
  let currentSlug = slug;
  const visited = new Set<string>();
  for (let depth = 0; depth < 10; depth += 1) {
    if (visited.has(currentSlug)) break;
    visited.add(currentSlug);
    const profile = await db.doc(`publicProfiles/${currentSlug}`).get();
    if (profile.exists) return { slug: currentSlug, snapshot: profile };
    const alias = await db.doc(`publicSlugAliases/${currentSlug}`).get();
    const target = String(alias.data()?.targetSlug ?? "");
    if (!alias.exists || !target || target === currentSlug) break;
    currentSlug = target;
  }
  return { slug: currentSlug, snapshot: await db.doc(`publicProfiles/${currentSlug}`).get() };
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
    const resolvedProfile = await resolvePublicProfileSlug(input.slug);
    const profileSnap = resolvedProfile.snapshot;
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
      slug: resolvedProfile.slug,
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
    const professional = (professionalSnap.data() ?? {}) as ProfessionalRecord;
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
        profileImage: input.profileImage,
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

export const updateProfessionalByHq = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(hqProfessionalPatchSchema, request.data);
    const [accountSnap, professionalSnap] = await Promise.all([
      db.doc(`accounts/${input.accountId}`).get(),
      db.doc(`professionals/${input.professionalId}`).get(),
    ]);
    if (!accountSnap.exists || !professionalSnap.exists) {
      throw new HttpsError("not-found", "Cliente ou profissional não encontrado.");
    }
    const account = accountSnap.data() as AccountRecord;
    const current = professionalSnap.data() as ProfessionalRecord;
    assertAdminTarget(input.accountId, input.professionalId, account, current);
    const now = Date.now();
    const fields = ["name", "specialty", "whatsapp", "city", "state", "bio", "bioLink", "standardMessage", "templates", "teamTag", "isOnDuty", "profileImage"] as const;
    const patch: Record<string, unknown> = { updatedAtMs: now };
    for (const field of fields) if (input[field] !== undefined) patch[field] = input[field];
    const batch = db.batch();
    batch.set(db.doc(`professionals/${input.professionalId}`), patch, { merge: true });
    const slug = String(current.publicSlug ?? account.slug ?? "");
    if (slug) {
      batch.set(db.doc(`publicProfiles/${slug}`), {
        accountId: input.accountId,
        professionalId: input.professionalId,
        slug,
        name: String(patch.name ?? current.name ?? ""),
        whatsapp: String(patch.whatsapp ?? current.whatsapp ?? ""),
        specialty: String(patch.specialty ?? current.specialty ?? ""),
        city: String(patch.city ?? current.city ?? ""),
        state: String(patch.state ?? current.state ?? ""),
        bio: String(patch.bio ?? current.bio ?? ""),
        profileImage: String(patch.profileImage ?? current.profileImage ?? ""),
        plan: normalizePlan(account.plan),
        ownerType: account.ownerType === "clinic" ? "clinic" : "dentist",
        status: current.status ?? "subscriber",
        active: current.isActive !== false && current.status !== "archived",
        updatedAtMs: now,
      }, { merge: true });
    }
    addAdminAudit(batch, {
      actorUid: uid,
      action: "professional_profile_updated",
      accountId: input.accountId,
      professionalId: input.professionalId,
      details: { fields: Object.keys(patch).filter((field) => field !== "updatedAtMs") },
      now,
    });
    await batch.commit();
    return { ok: true };
  },
);

export const startProfessionalTrial = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(professionalTrialSchema, request.data);
    const [accountSnap, professionalSnap] = await Promise.all([
      db.doc(`accounts/${input.accountId}`).get(),
      db.doc(`professionals/${input.professionalId}`).get(),
    ]);
    if (!accountSnap.exists || !professionalSnap.exists) {
      throw new HttpsError("not-found", "Cliente ou profissional não encontrado.");
    }
    const account = accountSnap.data() as AccountRecord;
    const professional = professionalSnap.data() as ProfessionalRecord;
    assertAdminTarget(input.accountId, input.professionalId, account, professional);
    const isAccountOwner = account.professionalId === input.professionalId
      || account.ownerType !== "clinic";
    const alreadyHasAccess = professional.isActive === true
      || ["active", "trial", "subscriber"].includes(professional.status ?? "");
    const ownerHasPaidSubscription = isAccountOwner
      && (
        account.status === "active"
        || account.subscriptionStatus === "active"
        || account.paymentStatus === "confirmed"
      );
    if (alreadyHasAccess || ownerHasPaidSubscription) {
      throw new HttpsError(
        "failed-precondition",
        "O trial só pode ser iniciado para um profissional inativo e sem assinatura ativa.",
      );
    }
    if (professional.isProtected === true || professional.isDemo === true || !canStartTrial(professional) || !canStartTrial(account)) {
      throw new HttpsError("already-exists", "Este profissional já utilizou o trial ou está protegido.");
    }
    if (professional.status === "archived") throw new HttpsError("failed-precondition", "Restaure o profissional antes de iniciar um trial.");
    const now = Date.now();
    const trial = startTrialFields(now);
    const batch = db.batch();
    batch.set(db.doc(`professionals/${input.professionalId}`), { status: "trial", isActive: true, ...trial, updatedAtMs: now }, { merge: true });
    if (account.professionalId === input.professionalId || account.ownerType !== "clinic") {
      batch.set(db.doc(`accounts/${input.accountId}`), { status: "active", isActive: true, subscriptionStatus: "trial", trialEligible: false, ...trial, updatedAtMs: now }, { merge: true });
    }
    if (professional.ownerUid) batch.set(db.doc(`users/${professional.ownerUid}`), { status: "active", lifecycleStatus: "trial", updatedAtMs: now }, { merge: true });
    const slug = String(professional.publicSlug ?? account.slug ?? "");
    if (slug) batch.set(db.doc(`publicProfiles/${slug}`), { active: true, status: "trial", updatedAtMs: now }, { merge: true });
    addAdminAudit(batch, { actorUid: uid, action: "professional_trial_started", accountId: input.accountId, professionalId: input.professionalId, details: { trialEndsAtMs: trial.trialEndsAtMs }, now });
    addSubscriptionHistory(batch, { actorUid: uid, accountId: input.accountId, professionalId: input.professionalId, fromStatus: account.status, toStatus: "trial", reason: "trial de 7 dias", now });
    await batch.commit();
    if (professional.ownerUid) await auth.setCustomUserClaims(professional.ownerUid, { role: account.ownerType === "clinic" ? "professional" : "professional", accountId: input.accountId, professionalId: input.professionalId, accountStatus: "active", professionalStatus: "trial" });
    return { ok: true, trialStartedAtMs: trial.trialStartedAtMs, trialEndsAtMs: trial.trialEndsAtMs, durationMs: TRIAL_DURATION_MS };
  },
);

export const archiveProfessional = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(professionalArchiveSchema, request.data);
    const [accountSnap, professionalSnap] = await Promise.all([
      db.doc(`accounts/${input.accountId}`).get(),
      db.doc(`professionals/${input.professionalId}`).get(),
    ]);
    if (!accountSnap.exists || !professionalSnap.exists) throw new HttpsError("not-found", "Cliente ou profissional não encontrado.");
    const account = accountSnap.data() as AccountRecord;
    const professional = professionalSnap.data() as ProfessionalRecord;
    assertAdminTarget(input.accountId, input.professionalId, account, professional);
    if (professional.isProtected === true || professional.isDemo === true) throw new HttpsError("failed-precondition", "Este profissional protegido não pode ser arquivado.");
    if (professional.status === "archived") return { ok: true, alreadyArchived: true };
    const now = Date.now();
    const batch = db.batch();
    batch.set(db.doc(`professionals/${input.professionalId}`), { status: "archived", isActive: false, statusBeforeArchive: professional.status ?? "active", archivedAtMs: now, archivedBy: uid, archiveReason: input.reason, updatedAtMs: now }, { merge: true });
    if (professional.ownerUid) batch.set(db.doc(`users/${professional.ownerUid}`), { status: "paused", lifecycleStatus: "archived", updatedAtMs: now }, { merge: true });
    const slug = String(professional.publicSlug ?? account.slug ?? "");
    if (slug) batch.set(db.doc(`publicProfiles/${slug}`), { active: false, status: "archived", archivedAtMs: now, updatedAtMs: now }, { merge: true });
    if (account.professionalId === input.professionalId && account.ownerType !== "clinic") batch.set(db.doc(`accounts/${input.accountId}`), { statusBeforeArchive: account.status, status: "paused", isActive: false, subscriptionStatus: "paused", updatedAtMs: now }, { merge: true });
    addAdminAudit(batch, { actorUid: uid, action: "professional_archived", accountId: input.accountId, professionalId: input.professionalId, details: { reason: input.reason }, now });
    addSubscriptionHistory(batch, { actorUid: uid, accountId: input.accountId, professionalId: input.professionalId, fromStatus: professional.status ?? account.status, toStatus: "archived", reason: input.reason || "arquivamento administrativo", now });
    await batch.commit();
    if (professional.ownerUid) await auth.updateUser(professional.ownerUid, { disabled: true });
    return { ok: true, archivedAtMs: now };
  },
);

export const restoreProfessional = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(professionalRestoreSchema, request.data);
    const [accountSnap, professionalSnap] = await Promise.all([
      db.doc(`accounts/${input.accountId}`).get(),
      db.doc(`professionals/${input.professionalId}`).get(),
    ]);
    if (!accountSnap.exists || !professionalSnap.exists) throw new HttpsError("not-found", "Cliente ou profissional não encontrado.");
    const account = accountSnap.data() as AccountRecord;
    const professional = professionalSnap.data() as ProfessionalRecord;
    assertAdminTarget(input.accountId, input.professionalId, account, professional);
    if (professional.status !== "archived") return { ok: true, alreadyActive: true };
    const now = Date.now();
    const previous = String(professional.statusBeforeArchive ?? "active");
    const trialStatus = trialStatusAt({ ...professional, status: previous as ProfessionalRecord["status"] }, now);
    const canAccess = account.status === "active" && previous !== "inactive" && trialStatus !== "expired";
    const status = canAccess ? (previous === "trial" ? "trial" : previous === "subscriber" ? "subscriber" : "active") : "inactive";
    const batch = db.batch();
    batch.set(db.doc(`professionals/${input.professionalId}`), { status, isActive: canAccess, archivedAtMs: null, archivedBy: null, updatedAtMs: now }, { merge: true });
    if (professional.ownerUid) batch.set(db.doc(`users/${professional.ownerUid}`), { status: canAccess ? "active" : "paused", lifecycleStatus: status, updatedAtMs: now }, { merge: true });
    const slug = String(professional.publicSlug ?? account.slug ?? "");
    if (slug) batch.set(db.doc(`publicProfiles/${slug}`), { active: canAccess, status, archivedAtMs: null, updatedAtMs: now }, { merge: true });
    addAdminAudit(batch, { actorUid: uid, action: "professional_restored", accountId: input.accountId, professionalId: input.professionalId, details: { status }, now });
    addSubscriptionHistory(batch, { actorUid: uid, accountId: input.accountId, professionalId: input.professionalId, fromStatus: "archived", toStatus: status, reason: "restauração administrativa", now });
    await batch.commit();
    if (professional.ownerUid) await auth.updateUser(professional.ownerUid, { disabled: !canAccess });
    return { ok: true, status, isActive: canAccess };
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
    const professional = (professionalSnap.data() ?? {}) as ProfessionalRecord;
    const startsTrial = active
      && account.trialEligible === true
      && canStartTrial(account)
      && canStartTrial(professional);
    const trial = startsTrial ? startTrialFields(now) : null;
    const wasTrial = professional.status === "trial" || account.trialStatus === "active";
    const nextProfessionalStatus = startsTrial ? "trial" : active ? "subscriber" : "inactive";

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
      subscriptionStatus: startsTrial ? "trial" : active ? "active" : input.status,
      trialStatus: startsTrial ? "active" : wasTrial && active ? "converted" : account.trialStatus ?? "not_started",
      trialEligible: startsTrial ? false : account.trialEligible ?? false,
      ...(trial ?? {}),
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
        status: nextProfessionalStatus,
        trialStatus: startsTrial ? "active" : wasTrial && active ? "converted" : professional.trialStatus ?? "not_started",
        ...(trial ?? {}),
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
        status: nextProfessionalStatus,
        active,
        updatedAtMs: now,
      },
      { merge: true },
    );
    addAdminAudit(batch, {
      actorUid: uid,
      action: "account_status_changed",
      accountId: input.accountId,
      professionalId: account.professionalId,
      details: { fromStatus: account.status, toStatus: input.status, plan },
      now,
    });
    addSubscriptionHistory(batch, {
      actorUid: uid,
      accountId: input.accountId,
      professionalId: account.professionalId,
      fromStatus: account.subscriptionStatus ?? account.status,
      toStatus: startsTrial ? "trial" : active ? "subscriber" : input.status,
      reason: "alteração administrativa de assinatura",
      now,
    });
    await batch.commit();
    await auth.setCustomUserClaims(account.ownerUid, {
      role: accessRole,
      accountId: input.accountId,
      professionalId: account.professionalId,
      accountStatus: input.status,
      professionalStatus: nextProfessionalStatus,
    });
    return { ok: true };
  },
);

export const updateProfessionalSlug = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(professionalSlugSchema, request.data);
    try { assertSlugAllowed(input.slug); } catch (error) {
      throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Endereço inválido.");
    }
    const user = await readUser(uid);
    const isHqUser = user.role === "hq";
    const accountId = isHqUser ? input.accountId : user.accountId;
    const professionalId = isHqUser ? input.professionalId : user.professionalId;
    if (!accountId || !professionalId) {
      throw new HttpsError("invalid-argument", "Cliente e profissional são obrigatórios.");
    }
    const accountRef = db.doc(`accounts/${accountId}`);
    const professionalRef = db.doc(`professionals/${professionalId}`);
    const [accountSnap, professionalSnap] = await Promise.all([accountRef.get(), professionalRef.get()]);
    if (!accountSnap.exists || !professionalSnap.exists || professionalSnap.data()?.accountId !== accountId) {
      throw new HttpsError("not-found", "Profissional não encontrado.");
    }
    if (!isHqUser && user.professionalId !== professionalId) {
      throw new HttpsError("permission-denied", "Você não pode alterar este endereço.");
    }
    const currentSlug = String(professionalSnap.data()?.publicSlug ?? accountSnap.data()?.slug ?? "");
    if (currentSlug === input.slug) return { ok: true, slug: input.slug };
    const now = Date.now();
    const newProfileRef = db.doc(`publicProfiles/${input.slug}`);
    const newAliasRef = db.doc(`publicSlugAliases/${input.slug}`);
    const currentProfileRef = currentSlug
      ? db.doc(`publicProfiles/${currentSlug}`)
      : null;
    await db.runTransaction(async (transaction) => {
      const [newProfile, newAlias] = await Promise.all([
        transaction.get(newProfileRef),
        transaction.get(newAliasRef),
      ]);
      const currentProfile = currentProfileRef
        ? await transaction.get(currentProfileRef)
        : null;
      if (newProfile.exists || newAlias.exists) {
        throw new HttpsError("already-exists", "Este link público já está em uso.");
      }
      const profileData = currentProfile?.data() ?? {
        accountId,
        professionalId,
        name: professionalSnap.data()?.name ?? "",
        whatsapp: professionalSnap.data()?.whatsapp ?? "",
        specialty: professionalSnap.data()?.specialty ?? "",
        city: professionalSnap.data()?.city ?? "",
        state: professionalSnap.data()?.state ?? "",
        bio: professionalSnap.data()?.bio ?? "",
        profileImage: professionalSnap.data()?.profileImage ?? "",
        plan: accountSnap.data()?.plan,
        ownerType: accountSnap.data()?.ownerType === "clinic" ? "clinic" : "dentist",
        active: professionalSnap.data()?.isActive === true,
      };
      transaction.set(newProfileRef, { ...profileData, slug: input.slug, updatedAtMs: now });
      if (currentProfile?.exists && currentProfileRef) transaction.delete(currentProfileRef);
      if (currentSlug) transaction.set(db.doc(`publicSlugAliases/${currentSlug}`), {
        sourceSlug: currentSlug,
        targetSlug: input.slug,
        createdAtMs: now,
        updatedAtMs: now,
      });
      transaction.set(professionalRef, { publicSlug: input.slug, updatedAtMs: now }, { merge: true });
      const ownerUid = String(professionalSnap.data()?.ownerUid ?? "");
      if (ownerUid) transaction.set(db.doc(`users/${ownerUid}`), { slug: input.slug, updatedAtMs: now }, { merge: true });
      if (accountSnap.data()?.professionalId === professionalId) {
        transaction.set(accountRef, { slug: input.slug, updatedAtMs: now }, { merge: true });
      }
      addAdminAudit(transaction, {
        actorUid: uid,
        action: "professional_slug_changed",
        accountId,
        professionalId,
        details: { fromSlug: currentSlug, toSlug: input.slug },
        now,
      });
    });
    return { ok: true, slug: input.slug, previousSlug: currentSlug };
  },
);

async function resolveDailyPostProfessional(uid: string, requestedProfessionalId?: string): Promise<{ professionalId: string; professional: ProfessionalRecord }> {
  const user = await readUser(uid);
  const professionalId = requestedProfessionalId || user.professionalId;
  if (!professionalId) throw new HttpsError("invalid-argument", "Selecione um profissional.");
  const professionalSnap = await db.doc(`professionals/${professionalId}`).get();
  if (!professionalSnap.exists) throw new HttpsError("not-found", "Profissional não encontrado.");
  const professional = professionalSnap.data() as ProfessionalRecord;
  const allowed = user.role === "hq"
    || (user.role === "professional" && user.professionalId === professionalId)
    || (user.role === "clinic" && user.accountId === professional.accountId);
  if (!allowed) throw new HttpsError("permission-denied", "Você não pode acessar o Post do Dia deste profissional.");
  return { professionalId, professional };
}

function dailyPostTemplateFromData(id: string, data: Record<string, unknown>): SeedDailyPostTemplate {
  return {
    ...(data as unknown as SeedDailyPostTemplate),
    id,
    seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords.map(String) : [],
    availableFrom: null,
    availableUntil: null,
  };
}

async function createOrReadDailyPostAssignment(professionalId: string, professional: ProfessionalRecord, now: number, alternative = false) {
  const preferenceRef = db.doc(`professionalContentPreferences/${professionalId}`);
  const preferenceSnap = await preferenceRef.get();
  const preference = preferenceSnap.data() ?? {};
  const timeZone = typeof preference.timeZone === "string" ? preference.timeZone : "America/Sao_Paulo";
  const assignmentDate = localDateKey(now, timeZone);
  const assignmentRef = db.doc(
    `dailyPostAssignments/${dailyPostAssignmentDocumentId(professionalId, assignmentDate)}`,
  );
  const existing = await assignmentRef.get();
  if (existing.exists && !alternative) return { id: existing.id, ...existing.data() };
  if (alternative && preference.allowDailyAlternative === false) {
    throw new HttpsError("failed-precondition", "Outra opção não está habilitada para este perfil.");
  }

  const templatesSnap = await db.collection("dailyPostTemplates").where("status", "==", "published").limit(200).get();
  const eligible = templatesSnap.docs
    .filter((item) => {
      const data = item.data();
      return (!data.availableFromMs || Number(data.availableFromMs) <= now)
        && (!data.availableUntilMs || Number(data.availableUntilMs) >= now);
    })
    .map((item) => dailyPostTemplateFromData(item.id, item.data()));
  if (!eligible.length) throw new HttpsError("failed-precondition", "A biblioteca do Post do Dia ainda não foi publicada.");

  const historySnap = await db.collection("dailyPostAssignments").where("professionalId", "==", professionalId).limit(200).get();
  const history = historySnap.docs
    .map((item) => item.data())
    .sort((a, b) => Number(b.generatedAtMs ?? 0) - Number(a.generatedAtMs ?? 0));
  const usedTemplateIds = history.flatMap((item) => [String(item.templateId ?? ""), ...((item.templateHistory as string[] | undefined) ?? [])]).filter(Boolean);
  if (existing.exists) usedTemplateIds.push(String(existing.data()?.templateId ?? ""));
  const specialties = Array.isArray(preference.specialties)
    ? preference.specialties.map(String)
    : [String(professional.specialty ?? "general_dentistry")];
  const targetAudiences = Array.isArray(preference.targetAudiences) ? preference.targetAudiences.map(String) : ["adults", "families"];
  const preferredCategories = Array.isArray(preference.preferredCategories) ? preference.preferredCategories.map(String) : [];
  const blockedCategories = Array.isArray(preference.blockedCategories) ? preference.blockedCategories.map(String) : [];
  const mandatory = eligible.filter((item) => item.mandatoryDate === assignmentDate);
  const selected = chooseDailyPostTemplate(mandatory.length ? mandatory : eligible, {
    specialties, targetAudiences, preferredCategories, blockedCategories, usedTemplateIds,
    previousCategory: String(history.find((item) => item.category)?.category ?? ""),
  });
  if (!selected) throw new HttpsError("failed-precondition", "Nenhum conteúdo elegível foi encontrado.");
  const template = selected.template;
  const currentData = existing.data();
  const snapshot = {
    title: template.title, hook: template.hook, shortText: template.shortText,
    caption: template.caption, ctaText: template.ctaText, ctaType: template.ctaType,
    hashtags: template.hashtags, seoKeywords: template.seoKeywords, category: template.category,
    communicationGoal: template.communicationGoal, editorialFormat: template.editorialFormat,
    feedLayoutKey: template.feedLayoutKey, storyLayoutKey: template.storyLayoutKey,
    paletteKey: template.paletteKey, imageStrategy: template.imageStrategy,
    defaultImageUrl: template.defaultImageUrl, carouselSlides: template.carouselSlides,
  };
  const brandDisplayName = [
    preference.professionalName,
    preference.clinicName,
    professional.name,
  ]
    .map((value) => String(value ?? "").trim())
    .find(Boolean) ?? "Seu consultório";
  const data = {
    professionalId,
    accountId: professional.accountId ?? "",
    assignmentDate,
    timeZone,
    templateId: template.id,
    templateVersion: template.version,
    libraryRevision: DAILY_POST_LIBRARY_REVISION,
    category: template.category,
    selectionReason: mandatory.length ? "scheduled_campaign" : selected.reason,
    status: "assigned",
    contentSnapshot: snapshot,
    brandSnapshot: {
      displayName: brandDisplayName,
      instagramHandle: String(preference.instagramHandle ?? ""),
      logoUrl: String(preference.logoUrl ?? ""),
    },
    customizedVariant: null,
    templateHistory: alternative
      ? [...((currentData?.templateHistory as string[] | undefined) ?? []), String(currentData?.templateId ?? "")].filter(Boolean)
      : [],
    alternativeCount: alternative ? Number(currentData?.alternativeCount ?? 0) + 1 : 0,
    generatedAtMs: alternative ? Number(currentData?.generatedAtMs ?? now) : now,
    updatedAtMs: now,
    openedAtMs: currentData?.openedAtMs ?? null,
    copiedAtMs: currentData?.copiedAtMs ?? null,
    downloadedAtMs: currentData?.downloadedAtMs ?? null,
    usedAtMs: currentData?.usedAtMs ?? null,
    skippedAtMs: alternative ? now : currentData?.skippedAtMs ?? null,
  };
  await assignmentRef.set(data, { merge: true });
  if (!preferenceSnap.exists) {
    await preferenceRef.set({
      professionalId, accountId: professional.accountId ?? "", specialties, targetAudiences, preferredCategories: [], blockedCategories: [],
      tone: "acolhedor", defaultCtaText: "", defaultCtaLink: professional.bioLink ?? "",
      professionalName: professional.name ?? "", clinicName: "", instagramHandle: "",
      logoUrl: "", professionalPhotoUrl: professional.profileImage ?? "", primaryColor: "#123B5D",
      secondaryColor: "#18AFA5", allowDailyAlternative: true, timeZone, updatedAtMs: now,
    }, { merge: true });
  }
  return { id: assignmentRef.id, ...data };
}

export const manageDailyPost = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const legacyInput = dailyPostSchema.safeParse(request.data);
    const isRichTemplate = typeof request.data === "object" && request.data !== null && "hook" in request.data;
    const input = legacyInput.success && !isRichTemplate
      ? {
          templateId: legacyInput.data.postId,
          title: legacyInput.data.title,
          hook: legacyInput.data.title,
          shortText: legacyInput.data.caption.slice(0, 500),
          caption: legacyInput.data.caption,
          ctaText: legacyInput.data.cta,
          ctaType: "contact" as const,
          hashtags: ["#SaudeBucal", "#SorvySmile"],
          seoKeywords: ["saúde bucal", "prevenção odontológica", "dentista"],
          category: "prevention" as const,
          communicationGoal: "education" as const,
          targetAudienceTags: ["adults", "families"],
          specialtyTags: ["general_dentistry"],
          editorialFormat: "single_card" as const,
          feedLayoutKey: "feed-single_card",
          storyLayoutKey: "story-single_card",
          paletteKey: "#18AFA5",
          imageStrategy: legacyInput.data.imageUrl ? "library" as const : "no_photo" as const,
          defaultImageUrl: legacyInput.data.imageUrl,
          carouselSlides: [],
          status: legacyInput.data.status,
          isEvergreen: true,
          priority: 50,
          mandatoryDate: "",
          availableFromMs: legacyInput.data.publishAtMs,
          availableUntilMs: legacyInput.data.expiresAtMs,
        }
      : parseInput(dailyPostTemplateSchema, request.data);
    const now = Date.now();
    if (input.availableUntilMs && input.availableUntilMs <= now) {
      throw new HttpsError("invalid-argument", "A expiração precisa estar no futuro.");
    }
    const postRef = input.templateId
      ? db.doc(`dailyPostTemplates/${input.templateId}`)
      : db.collection("dailyPostTemplates").doc();
    const publishAtMs = input.availableFromMs ?? now;
    const status = input.status === "scheduled" && publishAtMs <= now
      ? "published"
      : input.status;
    const batch = db.batch();
    const existing = await postRef.get();
    batch.set(postRef, {
      title: input.title,
      hook: input.hook,
      shortText: input.shortText,
      caption: input.caption,
      ctaText: input.ctaText,
      ctaType: input.ctaType,
      hashtags: input.hashtags,
      seoKeywords: input.seoKeywords,
      category: input.category,
      communicationGoal: input.communicationGoal,
      targetAudienceTags: input.targetAudienceTags,
      specialtyTags: input.specialtyTags,
      editorialFormat: input.editorialFormat,
      feedLayoutKey: input.feedLayoutKey,
      storyLayoutKey: input.storyLayoutKey,
      paletteKey: input.paletteKey,
      imageStrategy: input.imageStrategy,
      defaultImageUrl: input.defaultImageUrl,
      carouselSlides: input.carouselSlides,
      status,
      isEvergreen: input.isEvergreen,
      priority: input.priority,
      mandatoryDate: input.mandatoryDate,
      availableFromMs: publishAtMs,
      availableUntilMs: input.availableUntilMs ?? null,
      publishedAtMs: status === "published" ? now : existing.data()?.publishedAtMs ?? null,
      version: Number(existing.data()?.version ?? 0) + 1,
      createdAtMs: existing.data()?.createdAtMs ?? now,
      createdBy: existing.data()?.createdBy ?? uid,
      updatedAtMs: now,
      updatedBy: uid,
    }, { merge: true });
    addAdminAudit(batch, {
      actorUid: uid,
      action: "daily_post_updated",
      accountId: "_sorvy",
      details: { postId: postRef.id, status },
      now,
    });
    await batch.commit();
    return { ok: true, postId: postRef.id, status };
  },
);

export const getDailyPostAssignment = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(dailyPostAssignmentRequestSchema, request.data ?? {});
    const { professionalId, professional } = await resolveDailyPostProfessional(uid, input.professionalId);
    const assignment = await createOrReadDailyPostAssignment(professionalId, professional, Date.now());
    const historySnap = await db.collection("dailyPostAssignments").where("professionalId", "==", professionalId).limit(60).get();
    const history = historySnap.docs
      .map((item) => ({ id: item.id, ...item.data() } as Record<string, unknown> & { id: string }))
      .sort((a, b) => Number(b.generatedAtMs ?? 0) - Number(a.generatedAtMs ?? 0));
    return { ok: true, assignment, history };
  },
);

export const recordDailyPostEvent = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(dailyPostEventSchema, request.data);
    const assignmentRef = db.doc(`dailyPostAssignments/${input.assignmentId}`);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) throw new HttpsError("not-found", "Post do Dia não encontrado.");
    const assignment = assignmentSnap.data()!;
    const { professionalId, professional } = await resolveDailyPostProfessional(uid, String(assignment.professionalId));
    const now = Date.now();
    if (input.eventType === "request_alternative") {
      const replacement = await createOrReadDailyPostAssignment(professionalId, professional, now, true);
      await db.collection("dailyPostEvents").add({ professionalId, assignmentId: input.assignmentId, templateId: assignment.templateId, eventType: input.eventType, format: input.format, createdAtMs: now });
      return { ok: true, assignment: replacement };
    }
    const statusByEvent: Record<string, string> = {
      view: "opened", customize: "customized", copy_caption: "copied",
      download_feed: "downloaded", download_story: "downloaded", mark_as_used: "used",
    };
    const timestampByEvent: Record<string, string> = {
      view: "openedAtMs", copy_caption: "copiedAtMs", download_feed: "downloadedAtMs",
      download_story: "downloadedAtMs", mark_as_used: "usedAtMs",
    };
    const batch = db.batch();
    const eventRef = db.collection("dailyPostEvents").doc();
    batch.set(eventRef, { professionalId, accountId: professional.accountId ?? "", assignmentId: input.assignmentId, templateId: assignment.templateId, eventType: input.eventType, format: input.format, createdAtMs: now });
    batch.set(assignmentRef, {
      status: statusByEvent[input.eventType] ?? assignment.status,
      ...(timestampByEvent[input.eventType] ? { [timestampByEvent[input.eventType]]: now } : {}),
      ...(input.customizedVariant ? { customizedVariant: input.customizedVariant } : {}),
      updatedAtMs: now,
    }, { merge: true });
    await batch.commit();
    return { ok: true };
  },
);

export const askBusinessAssistant = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(assistantRequestSchema, request.data);
    const user = await readUser(uid);
    const accountId = user.role === "hq" ? input.accountId : user.accountId;
    if (!accountId) throw new HttpsError("invalid-argument", "Selecione uma conta.");
    const accountSnap = await db.doc(`accounts/${accountId}`).get();
    if (!accountSnap.exists || normalizePlan(accountSnap.data()?.plan) !== "network") {
      throw new HttpsError("failed-precondition", "As assistentes de IA estão disponíveis no plano Network.");
    }
    if (user.role !== "hq" && user.accountId !== accountId) {
      throw new HttpsError("permission-denied", "Conta inválida.");
    }
    if (user.role !== "hq" && accountSnap.data()?.status !== "active") {
      throw new HttpsError("failed-precondition", "A conta precisa estar ativa para usar as assistentes.");
    }
    if (user.role === "professional") {
      const professional = user.professionalId
        ? await db.doc(`professionals/${user.professionalId}`).get()
        : null;
      if (!professional?.exists || professional.data()?.isActive !== true) {
        throw new HttpsError("permission-denied", "O acesso profissional está inativo.");
      }
    }
    const day = new Date().toISOString().slice(0, 10);
    const usageRef = db.doc(`assistantUsage/${uid}_${day}`);
    await db.runTransaction(async (transaction) => {
      const usage = await transaction.get(usageRef);
      const requests = Number(usage.data()?.requests ?? 0);
      if (requests >= 40) throw new HttpsError("resource-exhausted", "O limite diário da assistente foi atingido.");
      transaction.set(usageRef, { uid, accountId, day, requests: requests + 1, updatedAtMs: Date.now() }, { merge: true });
    });

    const [leadSnapshot, professionalSnapshot] = await Promise.all([
      db.collection("leads")
        .where("accountId", "==", accountId)
        .orderBy("createdAtMs", "desc")
        .limit(500)
        .get(),
      db.collection("professionals").where("accountId", "==", accountId).limit(100).get(),
    ]);
    const accountLeads: Array<{ id: string } & FirebaseFirestore.DocumentData> = leadSnapshot.docs.map(
      (item) => ({ id: item.id, ...item.data() }),
    );
    const leads = scopeBusinessLeads(accountLeads, user.role, user.professionalId);
    const terminal = leads.filter((lead) => lead.status === "closed" || lead.status === "lost");
    const contacted = leads.filter((lead) => Number(lead.firstContactAt ?? 0) > 0);
    const averageResponseMinutes = contacted.length
      ? Math.round(contacted.reduce(
          (sum, lead) => sum + Math.max(
            0,
            Number(lead.firstContactAt) - Number(lead.createdAtMs ?? lead.createdAt),
          ),
          0,
        ) / contacted.length / 60_000)
      : 0;
    const context: Record<string, unknown> = {
      account: { plan: "network", status: accountSnap.data()?.status },
      scope: {
        recordsConsidered: leads.length,
        limitedToLatestAccountRecords: leadSnapshot.size === 500,
      },
      totals: {
        leads: leads.length,
        new: leads.filter((lead) => lead.status === "new").length,
        inChat: leads.filter((lead) => lead.status === "in_chat").length,
        scheduled: leads.filter((lead) => lead.status === "scheduled").length,
        converted: leads.filter((lead) => lead.status === "closed").length,
        conversionPercent: terminal.length ? Math.round((leads.filter((lead) => lead.status === "closed").length / terminal.length) * 100) : 0,
        contactRequests: leads.filter((lead) => Boolean(lead.contactRequestedAtMs)).length,
        averageResponseMinutes,
        professionals: user.role === "professional" ? 1 : professionalSnapshot.size,
      },
    };
    if (input.mode === "conversion") {
      const lead = leads.find((item) => item.id === input.leadId);
      if (!lead) throw new HttpsError("not-found", "Lead não encontrado nesta conta.");
      context.selectedLead = {
        status: lead.status,
        ageHours: Math.max(0, Math.round((Date.now() - Number(lead.createdAtMs ?? lead.createdAt)) / 3_600_000)),
        contactRequested: Boolean(lead.contactRequestedAtMs),
        whatsappOpened: Boolean(lead.patientOpenedWhatsAppAtMs),
        intentCategory: lead.intentCategory ?? lead.scores?.intentCategory ?? "",
        recommendedSpecialty: lead.recommendedSpecialty ?? lead.scores?.recommendedSpecialty ?? "",
        visualStatus: lead.scores?.status ?? "",
      };
    }
    try {
      const result = await generateBusinessAssistant(
        GEMINI_API_KEY.value(),
        GEMINI_MODEL.value(),
        input.mode,
        context,
        input.question,
      );
      const now = Date.now();
      const batch = db.batch();
      addAdminAudit(batch, { actorUid: uid, action: "assistant_requested", accountId, details: { mode: input.mode }, now });
      batch.set(db.collection("assistantAudit").doc(), { uid, accountId, mode: input.mode, createdAtMs: now });
      await batch.commit();
      return { ...result, generatedAt: now };
    } catch (error) {
      console.error("Falha na assistente operacional", describeAiFailure(error));
      throw new HttpsError("internal", "A assistente está temporariamente indisponível. Tente novamente.");
    }
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
    const trial = startTrialFields(now);
    const batch = db.batch();
    batch.set(db.doc(`users/${firebaseUser.uid}`), {
      uid: firebaseUser.uid,
      email: input.email,
      role: "professional",
      accountId: manager.accountId,
      professionalId,
      slug,
      status: "active",
      lifecycleStatus: "trial",
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
      status: "trial",
      ...trial,
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
      status: "trial",
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
    addAdminAudit(batch, {
      actorUid: managerUid,
      action: "professional_trial_started",
      accountId: manager.accountId,
      professionalId,
      details: { trialEndsAtMs: trial.trialEndsAtMs, source: "team_member" },
      now,
    });
    addSubscriptionHistory(batch, {
      actorUid: managerUid,
      accountId: manager.accountId,
      professionalId,
      fromStatus: "not_started",
      toStatus: "trial",
      reason: "trial inicial do membro da rede",
      now,
    });
    try {
      await auth.setCustomUserClaims(firebaseUser.uid, {
        role: "professional",
        accountId: manager.accountId,
        professionalId,
        accountStatus: "active",
        professionalStatus: "trial",
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
      status: input.isActive
        ? (professionalSnap.data()?.status === "trial" ? "trial" : "subscriber")
        : "inactive",
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
        {
          active: input.isActive,
          status: input.isActive
            ? (professionalSnap.data()?.status === "trial" ? "trial" : "subscriber")
            : "inactive",
          updatedAtMs: now,
        },
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

export const publishScheduledDailyPosts = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const now = Date.now();
    const [scheduled, expired] = await Promise.all([
      db.collection("dailyPostTemplates").where("status", "==", "scheduled").where("availableFromMs", "<=", now).limit(100).get(),
      db.collection("dailyPostTemplates").where("status", "==", "published").where("availableUntilMs", "<=", now).limit(100).get(),
    ]);
    if (!expired.empty) {
      const batch = db.batch();
      expired.docs.forEach((item) => batch.set(item.ref, { status: "inactive", updatedAtMs: now }, { merge: true }));
      await batch.commit();
    }
    if (scheduled.empty) return;
    const batch = db.batch();
    scheduled.docs.forEach((item) => batch.set(item.ref, {
      status: "published",
      publishedAtMs: now,
      updatedAtMs: now,
    }, { merge: true }));
    await batch.commit();
  },
);

export const assignDailyPostsHourly = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Sao_Paulo" },
  async () => {
    const now = Date.now();
    const professionals = await db.collection("professionals").limit(500).get();
    for (const document of professionals.docs) {
      const professional = document.data() as ProfessionalRecord;
      if (professional.status === "inactive" || professional.status === "archived" || professional.isActive === false) continue;
      try {
        await createOrReadDailyPostAssignment(document.id, professional, now);
      } catch (error) {
        console.error("daily_post_assignment_failed", document.id, error);
      }
    }
  },
);

export const expireProfessionalTrials = onSchedule(
  {
    schedule: "every day 03:15",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const now = Date.now();
    const snapshot = await db
      .collection("professionals")
      .where("status", "==", "trial")
      .where("trialEndsAtMs", "<", now)
      .limit(500)
      .get();
    for (const document of snapshot.docs) {
      const professional = document.data() as ProfessionalRecord;
      const batch = db.batch();
      batch.set(document.ref, {
        status: "inactive",
        isActive: false,
        trialStatus: "expired",
        updatedAtMs: now,
      }, { merge: true });
      if (professional.ownerUid) {
        batch.set(db.doc(`users/${professional.ownerUid}`), {
          status: "paused",
          lifecycleStatus: "inactive",
          updatedAtMs: now,
        }, { merge: true });
      }
      if (professional.publicSlug) {
        batch.set(db.doc(`publicProfiles/${professional.publicSlug}`), {
          active: false,
          status: "inactive",
          updatedAtMs: now,
        }, { merge: true });
      }
      await batch.commit();
      if (professional.ownerUid) {
        await auth.updateUser(professional.ownerUid, { disabled: true }).catch(() => undefined);
      }
    }
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
