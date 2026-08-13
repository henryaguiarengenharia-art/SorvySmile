import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  BillingAccount,
  DentistRecord,
  LeadRecord,
  PhotoValidation,
  PlanTier,
  PublicProfessionalProfile,
  SmileScores,
  WorkspaceUser,
} from "../types";
import {
  auth,
  db,
  functions,
  isFirebaseConfigured,
} from "./firebaseClient";

export const CONSENT_VERSION = "2026-07";
export const SUBSCRIBER_TERMS_VERSION = "2026-07";

export interface WorkspaceData {
  user: WorkspaceUser;
  leads: LeadRecord[];
  professionals: DentistRecord[];
  accounts: Record<string, BillingAccount>;
  usageByAccount: Record<string, Record<string, number>>;
}

interface CheckoutData {
  name: string;
  email: string;
  whatsapp: string;
  specialty: string;
  password: string;
  plan: PlanTier;
}

function assertConfigured(): void {
  if (!isFirebaseConfigured) {
    throw new Error(
      "O ambiente Firebase ainda não foi configurado. Use o arquivo .env.example.",
    );
  }
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeMessage = "message" in error ? String(error.message) : "";
    if (maybeMessage.includes("auth/invalid-credential")) return "Email ou senha incorretos.";
    if (maybeMessage.includes("auth/too-many-requests")) {
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }
    if (maybeMessage.includes("auth/weak-password")) {
      return "Use uma senha com pelo menos 10 caracteres.";
    }
    if (maybeMessage.includes("app-check-token-is-invalid")) {
      return "A verificação de segurança falhou. Atualize a página.";
    }
    if (
      maybeMessage === "internal"
      || maybeMessage.includes("functions/internal")
    ) {
      return "O serviço de análise da foto está indisponível. Tente novamente em alguns instantes.";
    }
    const details =
      "details" in error && typeof error.details === "object" && error.details
        ? (error.details as { message?: unknown }).message
        : null;
    if (typeof details === "string") return details;
    if (maybeMessage) return maybeMessage.replace(/^Firebase:\s*/i, "");
  }
  return "Não foi possível concluir a operação.";
}

function normalizeTier(value: unknown): PlanTier {
  if (value === "elite") return "network";
  if (value === "pro" || value === "network") return value;
  return "lite";
}

function mapAccount(id: string, data: DocumentData): BillingAccount {
  const tier = normalizeTier(data.plan ?? data.tier);
  return {
    id,
    ownerType: data.ownerType === "clinic" ? "clinic" : "dentist",
    tier,
    isActive: data.status === "active",
    startAt: Number(data.createdAtMs ?? Date.now()),
    renewAt: Number(data.renewAtMs ?? Date.now() + 30 * 24 * 3600 * 1000),
    status: data.status ?? "pending",
    riskLevel: data.riskLevel ?? "ok",
    accountName: data.accountName ?? "",
    requestedPlan: normalizeTier(data.requestedPlan ?? tier),
    activatedAt: data.activatedAtMs,
    checkoutName: data.checkoutName ?? data.accountName,
    checkoutEmail: data.checkoutEmail,
    checkoutWhatsapp: data.checkoutWhatsapp,
    seatsTotal: Number(data.seatsTotal ?? 1),
    seatsUsed: Number(data.seatsUsed ?? 1),
  };
}

function mapProfessional(id: string, data: DocumentData): DentistRecord {
  return {
    id,
    name: data.name ?? "",
    whatsapp: data.whatsapp ?? "",
    email: data.email ?? "",
    plan: normalizeTier(data.plan),
    role: "dentist",
    billingAccountId: data.accountId ?? "",
    isActive: data.isActive === true,
    createdAt: Number(data.createdAtMs ?? data.createdAt ?? Date.now()),
    specialty: data.specialty ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    publicSlug: data.publicSlug ?? "",
    bio: data.bio ?? "",
    bioLink: data.bioLink ?? "",
    standardMessage: data.standardMessage ?? "",
    templates: Array.isArray(data.templates) ? data.templates : [],
    teamTag: data.teamTag ?? "Dentista",
    isOnDuty: data.isOnDuty !== false,
    profileImage: data.profileImage ?? "",
  };
}

