import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  defineBoolean,
  defineSecret,
  defineString,
} from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
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
  canSuggestLeadStatusChange,
  generateBusinessAssistant,
  sanitizeAssistantText,
  scopeBusinessLeads,
} from "./assistant.js";
import {
  ASSISTANT_DEFINITIONS,
  ASSISTANT_PROMPT_VERSION,
  definitionIdForMode,
} from "./assistantDefinitions.js";
import {
  assistantEntitlement,
  assistantLimits,
  assistantModesForActor,
  planHasProfessionalAssistants,
  AssistantSettingsLike,
} from "./assistantEntitlements.js";
import {
  ANALYSIS_CACHE_TTL_MS,
  analysisCacheId,
  cachedAnalysisScores,
} from "./analysisCache.js";
import {
  isPlanPubliclyAvailable,
  monthKey,
  normalizePlan,
  photoValidationLimit,
  PLANS,
  PlanTier,
} from "./plans.js";
import {
  canStartAnotherTriage,
  nextTriageUsage,
  previousTriageUsage,
  triageUsageFields,
  triageUsageFromData,
} from "./triageUsage.js";
import {
  nextBillingDueAt,
  paidSubscriptionExpired,
  pendingSubscriptionFields,
  trialSubscriptionFields,
} from "./subscriptions.js";
import {
  activatePreparedTrialFields,
  canStartTrial,
  startTrialFields,
  trialStatusAt,
  TRIAL_DURATION_MS,
} from "./lifecycle.js";
import {
  accountStatusSchema,
  assistantActionDecisionSchema,
  assistantClientEventSchema,
  assistantFeedbackSchema,
  assistantRequestSchema,
  assistantSettingsSchema,
  assistantWorkspaceSchema,
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
  professionalAssistantSettingsSchema,
  professionalAssistantTargetSchema,
  professionalRestoreSchema,
  professionalSlugSchema,
  professionalTrialSchema,
  profilePatchSchema,
  customAssistantProfileSchema,
  slugify,
  startTriageSchema,
  teamMemberSchema,
  subscriptionIntentSchema,
} from "./validation.js";
import {
  AcquisitionSource,
  AttributionInput,
  classifyAcquisitionSource,
  sanitizeAttribution,
} from "./attribution.js";
import {
  funnelEventFields,
  funnelEventId,
  FunnelEventInput,
} from "./funnelMetrics.js";
import { assertSlugAllowed } from "./slug.js";
import {
  chooseDailyPostTemplate,
  dailyPostAssignmentDocumentId,
  DAILY_POST_LIBRARY_REVISION,
  localDateKey,
  SeedDailyPostTemplate,
} from "./dailyPostLibrary.js";
import {
  confirmInfinitePayReturnHandler,
  createInfinitePayCheckoutHandler,
  infinitePayWebhookHandler,
  type InfinitePayRuntime,
} from "./infinitePay.js";

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
const INFINITEPAY_HANDLE = defineString("INFINITEPAY_HANDLE", {
  default: "henry-augusto-pinheiro",
});
const PUBLIC_APP_URL = defineString("PUBLIC_APP_URL", {
  default: "https://sorvysmile.web.app",
});

setGlobalOptions({
  region: "southamerica-east1",
  maxInstances: 5,
  concurrency: 10,
});

function infinitePayRuntime(): InfinitePayRuntime {
  return {
    firestore: db,
    auth,
    getHandle: () => INFINITEPAY_HANDLE.value(),
    getPublicAppUrl: () => PUBLIC_APP_URL.value(),
    getProjectId: () => String(
      process.env.GCLOUD_PROJECT
      || process.env.GCP_PROJECT
      || process.env.GOOGLE_CLOUD_PROJECT
      || "",
    ),
    region: "southamerica-east1",
  };
}

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
  source?: AcquisitionSource;
  attribution?: AttributionInput;
}

interface AccountRecord {
  ownerUid: string;
  professionalId: string;
  plan: PlanTier | "elite";
  status: "pending" | "active" | "overdue" | "paused";
  slug: string;
  ownerType?: "dentist" | "clinic";
  trialStatus?: "not_started" | "ready" | "active" | "expired" | "converted";
  trialStartedAtMs?: number;
  trialEndsAtMs?: number;
  trialUntil?: number;
  trialEligible?: boolean;
  subscriptionStatus?: string;
  paymentStatus?: string;
  renewAtMs?: number;
  activatedAtMs?: number;
  statusBeforeArchive?: string;
  acquisitionSource?: AcquisitionSource;
  attributionFirstTouch?: AttributionInput;
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
  registrationNumber?: string;
  city?: string;
  state?: string;
  bio?: string;
  bioLink?: string;
  profileImage?: string;
  coverImage?: string;
  instagramHandle?: string;
  standardMessage?: string;
  templates?: string[];
  teamTag?: string;
  isOnDuty?: boolean;
  publicSlug?: string;
  isActive?: boolean;
  status?: "active" | "trial" | "subscriber" | "inactive" | "archived";
  trialStatus?: "not_started" | "ready" | "active" | "expired" | "converted";
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

function hasActiveAccountAccess(
  account: FirebaseFirestore.DocumentData | undefined,
  now = Date.now(),
): boolean {
  if (!account || account.status !== "active") return false;
  if (paidSubscriptionExpired(account, now)) return false;
  return trialStatusAt({
    trialStatus: account.trialStatus,
    trialStartedAtMs: account.trialStartedAtMs,
    trialEndsAtMs: account.trialEndsAtMs,
    trialUntil: account.trialUntil,
  }, now) !== "expired";
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
    || !hasActiveAccountAccess(account.data())
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
  | "assistant_requested"
  | "assistant_action_confirmed"
  | "assistant_settings_updated"
  | "professional_assistant_settings_updated"
  | "custom_assistant_updated";

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

function addFunnelEvent(writer: FirestoreWriter, input: FunnelEventInput): void {
  writer.set(
    db.doc(`funnelEvents/${funnelEventId(input.eventKey)}`),
    funnelEventFields(input),
    { merge: true },
  );
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
    if (!accountSnap.exists || !hasActiveAccountAccess(accountSnap.data())) {
      throw new HttpsError(
        "failed-precondition",
        "A assinatura deste link está inativa.",
      );
    }

    const sessionRef = db.collection("triageSessions").doc();
    const now = Date.now();
    const attribution = sanitizeAttribution(input.attribution);
    const source = classifyAcquisitionSource(attribution);
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
      source,
      attribution,
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
      if (!accountSnap.exists || !hasActiveAccountAccess(accountSnap.data())) {
        throw new HttpsError("failed-precondition", "Assinatura inativa.");
      }
      const plan = normalizePlan(accountSnap.data()?.plan);
      const triageUsage = triageUsageFromData(usageSnap.data());
      const validations = Number(usageSnap.data()?.photoValidations ?? 0);
      if (!canStartAnotherTriage(triageUsage, PLANS[plan].monthlyLeadLimit)) {
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
      if (!hasActiveAccountAccess(account)) {
        throw new HttpsError("failed-precondition", "Assinatura inativa.");
      }
      const plan = PLANS[normalizePlan(account.plan)];
      const triageUsage = triageUsageFromData(usageSnap.data());
      const cached = cachedAnalysisScores(cacheSnap.data());
      if (!canStartAnotherTriage(triageUsage, plan.monthlyLeadLimit)) {
        throw new HttpsError(
          "resource-exhausted",
          "O limite mensal de triagens deste plano foi atingido.",
        );
      }
      const nextUsage = nextTriageUsage(triageUsage);

      transaction.set(
        usageRef,
        {
          accountId: session.accountId,
          month: usageMonth,
          ...triageUsageFields(nextUsage.next),
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
          chargedThisTriage: nextUsage.chargedThisTriage,
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
    const currentUsage = triageUsageFromData(usageSnap.data());
    const restoredUsage = previousTriageUsage(
      currentUsage,
      reservation?.chargedThisTriage === true,
    );
    transaction.set(
      usageRef,
      {
        accountId,
        month,
        ...triageUsageFields(restoredUsage),
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
      const accountRef = db.doc(`accounts/${session.accountId}`);
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists) {
        throw new HttpsError("not-found", "Conta não encontrada.");
      }
      const account = accountSnap.data() as AccountRecord;
      const currentTrialStatus = trialStatusAt({
        trialStatus: account.trialStatus,
        trialStartedAtMs: account.trialStartedAtMs,
        trialEndsAtMs: account.trialEndsAtMs,
        trialUntil: account.trialUntil,
      }, now);
      if (account.status !== "active" || currentTrialStatus === "expired") {
        throw new HttpsError("failed-precondition", "O acesso deste profissional está inativo.");
      }
      const scores = session.scores as Record<string, unknown>;
      const source = session.source ?? "bio";
      const attribution = session.attribution ?? {};
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
        source,
        attribution,
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
      addFunnelEvent(transaction, {
        eventKey: `lead_captured:${leadRef.id}`,
        eventType: "lead_captured",
        accountId: session.accountId,
        professionalId: session.professionalId,
        leadId: leadRef.id,
        source,
        attribution,
        occurredAtMs: now,
      });
      const activatedTrial = activatePreparedTrialFields(account, now);
      if (activatedTrial) {
        const trial = activatedTrial;
        transaction.set(accountRef, {
          subscriptionStatus: "trial",
          trialActivatedBy: "first_lead",
          firstLeadCapturedAtMs: now,
          firstLeadId: leadRef.id,
          ...trial,
          updatedAtMs: now,
        }, { merge: true });
        transaction.set(db.doc(`professionals/${account.professionalId}`), {
          status: "trial",
          isActive: true,
          ...trial,
          updatedAtMs: now,
        }, { merge: true });
        transaction.set(db.doc(`users/${account.ownerUid}`), {
          status: "active",
          lifecycleStatus: "trial",
          updatedAtMs: now,
        }, { merge: true });
        transaction.set(db.doc(`publicProfiles/${account.slug}`), {
          active: true,
          status: "trial",
          trialEndsAtMs: trial.trialEndsAtMs,
          updatedAtMs: now,
        }, { merge: true });
        addAdminAudit(transaction, {
          actorUid: account.ownerUid,
          action: "professional_trial_started",
          accountId: session.accountId,
          professionalId: account.professionalId,
          details: { source: "first_lead", leadId: leadRef.id, trialEndsAtMs: trial.trialEndsAtMs },
          now,
        });
        addSubscriptionHistory(transaction, {
          actorUid: account.ownerUid,
          accountId: session.accountId,
          professionalId: account.professionalId,
          fromStatus: "trial_ready",
          toStatus: "trial",
          reason: "primeiro lead capturado",
          now,
        });
        addFunnelEvent(transaction, {
          eventKey: `trial_activated:${session.accountId}`,
          eventType: "trial_activated",
          accountId: session.accountId,
          professionalId: account.professionalId,
          leadId: leadRef.id,
          source: account.acquisitionSource ?? source,
          attribution: account.attributionFirstTouch ?? attribution,
          occurredAtMs: now,
          metadata: { activationTrigger: "first_lead", trialEndsAtMs: trial.trialEndsAtMs },
        });
      }
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
      addFunnelEvent(transaction, {
        eventKey: `${input.action}:${session.leadId}`,
        eventType: input.action,
        accountId: session.accountId,
        professionalId: session.professionalId,
        leadId: session.leadId,
        source: (lead.source as AcquisitionSource | undefined) ?? session.source ?? "bio",
        attribution: (lead.attribution as AttributionInput | undefined) ?? session.attribution,
        occurredAtMs: now,
      });
      return { ok: true };
    });
  },
);

export const createInfinitePayCheckout = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => createInfinitePayCheckoutHandler(
    request,
    infinitePayRuntime(),
  ),
);

export const confirmInfinitePayReturn = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => confirmInfinitePayReturnHandler(
    request,
    infinitePayRuntime(),
  ),
);

export const infinitePayWebhook = onRequest(
  { cors: false },
  async (request, response) => infinitePayWebhookHandler(
    request,
    response,
    infinitePayRuntime(),
  ),
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
    if (!isPlanPubliclyAvailable(plan)) {
      throw new HttpsError(
        "failed-precondition",
        "O plano Network estará disponível em breve. Escolha Lite ou Pro para continuar.",
      );
    }
    const accessRole = plan === "network" ? "clinic" : "professional";
    const isTrial = input.checkoutMode === "trial";
    const now = Date.now();
    const subscription = isTrial
      ? trialSubscriptionFields(input, now)
      : pendingSubscriptionFields(input, now);
    const incomingAttribution = sanitizeAttribution(input.attribution);
    const incomingSource = classifyAcquisitionSource(incomingAttribution);
    const accessStatus = isTrial ? "active" : "pending";
    const professionalStatus = isTrial ? "trial" : "inactive";
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
      if (!isTrial && account.data()?.status === "active") {
        throw new HttpsError(
          "already-exists",
          "Esta conta já possui uma assinatura ativa.",
        );
      }
      if (isTrial && (
        account.data()?.trialEligible === false
        || ![undefined, null, "not_started"].includes(account.data()?.trialStatus)
        || account.data()?.paymentStatus === "confirmed"
        || account.data()?.subscriptionStatus === "active"
      )) {
        throw new HttpsError(
          "already-exists",
          "Este acesso já utilizou o teste gratuito ou possui uma assinatura.",
        );
      }
      const batch = db.batch();
      const acquisitionSource = (account.data()?.acquisitionSource as AcquisitionSource | undefined) ?? incomingSource;
      const attributionFirstTouch = (account.data()?.attributionFirstTouch as AttributionInput | undefined) ?? incomingAttribution;
      batch.set(
        userRef,
        {
          email: input.email,
          role: accessRole,
          status: accessStatus,
          lifecycleStatus: isTrial ? "trial_ready" : "pending",
          updatedAtMs: now,
        },
        { merge: true },
      );
      batch.set(
        accountRef,
        {
          accountName: input.name,
          paymentReference: accountId,
          acquisitionSource,
          attributionFirstTouch,
          acquisitionCapturedAtMs: account.data()?.acquisitionCapturedAtMs ?? now,
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
          isActive: isTrial,
          status: professionalStatus,
          trialStatus: isTrial ? "ready" : "not_started",
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
          patientAssistant: publicPatientAssistantForProfile(professionalId, {
            name: input.name,
            specialty: input.specialty,
          }),
          active: isTrial,
          status: isTrial ? "trial" : "pending",
          updatedAtMs: now,
        },
        { merge: true },
      );
      addFunnelEvent(batch, {
        eventKey: `account_signup:${accountId}`,
        eventType: "account_signup",
        accountId,
        professionalId,
        source: acquisitionSource,
        attribution: attributionFirstTouch,
        occurredAtMs: Number(account.data()?.createdAtMs ?? now),
        metadata: { plan, checkoutMode: input.checkoutMode },
      });
      if (isTrial) {
        addFunnelEvent(batch, {
          eventKey: `trial_prepared:${accountId}`,
          eventType: "trial_prepared",
          accountId,
          professionalId,
          source: acquisitionSource,
          attribution: attributionFirstTouch,
          occurredAtMs: now,
          metadata: { plan },
        });
      }
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
        status: accessStatus,
        lifecycleStatus: isTrial ? "trial_ready" : "pending",
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
        acquisitionSource: incomingSource,
        attributionFirstTouch: incomingAttribution,
        acquisitionCapturedAtMs: now,
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
        isActive: isTrial,
        status: professionalStatus,
        trialStatus: isTrial ? "ready" : "not_started",
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
        patientAssistant: publicPatientAssistantForProfile(professionalId, {
          name: input.name,
          specialty: input.specialty,
        }),
        active: isTrial,
        status: isTrial ? "trial" : "pending",
        createdAtMs: now,
        updatedAtMs: now,
      });
      addFunnelEvent(batch, {
        eventKey: `account_signup:${accountId}`,
        eventType: "account_signup",
        accountId,
        professionalId,
        source: incomingSource,
        attribution: incomingAttribution,
        occurredAtMs: now,
        metadata: { plan, checkoutMode: input.checkoutMode },
      });
      if (isTrial) {
        addFunnelEvent(batch, {
          eventKey: `trial_prepared:${accountId}`,
          eventType: "trial_prepared",
          accountId,
          professionalId,
          source: incomingSource,
          attribution: incomingAttribution,
          occurredAtMs: now,
          metadata: { plan },
        });
      }
      await batch.commit();
    }

    if (!accountId || !professionalId || !slug) {
      throw new HttpsError("internal", "Não foi possível preparar a conta.");
    }
    await auth.updateUser(uid, { disabled: false }).catch(() => undefined);
    await auth.setCustomUserClaims(uid, {
      role: accessRole,
      accountId,
      professionalId,
      accountStatus: accessStatus,
      professionalStatus,
    });
    return {
      accountId,
      plan,
      slug,
      status: isTrial ? "active" as const : "pending" as const,
      trialStatus: isTrial ? "ready" as const : "not_started" as const,
    };
  },
);