function mapLead(id: string, data: DocumentData): LeadRecord {
  return {
    ...(data as LeadRecord),
    id,
    createdAt: Number(data.createdAtMs ?? data.createdAt ?? Date.now()),
    lead: {
      name: data.lead?.name ?? "",
      whatsapp: data.lead?.whatsapp ?? "",
      email: data.lead?.email ?? "",
      location: data.lead?.location ?? "",
    },
  };
}

async function currentWorkspaceUser(user: User): Promise<WorkspaceUser> {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) throw new Error("Seu perfil ainda não foi criado.");
  return {
    uid: user.uid,
    email: user.email ?? "",
    role:
      snap.data().role === "hq"
        ? "hq"
        : snap.data().role === "clinic"
          ? "clinic"
          : "professional",
    accountId: snap.data().accountId,
    professionalId: snap.data().professionalId,
    status: snap.data().status,
    slug: snap.data().slug,
  };
}

export function observeAuth(
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function getPublicProfile(
  slug: string,
): Promise<PublicProfessionalProfile | null> {
  assertConfigured();
  try {
    const snap = await getDoc(doc(db, "publicProfiles", slug));
    if (!snap.exists() || snap.data().active !== true) return null;
    return {
      slug,
      accountId: snap.data().accountId,
      professionalId: snap.data().professionalId ?? null,
      ownerType: snap.data().ownerType === "clinic" ? "clinic" : "dentist",
      name: snap.data().name ?? "",
      whatsapp: snap.data().whatsapp ?? "",
      specialty: snap.data().specialty ?? "",
      city: snap.data().city ?? "",
      state: snap.data().state ?? "",
      bio: snap.data().bio ?? "",
      plan: normalizeTier(snap.data().plan),
      active: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("permission-denied")) return null;
    throw error;
  }
}

async function ensureAuth(): Promise<User> {
  assertConfigured();
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function startTriage(
  slug: string,
  consent: {
    photoConsent: true;
    adultAndOwnershipConfirmed: true;
  },
): Promise<string> {
  await ensureAuth();
  const callable = httpsCallable<
    {
      slug: string;
      consentVersion: string;
      photoConsent: true;
      adultAndOwnershipConfirmed: true;
    },
    { sessionId: string }
  >(functions, "startTriage");
  try {
    const result = await callable({
      slug,
      consentVersion: CONSENT_VERSION,
      ...consent,
    });
    return result.data.sessionId;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function validatePhoto(
  sessionId: string,
  imageBase64: string,
  mimeType: string,
): Promise<PhotoValidation> {
  const callable = httpsCallable<
    { sessionId: string; imageBase64: string; mimeType: string },
    PhotoValidation
  >(functions, "validateSmilePhoto", {
    limitedUseAppCheckTokens: true,
  });
  try {
    return (await callable({ sessionId, imageBase64, mimeType })).data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function analyzePhoto(
  sessionId: string,
  imageBase64: string,
  mimeType: string,
): Promise<SmileScores> {
  const callable = httpsCallable<
    { sessionId: string; imageBase64: string; mimeType: string },
    SmileScores
  >(functions, "analyzeSmilePhoto", {
    limitedUseAppCheckTokens: true,
  });
  try {
    return (await callable({ sessionId, imageBase64, mimeType })).data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function saveLead(input: {
  sessionId: string;
  name: string;
  whatsapp: string;
  contactConsent: true;
  privacyConsent: true;
}): Promise<string> {
  const callable = httpsCallable<
    typeof input & { consentVersion: string },
    { leadId: string }
  >(functions, "captureLead");
  try {
    const result = await callable({
      ...input,
      consentVersion: CONSENT_VERSION,
    });
    return result.data.leadId;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function recordPatientConversionAction(
  sessionId: string,
  action: "whatsapp_opened" | "contact_requested",
): Promise<void> {
  const callable = httpsCallable<
    { sessionId: string; action: typeof action },
    { ok: true }
  >(functions, "recordPatientConversionAction");
  try {
    await callable({ sessionId, action });
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function loginWorkspace(
  email: string,
  password: string,
): Promise<WorkspaceUser> {
  assertConfigured();
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const user = await currentWorkspaceUser(credential.user);
    if (user.role !== "hq" && user.status !== "active") {
      await signOut(auth);
      throw new Error(
        user.status === "pending"
          ? "Pagamento ainda aguardando confirmação."
          : "Esta conta está inativa. Fale com o suporte.",
      );
    }
    return user;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  assertConfigured();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Informe seu email de acesso primeiro.");
  }
  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("auth/user-not-found")) return;
    throw new Error(errorMessage(error));
  }
}

export async function restoreWorkspaceSession(): Promise<WorkspaceUser | null> {
  assertConfigured();
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();
      if (
        !firebaseUser
        || firebaseUser.isAnonymous
        || firebaseUser.providerData.length === 0
      ) {
        resolve(null);
        return;
      }
      try {
        const user = await currentWorkspaceUser(firebaseUser);
        if (user.role !== "hq" && user.status !== "active") {
          resolve(null);
          return;
        }
        resolve(user);
      } catch {
        resolve(null);
      }
    });
  });
}

export async function logoutWorkspace(): Promise<void> {
  await signOut(auth);
}

export async function registerPendingSubscription(
  data: CheckoutData,
): Promise<{ accountId: string; plan: PlanTier; status: "pending" }> {
  assertConfigured();
  const email = data.email.trim().toLowerCase();
  let user: User;
  try {
    user = (await createUserWithEmailAndPassword(auth, email, data.password)).user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("auth/email-already-in-use")) {
      throw new Error(errorMessage(error));
    }
    user = (await signInWithEmailAndPassword(auth, email, data.password)).user;
  }
  if (!user.email) throw new Error("Não foi possível confirmar o email da conta.");

  const callable = httpsCallable<
    Omit<CheckoutData, "password"> & { termsVersion: string },
    { accountId: string; plan: PlanTier; status: "pending" }
  >(functions, "createPendingSubscription");
  try {
    const result = await callable({
      name: data.name,
      email,
      whatsapp: data.whatsapp,
      specialty: data.specialty,
      plan: data.plan,
      termsVersion: SUBSCRIBER_TERMS_VERSION,
    });
    if (!result.data.accountId || result.data.status !== "pending") {
      throw new Error("A solicitação de assinatura não foi registrada.");
    }
    return result.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function updateLeadCrm(
  id: string,
  patch: Partial<LeadRecord>,
): Promise<void> {
  const allowed: Record<string, unknown> = { updatedAtMs: Date.now() };
  if (patch.status !== undefined) allowed.status = patch.status;
  if (patch.firstContactAt !== undefined) {
    allowed.firstContactAt = patch.firstContactAt;
  }
  if (patch.scheduledAt !== undefined) allowed.scheduledAt = patch.scheduledAt;
  await updateDoc(doc(db, "leads", id), allowed);
}

export async function saveProfessionalProfile(
  patch: Partial<DentistRecord>,
): Promise<void> {
  const callable = httpsCallable<Record<string, unknown>, { ok: true }>(
    functions,
    "updateProfessionalProfile",
  );
  await callable({
    whatsapp: patch.whatsapp ?? "",
    city: patch.city ?? "",
    state: patch.state ?? "",
    bio: patch.bio ?? "",
    bioLink: patch.bioLink ?? "",
    standardMessage: patch.standardMessage ?? "",
    templates: patch.templates ?? [],
  });
}

export async function deleteLeadRecord(id: string): Promise<void> {
  const callable = httpsCallable<{ leadId: string }, { ok: true }>(
    functions,
    "deleteLead",
  );
  try {
    await callable({ leadId: id });
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function changeAccountStatus(
  accountId: string,
  status: "active" | "overdue" | "paused",
  plan?: PlanTier,
): Promise<void> {
  const callable = httpsCallable<
    { accountId: string; status: string; plan?: PlanTier },
    { ok: true }
  >(functions, "setAccountStatus");
  await callable({ accountId, status, plan });
}

export async function createTeamMember(input: {
  name: string;
  email: string;
  whatsapp: string;
  specialty: string;
  teamTag: string;
  temporaryPassword: string;
}): Promise<{ professionalId: string; slug: string }> {
  const callable = httpsCallable<
    typeof input,
    { professionalId: string; slug: string }
  >(functions, "createTeamMember");
  try {
    return (await callable(input)).data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function setTeamMemberStatus(
  professionalId: string,
  isActive: boolean,
): Promise<void> {
  const callable = httpsCallable<
    { professionalId: string; isActive: boolean },
    { ok: true }
  >(functions, "setTeamMemberStatus");
  try {
    await callable({ professionalId, isActive });
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function assignLead(
  leadId: string,
  professionalId: string | null,
): Promise<void> {
  const callable = httpsCallable<
    { leadId: string; professionalId: string | null },
    { ok: true }
  >(functions, "assignLead");
  try {
    await callable({ leadId, professionalId });
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function subscribeWorkspace(
  user: WorkspaceUser,
  onChange: (data: WorkspaceData) => void,
  onError: (message: string) => void,
): Promise<Unsubscribe> {
  const state: WorkspaceData = {
    user,
    leads: [],
    professionals: [],
    accounts: {},
    usageByAccount: {},
  };
  const emit = () => onChange({
    ...state,
    leads: [...state.leads],
    professionals: [...state.professionals],
    accounts: { ...state.accounts },
    usageByAccount: { ...state.usageByAccount },
  });
  const handleError = (error: unknown) => onError(errorMessage(error));
  const subscriptions: Unsubscribe[] = [];

  const leadQuery = user.role === "hq"
    ? collection(db, "leads")
    : user.role === "clinic"
      ? query(collection(db, "leads"), where("accountId", "==", user.accountId))
      : query(
          collection(db, "leads"),
          where("accountId", "==", user.accountId),
          where("professionalId", "==", user.professionalId),
        );
  subscriptions.push(onSnapshot(leadQuery, (snapshot) => {
    state.leads = snapshot.docs
      .map((item) => mapLead(item.id, item.data()))
      .sort((a, b) => b.createdAt - a.createdAt);
    emit();
  }, handleError));

  if (user.role === "professional" && user.professionalId) {
    subscriptions.push(onSnapshot(
      doc(db, "professionals", user.professionalId),
      (snapshot) => {
        state.professionals = snapshot.exists()
          ? [mapProfessional(snapshot.id, snapshot.data())]
          : [];
        emit();
      },
      handleError,
    ));
  } else {
    const professionalQuery = user.role === "hq"
      ? collection(db, "professionals")
      : query(
          collection(db, "professionals"),
          where("accountId", "==", user.accountId),
        );
    subscriptions.push(onSnapshot(professionalQuery, (snapshot) => {
      state.professionals = snapshot.docs.map((item) =>
        mapProfessional(item.id, item.data()),
      );
      emit();
    }, handleError));
  }

  if (user.role === "hq") {
    subscriptions.push(onSnapshot(collection(db, "accounts"), (snapshot) => {
      state.accounts = Object.fromEntries(
        snapshot.docs.map((item) => [item.id, mapAccount(item.id, item.data())]),
      );
      emit();
    }, handleError));
    subscriptions.push(onSnapshot(collection(db, "usage"), (snapshot) => {
      const usageByAccount: Record<string, Record<string, number>> = {};
      snapshot.docs.forEach((item) => {
        const data = item.data();
        const accountId = String(data.accountId ?? "");
        const month = String(data.month ?? "");
        if (!accountId || !month) return;
        usageByAccount[accountId] ??= {};
        usageByAccount[accountId][month] = Number(data.triages ?? 0);
      });
      state.usageByAccount = usageByAccount;
      emit();
    }, handleError));
  } else if (user.accountId) {
    subscriptions.push(onSnapshot(doc(db, "accounts", user.accountId), (snapshot) => {
      if (snapshot.exists()) {
        state.accounts = {
          [snapshot.id]: mapAccount(snapshot.id, snapshot.data()),
        };
      }
      emit();
    }, handleError));

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    subscriptions.push(
      onSnapshot(
        doc(db, "usage", `${user.accountId}_${month}`),
        (snapshot) => {
          state.usageByAccount = {
            [user.accountId as string]: {
              [month]: Number(snapshot.data()?.triages ?? 0),
            },
          };
          emit();
        },
        handleError,
      ),
    );
  }

  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}