export const recordSubscriptionIntent = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(subscriptionIntentSchema, request.data);
    const user = await readUser(uid);
    if (!user.accountId || !["professional", "clinic"].includes(user.role ?? "")) {
      throw new HttpsError("permission-denied", "Conta profissional não encontrada.");
    }
    const accountRef = db.doc(`accounts/${user.accountId}`);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists || accountSnap.data()?.ownerUid !== uid) {
      throw new HttpsError("permission-denied", "Apenas o responsável pela conta pode assinar.");
    }
    const account = accountSnap.data() as AccountRecord;
    const now = Date.now();
    const dateKey = new Date(now).toISOString().slice(0, 10);
    const batch = db.batch();
    batch.set(accountRef, {
      lastSubscriptionIntentAtMs: now,
      lastSubscriptionIntentContext: input.context,
      updatedAtMs: now,
    }, { merge: true });
    addFunnelEvent(batch, {
      eventKey: `subscription_cta_clicked:${user.accountId}:${input.context}:${dateKey}`,
      eventType: "subscription_cta_clicked",
      accountId: user.accountId,
      professionalId: account.professionalId,
      source: account.acquisitionSource ?? "bio",
      attribution: account.attributionFirstTouch,
      occurredAtMs: now,
      metadata: { context: input.context },
    });
    await batch.commit();
    return { ok: true };
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
    if (!accountSnap.exists || !hasActiveAccountAccess(accountSnap.data())) {
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
        name: input.name ?? professional?.name ?? "",
        specialty: input.specialty ?? professional?.specialty ?? "",
        registrationNumber: input.registrationNumber ?? professional?.registrationNumber ?? "",
        whatsapp: input.whatsapp,
        city: input.city,
        state: input.state,
        bio: input.bio,
        profileImage: input.profileImage,
        coverImage: input.coverImage ?? professional?.coverImage ?? "",
        instagramHandle: input.instagramHandle ?? professional?.instagramHandle ?? "",
        bioLink: input.bioLink,
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
    const fields = ["name", "specialty", "registrationNumber", "whatsapp", "city", "state", "bio", "bioLink", "standardMessage", "templates", "teamTag", "isOnDuty", "profileImage", "coverImage", "instagramHandle"] as const;
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
        registrationNumber: String(patch.registrationNumber ?? current.registrationNumber ?? ""),
        city: String(patch.city ?? current.city ?? ""),
        state: String(patch.state ?? current.state ?? ""),
        bio: String(patch.bio ?? current.bio ?? ""),
        profileImage: String(patch.profileImage ?? current.profileImage ?? ""),
        coverImage: String(patch.coverImage ?? current.coverImage ?? ""),
        instagramHandle: String(patch.instagramHandle ?? current.instagramHandle ?? ""),
        bioLink: String(patch.bioLink ?? current.bioLink ?? ""),
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
    if (slug) batch.set(db.doc(`publicProfiles/${slug}`), {
      active: true,
      status: "trial",
      trialEndsAtMs: trial.trialEndsAtMs,
      updatedAtMs: now,
    }, { merge: true });
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
    const currentRenewAtMs = Number(account.renewAtMs ?? 0);
    if (active && input.renewAtMs !== undefined && input.renewAtMs <= now) {
      throw new HttpsError(
        "invalid-argument",
        "O próximo vencimento deve ser uma data futura.",
      );
    }
    const renewAtMs = active
      ? nextBillingDueAt(currentRenewAtMs, input.renewAtMs, now)
      : currentRenewAtMs || null;
    const professionalRef = db.doc(
      `professionals/${account.professionalId}`,
    );
    const professionalSnap = await professionalRef.get();
    const professional = (professionalSnap.data() ?? {}) as ProfessionalRecord;
    const wasTrial = professional.status === "trial"
      || ["ready", "active", "expired"].includes(account.trialStatus ?? "");
    const isFirstActivation = active && !Number(account.activatedAtMs ?? 0);
    const nextProfessionalStatus = active ? "subscriber" : "inactive";

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
      subscriptionStatus: active ? "active" : input.status,
      trialStatus: wasTrial && active ? "converted" : account.trialStatus ?? "not_started",
      trialEligible: active ? false : account.trialEligible ?? false,
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
      paymentProvider: "infinitepay",
      billingMode: "checkout_integrated",
      billingInterval: "monthly",
      paymentConfirmedAtMs: active
        ? now
        : accountSnap.data()?.paymentConfirmedAtMs ?? null,
      paymentConfirmedBy: active
        ? uid
        : accountSnap.data()?.paymentConfirmedBy ?? null,
      renewAtMs,
      trialConvertedAtMs: wasTrial && active ? now : accountSnap.data()?.trialConvertedAtMs ?? null,
      timeToPaidMs: wasTrial && active && account.trialStartedAtMs
        ? Math.max(0, now - account.trialStartedAtMs)
        : accountSnap.data()?.timeToPaidMs ?? null,
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
        trialStatus: wasTrial && active ? "converted" : professional.trialStatus ?? "not_started",
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
        renewAtMs,
        updatedAtMs: now,
      },
      { merge: true },
    );
    addAdminAudit(batch, {
      actorUid: uid,
      action: "account_status_changed",
      accountId: input.accountId,
      professionalId: account.professionalId,
      details: {
        fromStatus: account.status,
        toStatus: input.status,
        plan,
        paymentProvider: "infinitepay",
        renewAtMs,
      },
      now,
    });
    addSubscriptionHistory(batch, {
      actorUid: uid,
      accountId: input.accountId,
      professionalId: account.professionalId,
      fromStatus: account.subscriptionStatus ?? account.status,
      toStatus: active ? "subscriber" : input.status,
      reason: active
        ? "pagamento confirmado na InfinitePay"
        : "alteração administrativa de assinatura",
      now,
    });
    if (isFirstActivation) {
      addFunnelEvent(batch, {
        eventKey: `subscription_activated:${input.accountId}`,
        eventType: "subscription_activated",
        accountId: input.accountId,
        professionalId: account.professionalId,
        source: account.acquisitionSource ?? "bio",
        attribution: account.attributionFirstTouch,
        occurredAtMs: now,
        metadata: { plan, provider: "infinitepay" },
      });
    }
    if (wasTrial && active) {
      addFunnelEvent(batch, {
        eventKey: `trial_converted:${input.accountId}`,
        eventType: "trial_converted",
        accountId: input.accountId,
        professionalId: account.professionalId,
        source: account.acquisitionSource ?? "bio",
        attribution: account.attributionFirstTouch,
        occurredAtMs: now,
        metadata: {
          plan,
          provider: "infinitepay",
          timeToPaidMs: account.trialStartedAtMs ? Math.max(0, now - account.trialStartedAtMs) : null,
        },
      });
    }
    await batch.commit();
    if (active) {
      await auth.updateUser(account.ownerUid, { disabled: false }).catch(() => undefined);
    }
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
        registrationNumber: professionalSnap.data()?.registrationNumber ?? "",
        city: professionalSnap.data()?.city ?? "",
        state: professionalSnap.data()?.state ?? "",
        bio: professionalSnap.data()?.bio ?? "",
        profileImage: professionalSnap.data()?.profileImage ?? "",
        coverImage: professionalSnap.data()?.coverImage ?? "",
        instagramHandle: professionalSnap.data()?.instagramHandle ?? "",
        bioLink: professionalSnap.data()?.bioLink ?? "",
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
      await db.collection("dailyPostEvents").add({ professionalId, accountId: professional.accountId ?? "", assignmentId: input.assignmentId, templateId: assignment.templateId, eventType: input.eventType, format: input.format, createdAtMs: now });
      return { ok: true, assignment: replacement };
    }
    if (input.eventType === "mark_as_used" && assignment.status === "used") {
      return { ok: true, assignment: { id: assignmentRef.id, ...assignment } };
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
    const updated = await assignmentRef.get();
    return {
      ok: true,
      assignment: updated.exists
        ? { id: updated.id, ...updated.data() }
        : { id: assignmentRef.id, ...assignment },
    };
  },
);

interface ResolvedAssistantAccess {
  uid: string;
  user: UserRecord;
  accountId: string;
  account: FirebaseFirestore.DocumentData;
  plan: PlanTier;
  settings: AssistantSettingsLike & FirebaseFirestore.DocumentData;
  usage: FirebaseFirestore.DocumentData;
  period: string;
  day: string;
  trialActive: boolean;
  trialExpired: boolean;
  entitlement: ReturnType<typeof assistantEntitlement>;
}

function assistantBlockMessage(reason: ReturnType<typeof assistantEntitlement>["reason"]): string {
  const messages = {
    plan: "A Sofia está disponível nos planos Pro e Network.",
    account: "A conta precisa estar ativa para usar a Sofia.",
    disabled: "A Sofia está desativada para esta conta. Fale com o suporte Sorvy.",
    monthly_limit: "O limite mensal da Sofia foi atingido.",
    daily_limit: "O limite diário da Sofia foi atingido. Tente novamente amanhã.",
    trial_limit: "O limite de interações do período de demonstração foi utilizado.",
    trial_expired: "O período de demonstração terminou. Ative o Pro ou Network para continuar usando a Sofia.",
    available: "",
  } as const;
  return messages[reason];
}

async function resolveAssistantAccess(uid: string, requestedAccountId?: string): Promise<ResolvedAssistantAccess> {
  const user = await readUser(uid);
  if (!user.role || !["hq", "clinic", "professional"].includes(user.role)) {
    throw new HttpsError("permission-denied", "Papel de acesso inválido para as assistentes.");
  }
  const accountId = user.role === "hq" ? requestedAccountId : user.accountId;
  if (!accountId) throw new HttpsError("invalid-argument", "Selecione uma conta.");
  if (user.role !== "hq" && user.accountId !== accountId) {
    throw new HttpsError("permission-denied", "Conta inválida.");
  }
  const accountSnap = await db.doc(`accounts/${accountId}`).get();
  if (!accountSnap.exists) throw new HttpsError("not-found", "Conta não encontrada.");
  const account = accountSnap.data()!;
  const plan = normalizePlan(account.plan);
  if (user.role === "clinic" && (account.ownerType !== "clinic" || plan !== "network")) {
    throw new HttpsError("permission-denied", "A gestão da Sofia exige o administrador de uma conta Network.");
  }
  if (user.role === "professional") {
    const professional = user.professionalId
      ? await db.doc(`professionals/${user.professionalId}`).get()
      : null;
    if (!professional?.exists || professional.data()?.isActive !== true || professional.data()?.accountId !== accountId) {
      throw new HttpsError("permission-denied", "O acesso profissional está inativo.");
    }
  }
  const now = Date.now();
  const period = monthKey(new Date(now));
  const day = new Date(now).toISOString().slice(0, 10);
  const [settingsSnap, usageSnap] = await Promise.all([
    db.doc(`accountAssistantSettings/${accountId}`).get(),
    db.doc(`assistantUsage/${accountId}_${period}`).get(),
  ]);
  const settings = (settingsSnap.data() ?? {}) as AssistantSettingsLike & FirebaseFirestore.DocumentData;
  const usage = usageSnap.data() ?? {};
  const trialEndsAt = Number(account.trialEndsAtMs ?? account.trialUntil ?? 0);
  const trialMarked = account.subscriptionStatus === "trial" || account.trialStatus === "active";
  const trialActive = trialMarked && trialEndsAt > now;
  const trialExpired = account.trialStatus === "expired" || (trialMarked && trialEndsAt <= now);
  const entitlement = assistantEntitlement({
    plan,
    accountActive: account.status === "active" && !trialExpired,
    trialActive,
    trialExpired,
    settings,
    usage: { ...usage, trialRequests: Number(settings.trialUsed ?? 0) },
    day,
  });
  return { uid, user, accountId, account, plan, settings, usage, period, day, trialActive, trialExpired, entitlement };
}

function publicEntitlement(access: ResolvedAssistantAccess): Record<string, unknown> {
  return {
    ...access.entitlement,
    plan: access.plan,
    trialActive: access.trialActive,
    trialExpired: access.trialExpired,
    period: access.period,
  };
}

async function recordAssistantAudit(input: {
  uid: string;
  accountId: string;
  professionalId?: string;
  assistantId: string;
  mode: string;
  eventType: string;
  status: "success" | "blocked" | "failed";
  conversationId?: string;
  actionId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.collection("assistantAuditLogs").add({
    ...input,
    professionalId: input.professionalId ?? null,
    conversationId: input.conversationId ?? null,
    actionId: input.actionId ?? null,
    details: input.details ?? {},
    createdAtMs: Date.now(),
  });
}

async function reserveAssistantInteraction(access: ResolvedAssistantAccess, mode: "management" | "conversion"): Promise<ReturnType<typeof assistantEntitlement>> {
  const settingsRef = db.doc(`accountAssistantSettings/${access.accountId}`);
  const usageRef = db.doc(`assistantUsage/${access.accountId}_${access.period}`);
  return db.runTransaction(async (transaction) => {
    const [settingsSnap, usageSnap] = await Promise.all([
      transaction.get(settingsRef),
      transaction.get(usageRef),
    ]);
    const settings = (settingsSnap.data() ?? access.settings) as AssistantSettingsLike & FirebaseFirestore.DocumentData;
    const enabledAssistants = Array.isArray(settings.enabledAssistants)
      ? settings.enabledAssistants
      : ["sofia-conversion", "sofia-management"];
    if (!assistantModesForActor(access.user.role ?? "professional", access.account.ownerType).includes(mode)) {
      throw new HttpsError("permission-denied", "Este modo da Sofia não está disponível para o seu papel.");
    }
    if (!enabledAssistants.includes(definitionIdForMode(mode))) {
      throw new HttpsError("failed-precondition", "Este modo da Sofia está desativado para a conta.");
    }
    const usage = usageSnap.data() ?? {};
    const current = assistantEntitlement({
      plan: access.plan,
      accountActive: access.account.status === "active",
      trialActive: access.trialActive,
      trialExpired: access.trialExpired,
      settings,
      usage: { ...usage, trialRequests: Number(settings.trialUsed ?? 0) },
      day: access.day,
    });
    if (!current.enabled) {
      const code = ["monthly_limit", "daily_limit", "trial_limit"].includes(current.reason)
        ? "resource-exhausted"
        : "failed-precondition";
      throw new HttpsError(code, assistantBlockMessage(current.reason));
    }
    const nextDailyUsage = { ...(usage.dailyUsage ?? {}), [access.day]: current.usedToday + 1 };
    transaction.set(usageRef, {
      accountId: access.accountId,
      period: access.period,
      requests: current.usedThisMonth + 1,
      dailyUsage: nextDailyUsage,
      inputTokens: Number(usage.inputTokens ?? 0),
      outputTokens: Number(usage.outputTokens ?? 0),
      estimatedCost: Number(usage.estimatedCost ?? 0),
      lastRequestAtMs: Date.now(),
      updatedAtMs: Date.now(),
    }, { merge: true });
    if (access.trialActive) {
      transaction.set(settingsRef, {
        accountId: access.accountId,
        trialUsed: current.usedInTrial + 1,
        updatedAtMs: Date.now(),
      }, { merge: true });
    }
    return assistantEntitlement({
      plan: access.plan,
      accountActive: true,
      trialActive: access.trialActive,
      trialExpired: access.trialExpired,
      settings: { ...settings, trialUsed: current.usedInTrial + (access.trialActive ? 1 : 0) },
      usage: {
        ...usage,
        requests: current.usedThisMonth + 1,
        dailyUsage: nextDailyUsage,
        trialRequests: current.usedInTrial + (access.trialActive ? 1 : 0),
      },
      day: access.day,
    });
  });
}

function leadCreatedAt(lead: FirebaseFirestore.DocumentData): number {
  return Number(lead.createdAtMs ?? lead.createdAt ?? 0);
}

function aggregateLeadMetrics(leads: FirebaseFirestore.DocumentData[]): Record<string, number> {
  const terminal = leads.filter((lead) => lead.status === "closed" || lead.status === "lost");
  const contacted = leads.filter((lead) => Number(lead.firstContactAt ?? 0) > 0);
  const converted = leads.filter((lead) => lead.status === "closed").length;
  const now = Date.now();
  return {
    leads: leads.length,
    new: leads.filter((lead) => lead.status === "new").length,
    inChat: leads.filter((lead) => lead.status === "in_chat").length,
    scheduled: leads.filter((lead) => lead.status === "scheduled").length,
    converted,
    lost: leads.filter((lead) => lead.status === "lost").length,
    conversionPercent: terminal.length ? Math.round((converted / terminal.length) * 100) : 0,
    contactRequests: leads.filter((lead) => Boolean(lead.contactRequestedAtMs)).length,
    withoutFirstContact: leads.filter((lead) => !Number(lead.firstContactAt ?? 0)).length,
    waitingOver24Hours: leads.filter((lead) => !Number(lead.firstContactAt ?? 0) && now - leadCreatedAt(lead) > 86_400_000).length,
    averageResponseMinutes: contacted.length
      ? Math.round(contacted.reduce((sum, lead) => sum + Math.max(0, Number(lead.firstContactAt) - leadCreatedAt(lead)), 0) / contacted.length / 60_000)
      : 0,
  };
}

async function buildAssistantContext(access: ResolvedAssistantAccess, mode: "management" | "conversion", leadId?: string): Promise<{
  context: Record<string, unknown>;
  selectedLead?: FirebaseFirestore.DocumentData & { id: string };
}> {
  const now = Date.now();
  const periodStart = now - 30 * 86_400_000;
  const previousPeriodStart = now - 60 * 86_400_000;
  const [leadSnapshot, professionalSnapshot, postEventsSnapshot] = await Promise.all([
    db.collection("leads").where("accountId", "==", access.accountId).orderBy("createdAtMs", "desc").limit(2000).get(),
    db.collection("professionals").where("accountId", "==", access.accountId).limit(100).get(),
    db.collection("dailyPostEvents")
      .where("accountId", "==", access.accountId)
      .where("createdAtMs", ">=", periodStart)
      .orderBy("createdAtMs", "desc")
      .limit(2000)
      .get(),
  ]);
  const accountLeads: Array<{ id: string } & FirebaseFirestore.DocumentData> = leadSnapshot.docs.map(
    (item) => ({ id: item.id, ...item.data() }),
  );
  const leads = scopeBusinessLeads(accountLeads, access.user.role, access.user.professionalId);
  const periodLeads = leads.filter((lead) => leadCreatedAt(lead) >= periodStart);
  const previousPeriodLeads = leads.filter((lead) => {
    const createdAt = leadCreatedAt(lead);
    return createdAt >= previousPeriodStart && createdAt < periodStart;
  });
  const periodMetrics = aggregateLeadMetrics(periodLeads);
  const previousPeriodMetrics = aggregateLeadMetrics(previousPeriodLeads);
  const scopedPostEvents = postEventsSnapshot.docs
    .map((item) => item.data())
    .filter((event) => access.user.role !== "professional" || event.professionalId === access.user.professionalId)
    .filter((event) => Number(event.createdAtMs ?? 0) >= periodStart);
  const context: Record<string, unknown> = {
    source: "SorvySmile operational aggregates",
    period: {
      label: "últimos 30 dias",
      from: new Date(periodStart).toISOString().slice(0, 10),
      to: new Date(now).toISOString().slice(0, 10),
    },
    scope: {
      role: access.user.role === "professional" ? "professional_own_data" : "clinic_account",
      recordsConsidered: leads.length,
      limitedToLatestAccountRecords: leadSnapshot.size === 2000,
    },
    account: { plan: access.plan, status: access.account.status },
    totalsGeneral: aggregateLeadMetrics(leads),
    totalsPeriod: periodMetrics,
    totalsPreviousPeriod: previousPeriodMetrics,
    trends: {
      leadVolumeDelta: periodMetrics.leads - previousPeriodMetrics.leads,
      convertedDelta: periodMetrics.converted - previousPeriodMetrics.converted,
      conversionPercentagePointDelta: periodMetrics.conversionPercent - previousPeriodMetrics.conversionPercent,
      comparison: "últimos 30 dias versus 30 dias anteriores",
    },
    contentUsagePeriod: {
      views: scopedPostEvents.filter((event) => event.eventType === "view").length,
      downloads: scopedPostEvents.filter((event) => String(event.eventType ?? "").startsWith("download_")).length,
      markedAsUsed: scopedPostEvents.filter((event) => event.eventType === "mark_as_used").length,
    },
    team: access.user.role === "professional"
      ? { professionals: 1, distributionAvailable: false }
      : {
          professionals: professionalSnapshot.size,
          distributionAvailable: true,
          distribution: professionalSnapshot.docs.map((professional, index) => {
            const professionalLeads = leads.filter((lead) => (lead.professionalId ?? lead.dentistId) === professional.id);
            return {
              label: `profissional_${index + 1}`,
              active: professional.data().isActive === true,
              leadsInPeriod: professionalLeads.filter((lead) => leadCreatedAt(lead) >= periodStart).length,
              openLeads: professionalLeads.filter((lead) => !["closed", "lost"].includes(lead.status)).length,
            };
          }),
        },
  };
  if (mode !== "conversion") return { context };
  if (!leadId) {
    context.priorityCandidates = leads
      .filter((lead) => !["closed", "lost"].includes(lead.status))
      .sort((a, b) => {
        const aPriority = (a.contactRequestedAtMs ? 2 : 0) + (!a.firstContactAt ? 1 : 0);
        const bPriority = (b.contactRequestedAtMs ? 2 : 0) + (!b.firstContactAt ? 1 : 0);
        return bPriority - aPriority || leadCreatedAt(a) - leadCreatedAt(b);
      })
      .slice(0, 10)
      .map((lead, index) => ({
        anonymousId: `lead_${index + 1}`,
        status: lead.status,
        ageHours: Math.max(0, Math.round((now - leadCreatedAt(lead)) / 3_600_000)),
        contactRequested: Boolean(lead.contactRequestedAtMs),
        firstContactRecorded: Boolean(lead.firstContactAt),
        scheduled: Boolean(lead.scheduledAt),
      }));
    return { context };
  }
  const selectedLead = leads.find((item) => item.id === leadId);
  if (!selectedLead) throw new HttpsError("not-found", "Lead não encontrado no escopo autorizado.");
  context.selectedLead = {
    anonymousId: "lead_selecionado",
    status: selectedLead.status,
    ageHours: Math.max(0, Math.round((now - leadCreatedAt(selectedLead)) / 3_600_000)),
    hoursSinceLastContact: Number(selectedLead.firstContactAt ?? 0)
      ? Math.max(0, Math.round((now - Number(selectedLead.firstContactAt)) / 3_600_000))
      : null,
    contactRequested: Boolean(selectedLead.contactRequestedAtMs),
    whatsappOpened: Boolean(selectedLead.patientOpenedWhatsAppAtMs),
    intentCategory: selectedLead.intentCategory ?? selectedLead.scores?.intentCategory ?? "",
    recommendedSpecialty: selectedLead.recommendedSpecialty ?? selectedLead.scores?.recommendedSpecialty ?? "",
    informativeVisualStatus: selectedLead.scores?.status ?? "",
    scheduled: Boolean(selectedLead.scheduledAt),
  };
  return { context, selectedLead };
}

export const getAssistantWorkspace = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(assistantWorkspaceSchema, request.data ?? {});
    const access = await resolveAssistantAccess(uid, input.accountId);
    const enabledAssistantIds = Array.isArray(access.settings.enabledAssistants)
      ? access.settings.enabledAssistants
      : ["sofia-conversion", "sofia-management"];
    const roleModes = assistantModesForActor(access.user.role ?? "professional", access.account.ownerType);
    const availableModes = roleModes.filter((mode) => enabledAssistantIds.includes(definitionIdForMode(mode)));
    const conversationsSnap = await db.collection("assistantConversations")
      .where("userId", "==", uid)
      .orderBy("lastInteractionAtMs", "desc")
      .limit(10)
      .get();
    const conversations = conversationsSnap.docs
      .filter((item) => item.data().accountId === access.accountId && availableModes.includes(item.data().mode))
      .map((item) => ({
        id: item.id,
        mode: item.data().mode,
        assistantDefinitionId: item.data().assistantDefinitionId,
        status: item.data().status ?? "active",
        startedAt: Number(item.data().startedAtMs ?? 0),
        lastInteractionAt: Number(item.data().lastInteractionAtMs ?? 0),
        preview: String(item.data().preview ?? ""),
      }));
    const activeConversationId = input.conversationId ?? conversations[0]?.id;
    const messages: Array<Record<string, unknown>> = [];
    if (activeConversationId) {
      const conversation = await db.doc(`assistantConversations/${activeConversationId}`).get();
      if (conversation.exists && conversation.data()?.userId === uid && conversation.data()?.accountId === access.accountId) {
        const messageSnap = await conversation.ref.collection("messages").orderBy("createdAtMs", "asc").limit(50).get();
        messages.push(...messageSnap.docs.map((item) => ({
          id: item.id,
          role: item.data().role,
          sanitizedContent: item.data().sanitizedContent,
          createdAt: Number(item.data().createdAtMs ?? 0),
          actionType: item.data().actionType ?? "",
          feedback: item.data().feedback ?? undefined,
        })));
      }
    }
    await recordAssistantAudit({
      uid,
      accountId: access.accountId,
      professionalId: access.user.professionalId,
      assistantId: "sofia",
      mode: "workspace",
      eventType: "assistant_opened",
      status: "success",
      conversationId: activeConversationId,
    });
    const enabledDefinitionIds = new Set(availableModes.map(definitionIdForMode));
    return {
      entitlement: availableModes.length > 0
        ? publicEntitlement(access)
        : { ...publicEntitlement(access), enabled: false, reason: "disabled" },
      definitions: ASSISTANT_DEFINITIONS.filter((item) => enabledDefinitionIds.has(item.id)),
      availableModes,
      conversations,
      messages,
      activeConversationId,
    };
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
    const access = await resolveAssistantAccess(uid, input.accountId);
    const operationalAssistant = await readProfessionalAssistantSettings(
      access.accountId,
      access.user.role === "professional" ? access.user.professionalId : undefined,
    );
    const assistantId = definitionIdForMode(input.mode);
    if (access.user.role === "professional" && !operationalAssistant.enabled) {
      throw new HttpsError("failed-precondition", "Sua assistente está desativada nas configurações do perfil.");
    }
    if (!access.entitlement.enabled) {
      await recordAssistantAudit({
        uid, accountId: access.accountId, professionalId: access.user.professionalId,
        assistantId, mode: input.mode, eventType: "limit_reached", status: "blocked",
        details: { reason: access.entitlement.reason },
      });
      const code = ["monthly_limit", "daily_limit", "trial_limit"].includes(access.entitlement.reason)
        ? "resource-exhausted"
        : "failed-precondition";
      throw new HttpsError(code, assistantBlockMessage(access.entitlement.reason));
    }
    if (!assistantModesForActor(access.user.role ?? "professional", access.account.ownerType).includes(input.mode)) {
      await recordAssistantAudit({
        uid, accountId: access.accountId, professionalId: access.user.professionalId,
        assistantId, mode: input.mode, eventType: "mode_blocked", status: "blocked",
        details: { role: access.user.role ?? "professional" },
      });
      throw new HttpsError("permission-denied", "Este modo da assistente não está disponível para o seu papel.");
    }
    const conversationRef = input.conversationId
      ? db.doc(`assistantConversations/${input.conversationId}`)
      : db.collection("assistantConversations").doc();
    if (input.conversationId) {
      const existing = await conversationRef.get();
      if (!existing.exists
        || existing.data()?.userId !== uid
        || existing.data()?.accountId !== access.accountId
        || existing.data()?.mode !== input.mode) {
        throw new HttpsError("permission-denied", "Conversa inválida para este contexto.");
      }
    }
    const { context, selectedLead } = await buildAssistantContext(access, input.mode, input.leadId);
    let reservedEntitlement: ReturnType<typeof assistantEntitlement>;
    try {
      reservedEntitlement = await reserveAssistantInteraction(access, input.mode);
    } catch (error) {
      await recordAssistantAudit({
        uid, accountId: access.accountId, professionalId: access.user.professionalId,
        assistantId, mode: input.mode, eventType: "limit_reached", status: "blocked",
        details: { reason: error instanceof Error ? error.message : "blocked" },
      });
      throw error;
    }
    try {
      const result = await generateBusinessAssistant(
        GEMINI_API_KEY.value(), GEMINI_MODEL.value(), input.mode, context, input.question,
        operationalAssistant,
      );
      const now = Date.now();
      const userMessageRef = conversationRef.collection("messages").doc();
      const assistantMessageRef = conversationRef.collection("messages").doc();
      const usageRef = db.doc(`assistantUsage/${access.accountId}_${access.period}`);
      const estimatedCost = (result.tokenUsage.inputTokens / 1_000_000) * Number(access.settings.inputTokenCostPerMillion ?? 0)
        + (result.tokenUsage.outputTokens / 1_000_000) * Number(access.settings.outputTokenCostPerMillion ?? 0);
      const actionRef = result.suggestedStatus && selectedLead
        && canSuggestLeadStatusChange(String(selectedLead.status ?? ""), result.suggestedStatus)
        ? db.collection("assistantActions").doc()
        : null;
      const batch = db.batch();
      batch.set(conversationRef, {
        accountId: access.accountId,
        professionalId: access.user.role === "professional" ? access.user.professionalId ?? null : null,
        assistantDefinitionId: assistantId,
        mode: input.mode,
        userId: uid,
        role: access.user.role,
        status: "active",
        ...(input.conversationId ? {} : { startedAtMs: now }),
        lastInteractionAtMs: now,
        promptVersion: ASSISTANT_PROMPT_VERSION,
        knowledgeVersion: result.knowledgeVersion,
        preview: result.headline,
      }, { merge: true });
      batch.set(userMessageRef, {
        role: "user",
        sanitizedContent: sanitizeAssistantText(input.question),
        createdAtMs: now,
        tokenUsage: { inputTokens: result.tokenUsage.inputTokens },
        model: result.model,
        actionType: "question",
      });
      batch.set(assistantMessageRef, {
        role: "assistant",
        sanitizedContent: sanitizeAssistantText(`${result.headline}\n\n${result.answer}`, 1400),
        createdAtMs: now,
        tokenUsage: result.tokenUsage,
        model: result.model,
        knowledgeVersion: result.knowledgeVersion,
        actionType: actionRef ? "action_proposed" : "response_generated",
      });
      batch.set(usageRef, {
        inputTokens: FieldValue.increment(result.tokenUsage.inputTokens),
        outputTokens: FieldValue.increment(result.tokenUsage.outputTokens),
        estimatedCost: FieldValue.increment(estimatedCost),
        model: result.model,
        lastRequestAtMs: now,
        updatedAtMs: now,
      }, { merge: true });
      if (actionRef && selectedLead) {
        batch.set(actionRef, {
          accountId: access.accountId,
          professionalId: access.user.role === "professional" ? access.user.professionalId ?? null : selectedLead.professionalId ?? selectedLead.dentistId ?? null,
          conversationId: conversationRef.id,
          assistantId,
          actorUid: uid,
          actionType: "update_lead_status",
          proposedPayload: {
            leadId: selectedLead.id,
            sourceStatus: selectedLead.status,
            targetStatus: result.suggestedStatus,
          },
          rationale: result.suggestionRationale,
          status: "proposed",
          createdAtMs: now,
        });
      }
      addAdminAudit(batch, { actorUid: uid, action: "assistant_requested", accountId: access.accountId, professionalId: access.user.professionalId, details: { mode: input.mode }, now });
      await batch.commit();
      const auditBase = {
        uid,
        accountId: access.accountId,
        professionalId: access.user.professionalId,
        assistantId,
        mode: input.mode,
        status: "success" as const,
        conversationId: conversationRef.id,
      };
      await Promise.all([
        recordAssistantAudit({ ...auditBase, eventType: "message_sent" }),
        recordAssistantAudit({ ...auditBase, eventType: "response_generated", actionId: actionRef?.id, details: { inputTokens: result.tokenUsage.inputTokens, outputTokens: result.tokenUsage.outputTokens } }),
        ...(input.conversationId ? [] : [recordAssistantAudit({ ...auditBase, eventType: "conversation_started" })]),
        ...(actionRef ? [recordAssistantAudit({ ...auditBase, eventType: "action_proposed", actionId: actionRef.id })] : []),
      ]);
      return {
        ...result,
        assistantName: operationalAssistant.name,
        mode: input.mode,
        leadId: selectedLead?.id,
        conversationId: conversationRef.id,
        messageId: assistantMessageRef.id,
        entitlement: {
          ...reservedEntitlement,
          plan: access.plan,
          trialActive: access.trialActive,
          trialExpired: access.trialExpired,
          period: access.period,
        },
        proposedAction: actionRef && selectedLead ? {
          id: actionRef.id,
          actionType: "update_lead_status",
          label: `Alterar status para ${result.suggestedStatus}`,
          rationale: result.suggestionRationale,
          targetStatus: result.suggestedStatus,
          status: "proposed",
        } : undefined,
        generatedAt: now,
      };
    } catch (error) {
      console.error("Falha na assistente profissional", describeAiFailure(error));
      await recordAssistantAudit({
        uid, accountId: access.accountId, professionalId: access.user.professionalId,
        assistantId, mode: input.mode, eventType: "assistant_error", status: "failed",
        conversationId: conversationRef.id,
      });
      throw new HttpsError("internal", "A assistente está temporariamente indisponível. Nenhuma ação foi executada.");
    }
  },
);

export const resolveAssistantAction = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(assistantActionDecisionSchema, request.data);
    const actionRef = db.doc(`assistantActions/${input.actionId}`);
    const actionSnap = await actionRef.get();
    if (!actionSnap.exists) throw new HttpsError("not-found", "Ação sugerida não encontrada.");
    const action = actionSnap.data()!;
    if (action.actorUid !== uid || action.status !== "proposed") {
      throw new HttpsError("permission-denied", "Esta ação não pode ser alterada.");
    }
    const access = await resolveAssistantAccess(uid, action.accountId);
    if (["plan", "account", "disabled", "trial_expired"].includes(access.entitlement.reason)) {
      throw new HttpsError("failed-precondition", assistantBlockMessage(access.entitlement.reason));
    }
    if (input.decision === "cancel") {
      const cancelledAtMs = Date.now();
      await db.runTransaction(async (transaction) => {
        const freshAction = await transaction.get(actionRef);
        if (!freshAction.exists || freshAction.data()?.actorUid !== uid || freshAction.data()?.status !== "proposed") {
          throw new HttpsError("failed-precondition", "Esta ação já foi resolvida.");
        }
        transaction.set(actionRef, { status: "cancelled", cancelledAtMs, updatedAtMs: cancelledAtMs }, { merge: true });
      });
      await recordAssistantAudit({ uid, accountId: access.accountId, professionalId: access.user.professionalId, assistantId: action.assistantId, mode: "conversion", eventType: "action_cancelled", status: "success", conversationId: action.conversationId, actionId: input.actionId });
      return { ok: true, status: "cancelled" };
    }
    const leadId = String(action.proposedPayload?.leadId ?? "");
    const sourceStatus = String(action.proposedPayload?.sourceStatus ?? "");
    const targetStatus = String(action.proposedPayload?.targetStatus ?? "");
    if (!leadId || !["new", "in_chat", "scheduled", "closed", "lost"].includes(targetStatus)) {
      throw new HttpsError("failed-precondition", "A ação sugerida está inválida.");
    }
    const leadRef = db.doc(`leads/${leadId}`);
    const now = Date.now();
    const executed = await db.runTransaction(async (transaction) => {
      const [freshAction, leadSnap] = await Promise.all([
        transaction.get(actionRef),
        transaction.get(leadRef),
      ]);
      if (!freshAction.exists || freshAction.data()?.actorUid !== uid || freshAction.data()?.status !== "proposed") {
        throw new HttpsError("failed-precondition", "Esta ação já foi resolvida.");
      }
      if (!leadSnap.exists || leadSnap.data()?.accountId !== access.accountId) {
        throw new HttpsError("permission-denied", "Lead fora da conta autorizada.");
      }
      if (access.user.role === "professional"
        && (leadSnap.data()?.professionalId ?? leadSnap.data()?.dentistId) !== access.user.professionalId) {
        throw new HttpsError("permission-denied", "Lead fora do escopo profissional.");
      }
      if (sourceStatus && leadSnap.data()?.status !== sourceStatus) {
        transaction.set(actionRef, {
          status: "failed",
          failureReason: "lead_status_changed",
          failedAtMs: now,
          updatedAtMs: now,
        }, { merge: true });
        return false;
      }
      transaction.set(leadRef, { status: targetStatus, updatedAtMs: now }, { merge: true });
      transaction.set(actionRef, { status: "executed", confirmedAtMs: now, confirmedBy: uid, executedAtMs: now, updatedAtMs: now }, { merge: true });
      addAdminAudit(transaction, { actorUid: uid, action: "assistant_action_confirmed", accountId: access.accountId, professionalId: access.user.professionalId, details: { actionId: input.actionId, sourceStatus, targetStatus }, now });
      return true;
    });
    if (!executed) {
      await recordAssistantAudit({ uid, accountId: access.accountId, professionalId: access.user.professionalId, assistantId: action.assistantId, mode: "conversion", eventType: "action_conflict", status: "failed", conversationId: action.conversationId, actionId: input.actionId });
      throw new HttpsError("failed-precondition", "O status do lead mudou depois da sugestão. Peça uma nova análise antes de aplicar.");
    }
    await recordAssistantAudit({ uid, accountId: access.accountId, professionalId: access.user.professionalId, assistantId: action.assistantId, mode: "conversion", eventType: "action_confirmed", status: "success", conversationId: action.conversationId, actionId: input.actionId });
    return { ok: true, status: "executed", leadId, targetStatus };
  },
);

export const recordAssistantFeedback = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(assistantFeedbackSchema, request.data);
    const conversationRef = db.doc(`assistantConversations/${input.conversationId}`);
    const conversation = await conversationRef.get();
    if (!conversation.exists || conversation.data()?.userId !== uid) {
      throw new HttpsError("permission-denied", "Conversa inválida.");
    }
    const messageRef = conversationRef.collection("messages").doc(input.messageId);
    const message = await messageRef.get();
    if (!message.exists || message.data()?.role !== "assistant") {
      throw new HttpsError("not-found", "Resposta não encontrada.");
    }
    await messageRef.set({ feedback: input.feedback, feedbackAtMs: Date.now() }, { merge: true });
    await recordAssistantAudit({ uid, accountId: conversation.data()!.accountId, professionalId: conversation.data()!.professionalId, assistantId: conversation.data()!.assistantDefinitionId, mode: conversation.data()!.mode, eventType: input.feedback === "positive" ? "feedback_positive" : "feedback_negative", status: "success", conversationId: input.conversationId });
    return { ok: true };
  },
);

export const recordAssistantClientEvent = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(assistantClientEventSchema, request.data);
    const conversation = await db.doc(`assistantConversations/${input.conversationId}`).get();
    if (!conversation.exists || conversation.data()?.userId !== uid) {
      throw new HttpsError("permission-denied", "Conversa inválida.");
    }
    await recordAssistantAudit({
      uid,
      accountId: conversation.data()!.accountId,
      professionalId: conversation.data()!.professionalId,
      assistantId: conversation.data()!.assistantDefinitionId,
      mode: conversation.data()!.mode,
      eventType: input.eventType,
      status: "success",
      conversationId: input.conversationId,
    });
    return { ok: true };
  },
);

const PROFESSIONAL_ASSISTANT_TONES = [
  "professional_warm",
  "direct_clinical",
  "empathetic_educational",
  "casual_friendly",
] as const;

type ProfessionalAssistantTone = typeof PROFESSIONAL_ASSISTANT_TONES[number];

interface ProfessionalAssistantSettingsRecord {
  accountId: string;
  professionalId: string;
  enabled: boolean;
  name: string;
  tone: ProfessionalAssistantTone;
  serviceContext: string;
  updatedAt?: number;
}

function professionalAssistantSettingsFromData(
  accountId: string,
  professionalId: string,
  data?: FirebaseFirestore.DocumentData,
): ProfessionalAssistantSettingsRecord {
  const tone = PROFESSIONAL_ASSISTANT_TONES.includes(data?.tone)
    ? data?.tone as ProfessionalAssistantTone
    : "professional_warm";
  return {
    accountId,
    professionalId,
    enabled: data?.enabled !== false,
    name: String(data?.name ?? "Sofia").trim().slice(0, 40) || "Sofia",
    tone,
    serviceContext: String(data?.serviceContext ?? "").trim().slice(0, 2000),
    updatedAt: Number(data?.updatedAtMs ?? 0) || undefined,
  };
}

function publicPatientAssistantForProfile(
  professionalId: string,
  professional: Pick<ProfessionalRecord, "name" | "specialty">,
  settings?: Pick<ProfessionalAssistantSettingsRecord, "tone" | "serviceContext">,
): Record<string, unknown> {
  const professionalName = String(professional.name ?? "o profissional responsável").trim()
    || "o profissional responsável";
  const specialty = String(professional.specialty ?? "").trim();
  const tone = settings?.tone ?? "professional_warm";
  const greetingByTone: Record<ProfessionalAssistantTone, string> = {
    professional_warm: `Olá, eu sou a Aury, assistente virtual de ${professionalName}. Vou explicar a experiência e ajudar você a seguir com tranquilidade antes de falar com ${professionalName}.`,
    direct_clinical: `Olá, eu sou a Aury, assistente virtual de ${professionalName}. Vou orientar os próximos passos da sua triagem e como falar com ${professionalName}.`,
    empathetic_educational: `Olá, eu sou a Aury, assistente virtual de ${professionalName}. Estou aqui para explicar cada etapa com calma e ajudar você a chegar à conversa com mais clareza.`,
    casual_friendly: `Oi, eu sou a Aury, assistente virtual de ${professionalName}. Posso explicar a experiência e mostrar como falar com ${professionalName} quando você quiser.`,
  };
  return {
    id: `aury_${professionalId}`,
    name: "Aury",
    roleName: `Assistente virtual de ${professionalName}`,
    description: `Esta é a experiência de ${professionalName}${specialty ? ` · ${specialty}` : ""}.`,
    greeting: greetingByTone[tone],
    avatarUrl: "",
    fullImageUrl: "",
    primaryColor: "#18AFA5",
    secondaryColor: "#DDF4F6",
    ctaText: `Falar com ${professionalName}`,
    // Deliberately blank. The client always builds the destination from the
    // profile WhatsApp tied to the current public slug.
    ctaLink: "",
    isCustom: false,
    tone,
    serviceContext: String(settings?.serviceContext ?? "").trim().slice(0, 2000),
  };
}

async function requireProfessionalAssistantTarget(
  uid: string,
  accountId: string,
  professionalId: string,
): Promise<void> {
  const actor = await readUser(uid);
  const ownsProfile = actor.role === "professional"
    && actor.accountId === accountId
    && actor.professionalId === professionalId;
  if (actor.role !== "hq" && !ownsProfile) {
    throw new HttpsError("permission-denied", "Você só pode configurar sua própria assistente.");
  }
  const [account, professional] = await Promise.all([
    db.doc(`accounts/${accountId}`).get(),
    db.doc(`professionals/${professionalId}`).get(),
  ]);
  if (!account.exists || !professional.exists || professional.data()?.accountId !== accountId) {
    throw new HttpsError("not-found", "Conta ou profissional não encontrado.");
  }
  if (!planHasProfessionalAssistants(normalizePlan(account.data()?.plan))) {
    throw new HttpsError("failed-precondition", "A assistente personalizada está disponível nos planos Pro e Network.");
  }
  if (ownsProfile && (account.data()?.status !== "active" || professional.data()?.isActive !== true)) {
    throw new HttpsError("failed-precondition", "A conta e o perfil profissional precisam estar ativos.");
  }
}

async function readProfessionalAssistantSettings(
  accountId: string,
  professionalId?: string,
): Promise<ProfessionalAssistantSettingsRecord> {
  if (!professionalId) return professionalAssistantSettingsFromData(accountId, "clinic");
  const snap = await db.doc(`professionalAssistantSettings/${professionalId}`).get();
  return professionalAssistantSettingsFromData(accountId, professionalId, snap.data());
}

export const getProfessionalAssistantSettings = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(professionalAssistantTargetSchema, request.data);
    await requireProfessionalAssistantTarget(uid, input.accountId, input.professionalId);
    return readProfessionalAssistantSettings(input.accountId, input.professionalId);
  },
);

export const updateProfessionalAssistantSettings = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    const input = parseInput(professionalAssistantSettingsSchema, request.data);
    await requireProfessionalAssistantTarget(uid, input.accountId, input.professionalId);
    const now = Date.now();
    const ref = db.doc(`professionalAssistantSettings/${input.professionalId}`);
    const [existing, professionalSnap] = await Promise.all([
      ref.get(),
      db.doc(`professionals/${input.professionalId}`).get(),
    ]);
    if (!professionalSnap.exists) {
      throw new HttpsError("not-found", "Profissional não encontrado.");
    }
    const professional = professionalSnap.data() as ProfessionalRecord;
    const publicSlug = String(professional.publicSlug ?? "").trim();
    const publicProfileRef = publicSlug
      ? db.doc(`publicProfiles/${publicSlug}`)
      : null;
    const publicProfile = publicProfileRef
      ? await publicProfileRef.get()
      : null;
    const batch = db.batch();
    batch.set(ref, {
      accountId: input.accountId,
      professionalId: input.professionalId,
      enabled: input.enabled,
      name: input.name,
      tone: input.tone,
      serviceContext: input.serviceContext,
      createdAtMs: existing.data()?.createdAtMs ?? FieldValue.serverTimestamp(),
      createdBy: existing.data()?.createdBy ?? uid,
      updatedAtMs: now,
      updatedBy: uid,
    }, { merge: true });
    if (publicProfileRef && publicProfile?.exists && publicProfile.data()?.patientAssistant?.isCustom !== true) {
      batch.set(publicProfileRef, {
        patientAssistant: publicPatientAssistantForProfile(input.professionalId, professional, input),
        updatedAtMs: now,
      }, { merge: true });
    }
    addAdminAudit(batch, {
      actorUid: uid,
      action: "professional_assistant_settings_updated",
      accountId: input.accountId,
      professionalId: input.professionalId,
      details: { enabled: input.enabled, tone: input.tone, hasServiceContext: Boolean(input.serviceContext) },
      now,
    });
    await batch.commit();
    return professionalAssistantSettingsFromData(input.accountId, input.professionalId, {
      ...input,
      updatedAtMs: now,
    });
  },
);

export const getAssistantAdminSettings = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(assistantWorkspaceSchema, request.data ?? {});
    if (!input.accountId) throw new HttpsError("invalid-argument", "Selecione uma conta.");
    const customId = input.professionalId
      ? `custom_${input.accountId}_${input.professionalId}`
      : `custom_${input.accountId}`;
    const [settingsSnap, customSnap] = await Promise.all([
      db.doc(`accountAssistantSettings/${input.accountId}`).get(),
      db.doc(`customAssistantProfiles/${customId}`).get(),
    ]);
    const settings = settingsSnap.data() ?? {};
    return {
      accountId: input.accountId,
      enabled: settings.enabled !== false,
      enabledAssistants: settings.enabledAssistants ?? ["sofia-conversion", "sofia-management"],
      ...assistantLimits(settings),
      inputTokenCostPerMillion: Number(settings.inputTokenCostPerMillion ?? 0),
      outputTokenCostPerMillion: Number(settings.outputTokenCostPerMillion ?? 0),
      customAssistant: customSnap.exists ? { id: customSnap.id, ...customSnap.data() } : null,
    };
  },
);

export const getAssistantAdminOverview = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const period = monthKey();
    const periodStart = Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1);
    const [usageSnap, auditSnap] = await Promise.all([
      db.collection("assistantUsage").where("period", "==", period).limit(1000).get(),
      db.collection("assistantAuditLogs").where("createdAtMs", ">=", periodStart).limit(2000).get(),
    ]);
    const audits = auditSnap.docs.map((item) => item.data());
    return {
      period,
      accountsUsed: new Set(usageSnap.docs.map((item) => item.data().accountId)).size,
      interactions: usageSnap.docs.reduce((sum, item) => sum + Number(item.data().requests ?? 0), 0),
      inputTokens: usageSnap.docs.reduce((sum, item) => sum + Number(item.data().inputTokens ?? 0), 0),
      outputTokens: usageSnap.docs.reduce((sum, item) => sum + Number(item.data().outputTokens ?? 0), 0),
      estimatedCost: usageSnap.docs.reduce((sum, item) => sum + Number(item.data().estimatedCost ?? 0), 0),
      actionsProposed: audits.filter((item) => item.eventType === "action_proposed").length,
      actionsConfirmed: audits.filter((item) => item.eventType === "action_confirmed").length,
      positiveFeedback: audits.filter((item) => item.eventType === "feedback_positive").length,
      negativeFeedback: audits.filter((item) => item.eventType === "feedback_negative").length,
      blocked: audits.filter((item) => item.status === "blocked").length,
      errors: audits.filter((item) => item.status === "failed").length,
    };
  },
);

export const updateAssistantSettings = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(assistantSettingsSchema, request.data);
    const settingsRef = db.doc(`accountAssistantSettings/${input.accountId}`);
    const [account, existingSettings] = await Promise.all([
      db.doc(`accounts/${input.accountId}`).get(),
      settingsRef.get(),
    ]);
    if (!account.exists) throw new HttpsError("not-found", "Conta não encontrada.");
    const now = Date.now();
    const batch = db.batch();
    batch.set(settingsRef, {
      accountId: input.accountId,
      enabled: input.enabled,
      enabledAssistants: input.enabledAssistants,
      monthlyLimit: input.monthlyLimit,
      dailyLimit: input.dailyLimit,
      trialLimit: input.trialLimit,
      inputTokenCostPerMillion: input.inputTokenCostPerMillion,
      outputTokenCostPerMillion: input.outputTokenCostPerMillion,
      updatedAtMs: now,
      updatedBy: uid,
      createdAtMs: existingSettings.data()?.createdAtMs ?? FieldValue.serverTimestamp(),
      createdBy: existingSettings.data()?.createdBy ?? uid,
    }, { merge: true });
    addAdminAudit(batch, { actorUid: uid, action: "assistant_settings_updated", accountId: input.accountId, details: { enabled: input.enabled, monthlyLimit: input.monthlyLimit, dailyLimit: input.dailyLimit, trialLimit: input.trialLimit, inputTokenCostPerMillion: input.inputTokenCostPerMillion, outputTokenCostPerMillion: input.outputTokenCostPerMillion }, now });
    await batch.commit();
    return { ok: true };
  },
);

function publicAssistantFromCustomProfile(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): Record<string, unknown> | null {
  if (!data || data.status !== "active") return null;
  return {
    id,
    name: String(data.name ?? "Aury"),
    roleName: String(data.roleName ?? "Guia virtual"),
    description: String(data.description ?? ""),
    greeting: String(data.greeting ?? ""),
    avatarUrl: String(data.avatarUrl ?? ""),
    fullImageUrl: String(data.fullImageUrl ?? ""),
    assetVersion: Number(data.assetVersion ?? 1),
    avatarOrigin: data.avatarUrl ? "hq_approved_url" : "none",
    primaryColor: String(data.primaryColor ?? "#18AFA5"),
    secondaryColor: String(data.secondaryColor ?? "#DDF4F6"),
    ctaText: String(data.ctaText ?? "Falar com a clínica"),
    ctaLink: String(data.ctaLink ?? ""),
    isCustom: true,
  };
}

function assistantAssetMetadata(value: string): { name: string; origin: string } {
  if (!value) return { name: "", origin: "none" };
  try {
    const url = new URL(value);
    const decodedPath = decodeURIComponent(url.pathname);
    return {
      name: decodedPath.split("/").filter(Boolean).at(-1) ?? "approved-asset",
      origin: url.hostname.includes("firebasestorage.googleapis.com") ? "sorvy_storage" : "hq_approved_url",
    };
  } catch {
    return { name: "approved-asset", origin: "hq_approved_url" };
  }
}

export const updateCustomAssistantProfile = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = requireUid(request);
    await requireHq(uid);
    const input = parseInput(customAssistantProfileSchema, request.data);
    const account = await db.doc(`accounts/${input.accountId}`).get();
    if (!account.exists) throw new HttpsError("not-found", "Conta não encontrada.");
    if (input.enabled && !planHasProfessionalAssistants(normalizePlan(account.data()?.plan))) {
      throw new HttpsError("failed-precondition", "A identidade personalizada está disponível nos planos Pro e Network.");
    }
    if (input.professionalId) {
      const professional = await db.doc(`professionals/${input.professionalId}`).get();
      if (!professional.exists || professional.data()?.accountId !== input.accountId) {
        throw new HttpsError("permission-denied", "Profissional fora da conta selecionada.");
      }
    }
    const now = Date.now();
    const customId = input.professionalId
      ? `custom_${input.accountId}_${input.professionalId}`
      : `custom_${input.accountId}`;
    const customRef = db.doc(`customAssistantProfiles/${customId}`);
    const [existingCustom, accountCustom, accountOverrides] = await Promise.all([
      customRef.get(),
      input.professionalId
        ? db.doc(`customAssistantProfiles/custom_${input.accountId}`).get()
        : Promise.resolve(null),
      input.professionalId
        ? Promise.resolve(null)
        : db.collection("customAssistantProfiles").where("accountId", "==", input.accountId).get(),
    ]);
    const assetVersion = Number(existingCustom.data()?.assetVersion ?? 0) + 1;
    const avatarAsset = assistantAssetMetadata(input.avatarUrl);
    const fullImageAsset = assistantAssetMetadata(input.fullImageUrl);
    const safePublicProfile = input.enabled ? {
      id: customId,
      name: input.name,
      roleName: input.roleName,
      description: input.description,
      greeting: input.greeting,
      avatarUrl: input.avatarUrl,
      fullImageUrl: input.fullImageUrl,
      assetVersion,
      avatarOrigin: avatarAsset.origin,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      ctaText: input.ctaText,
      ctaLink: input.ctaLink,
      isCustom: true,
    } : null;
    const inheritedPublicProfile = accountCustom
      ? publicAssistantFromCustomProfile(accountCustom.id, accountCustom.data())
      : null;
    const activeProfessionalOverrides = new Set(
      accountOverrides?.docs
        .filter((item) => item.data().professionalId && item.data().status === "active")
        .map((item) => String(item.data().professionalId))
        ?? [],
    );
    const profiles = await db.collection("publicProfiles").where("accountId", "==", input.accountId).get();
    const batch = db.batch();
    batch.set(customRef, {
      id: customId,
      accountId: input.accountId,
      professionalId: input.professionalId ?? null,
      name: input.name,
      roleName: input.roleName,
      description: input.description,
      greeting: input.greeting,
      avatarUrl: input.avatarUrl,
      fullImageUrl: input.fullImageUrl,
      assetVersion,
      avatarAssetName: avatarAsset.name,
      avatarOrigin: avatarAsset.origin,
      fullImageAssetName: fullImageAsset.name,
      fullImageOrigin: fullImageAsset.origin,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      tone: input.tone,
      vocabulary: input.vocabulary,
      institutionalContext: input.institutionalContext,
      approvedKnowledgeTags: input.approvedKnowledgeTags,
      ctaText: input.ctaText,
      ctaLink: input.ctaLink,
      status: input.enabled ? "active" : "inactive",
      createdBy: existingCustom.data()?.createdBy ?? uid,
      updatedAtMs: now,
      createdAtMs: existingCustom.data()?.createdAtMs ?? FieldValue.serverTimestamp(),
    }, { merge: true });
    if (!input.professionalId) {
      batch.set(db.doc(`accountAssistantSettings/${input.accountId}`), {
        accountId: input.accountId,
        customAssistantEnabled: input.enabled,
        customAssistantId: customId,
        updatedAtMs: now,
      }, { merge: true });
    }
    for (const profile of profiles.docs) {
      if (input.professionalId && profile.data().professionalId !== input.professionalId) continue;
      if (!input.professionalId && activeProfessionalOverrides.has(String(profile.data().professionalId ?? ""))) continue;
      batch.set(profile.ref, {
        patientAssistant: safePublicProfile ?? inheritedPublicProfile,
        updatedAtMs: now,
      }, { merge: true });
    }
    addAdminAudit(batch, { actorUid: uid, action: "custom_assistant_updated", accountId: input.accountId, professionalId: input.professionalId, details: { customId, enabled: input.enabled }, now });
    await batch.commit();
    return { ok: true, customAssistantId: customId };
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
      trialEndsAtMs: trial.trialEndsAtMs,
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
    schedule: "every 60 minutes",
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
      const accountRef = professional.accountId
        ? db.doc(`accounts/${professional.accountId}`)
        : null;
      const accountSnap = accountRef ? await accountRef.get() : null;
      const account = accountSnap?.data() as AccountRecord | undefined;
      const batch = db.batch();
      batch.set(document.ref, {
        status: "inactive",
        isActive: false,
        trialStatus: "expired",
        updatedAtMs: now,
      }, { merge: true });
      if (professional.ownerUid) {
        batch.set(db.doc(`users/${professional.ownerUid}`), {
          status: "trial_expired",
          lifecycleStatus: "trial_expired",
          updatedAtMs: now,
        }, { merge: true });
      }
      if (accountRef) {
        batch.set(accountRef, {
          status: "paused",
          isActive: false,
          subscriptionStatus: "trial_expired",
          trialStatus: "expired",
          updatedAtMs: now,
        }, { merge: true });
      }
      const publicSlug = professional.publicSlug ?? account?.slug;
      if (publicSlug) {
        batch.set(db.doc(`publicProfiles/${publicSlug}`), {
          active: false,
          status: "trial_expired",
          updatedAtMs: now,
        }, { merge: true });
      }
      if (professional.accountId) {
        addSubscriptionHistory(batch, {
          actorUid: "system",
          accountId: professional.accountId,
          professionalId: document.id,
          fromStatus: "trial",
          toStatus: "trial_expired",
          reason: "fim automático do teste de 7 dias",
          now,
        });
        addFunnelEvent(batch, {
          eventKey: `trial_expired:${professional.accountId}`,
          eventType: "trial_expired",
          accountId: professional.accountId,
          professionalId: document.id,
          source: account?.acquisitionSource ?? "bio",
          attribution: account?.attributionFirstTouch,
          occurredAtMs: now,
          metadata: { trialEndsAtMs: professional.trialEndsAtMs ?? null },
        });
      }
      await batch.commit();
      if (professional.ownerUid) {
        await auth.setCustomUserClaims(professional.ownerUid, {
          role: account?.ownerType === "clinic" ? "clinic" : "professional",
          accountId: professional.accountId,
          professionalId: document.id,
          accountStatus: "paused",
          professionalStatus: "inactive",
        }).catch(() => undefined);
      }
    }
  },
);

export const expirePaidSubscriptions = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const now = Date.now();
    const snapshot = await db
      .collection("accounts")
      .where("subscriptionStatus", "==", "active")
      .where("renewAtMs", "<", now)
      .limit(500)
      .get();

    for (const document of snapshot.docs) {
      const expiration = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(document.ref);
        if (!currentSnapshot.exists) return null;

        const account = currentSnapshot.data() as AccountRecord;
        if (!paidSubscriptionExpired(account, now)) return null;

        const professionalId = String(account.professionalId ?? "");
        const ownerUid = String(account.ownerUid ?? "");
        const professionalRef = professionalId
          ? db.doc(`professionals/${professionalId}`)
          : null;
        const professionalSnapshot = professionalRef
          ? await transaction.get(professionalRef)
          : null;
        const publicSlug = String(
          professionalSnapshot?.data()?.publicSlug ?? account.slug ?? "",
        );

        transaction.set(document.ref, {
          status: "overdue",
          isActive: false,
          subscriptionStatus: "overdue",
          paymentStatus: "overdue",
          overdueAtMs: now,
          updatedAtMs: now,
        }, { merge: true });
        if (ownerUid) {
          transaction.set(db.doc(`users/${ownerUid}`), {
            status: "overdue",
            lifecycleStatus: "overdue",
            updatedAtMs: now,
          }, { merge: true });
        }
        if (professionalRef && professionalSnapshot?.exists) {
          transaction.set(professionalRef, {
            status: "inactive",
            isActive: false,
            updatedAtMs: now,
          }, { merge: true });
        }
        if (publicSlug) {
          transaction.set(db.doc(`publicProfiles/${publicSlug}`), {
            active: false,
            status: "overdue",
            renewAtMs: account.renewAtMs ?? null,
            updatedAtMs: now,
          }, { merge: true });
        }
        addSubscriptionHistory(transaction, {
          actorUid: "system",
          accountId: document.id,
          professionalId: professionalId || null,
          fromStatus: "active",
          toStatus: "overdue",
          reason: "vencimento automático da assinatura",
          now,
        });
        addAdminAudit(transaction, {
          actorUid: "system",
          action: "account_status_changed",
          accountId: document.id,
          professionalId: professionalId || null,
          details: {
            fromStatus: "active",
            toStatus: "overdue",
            renewAtMs: account.renewAtMs ?? null,
          },
          now,
        });
        return {
          account,
          ownerUid,
          professionalId,
          renewAtMs: Number(account.renewAtMs ?? 0),
        };
      });

      if (expiration?.ownerUid) {
        try {
          const latestAccount = await document.ref.get();
          const latest = latestAccount.data() as AccountRecord | undefined;
          if (
            !latestAccount.exists
            || latest?.status !== "overdue"
            || Number(latest.renewAtMs ?? 0) !== expiration.renewAtMs
          ) continue;

          const authUser = await auth.getUser(expiration.ownerUid);
          await auth.setCustomUserClaims(expiration.ownerUid, {
            ...(authUser.customClaims ?? {}),
            role: expiration.account.ownerType === "clinic" ? "clinic" : "professional",
            accountId: document.id,
            professionalId: expiration.professionalId || null,
            accountStatus: "overdue",
            professionalStatus: "inactive",
          });
        } catch (error) {
          console.error("paid_subscription_claims_expiration_failed", {
            accountId: document.id,
            ownerUid: expiration.ownerUid,
            error,
          });
        }
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
