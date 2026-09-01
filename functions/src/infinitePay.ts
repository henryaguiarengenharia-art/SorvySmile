import { createHash, randomUUID } from "node:crypto";
import type { Auth } from "firebase-admin/auth";
import {
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { AcquisitionSource, AttributionInput } from "./attribution.js";
import { funnelEventFields, funnelEventId } from "./funnelMetrics.js";
import { normalizePlan, PLANS, type PlanTier } from "./plans.js";
import {
  nextBillingDueAt,
  paidSubscriptionExpired,
} from "./subscriptions.js";

const INFINITEPAY_API_BASE = "https://api.checkout.infinitepay.io";
const ORDER_REUSE_MS = 24 * 60 * 60 * 1000;
const ORDER_CREATION_LOCK_MS = 2 * 60 * 1000;

export interface InfinitePayVerification {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
}

export interface InfinitePayRuntime {
  firestore: Firestore;
  auth: Auth;
  getHandle: () => string;
  getPublicAppUrl: () => string;
  getProjectId: () => string;
  region: string;
  fetchImpl?: typeof fetch;
}

interface PaymentTokens {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}

interface ActivationResult {
  success: true;
  alreadyProcessed: boolean;
  accountId: string;
  professionalId: string;
  ownerUid: string;
  planTier: PlanTier;
  renewAtMs: number;
  role: "clinic" | "professional";
}

const asString = (value: unknown): string => String(value ?? "").trim();

function requireConfiguredValue(value: unknown, label: string): string {
  const normalized = asString(value);
  if (!normalized) {
    console.error("INFINITEPAY_CONFIGURATION_MISSING", { label });
    throw new HttpsError(
      "failed-precondition",
      "O checkout ainda não está configurado neste ambiente.",
    );
  }
  return normalized;
}

function normalizePhone(value: unknown): string | undefined {
  const digits = asString(value).replace(/\D/g, "");
  if (!digits) return undefined;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
}

function isOfficialInfinitePayCheckoutUrl(value: unknown): boolean {
  try {
    const parsed = new URL(asString(value));
    return parsed.protocol === "https:"
      && (
        parsed.hostname === "checkout.infinitepay.com.br"
        || parsed.hostname.endsWith(".infinitepay.io")
      );
  } catch {
    return false;
  }
}

function knownSmileHost(hostname: string): boolean {
  return (
    hostname === "sorvysmile.web.app"
    || hostname === "sorvysmile.firebaseapp.com"
    || hostname === "sorvysmile-homologacao.web.app"
    || hostname === "sorvysmile-homologacao.firebaseapp.com"
    || /^sorvysmile(?:-homologacao)?--[a-z0-9-]+\.web\.app$/.test(hostname)
  );
}

export function resolveInfinitePayReturnOrigin(
  value: unknown,
  publicAppUrl: string,
): string {
  let fallback: URL;
  try {
    fallback = new URL(publicAppUrl);
  } catch {
    fallback = new URL("https://sorvysmile.web.app");
  }

  const raw = asString(value);
  if (!raw) return fallback.origin;

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    const fallbackHost = fallback.hostname.toLowerCase();
    const isAllowedHost = hostname === fallbackHost || knownSmileHost(hostname);
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || !isAllowedHost
    ) {
      return fallback.origin;
    }
    return parsed.origin;
  } catch {
    return fallback.origin;
  }
}

export function expectedInfinitePayAmountCents(planValue: unknown): {
  plan: PlanTier;
  amountCents: number;
} {
  let plan: PlanTier;
  try {
    plan = normalizePlan(planValue);
  } catch {
    throw new HttpsError("failed-precondition", "Plano inválido para pagamento.");
  }
  return { plan, amountCents: PLANS[plan].price * 100 };
}

export function buildInfinitePayOrderNsu(accountId: string): string {
  const accountHash = createHash("sha256")
    .update(accountId)
    .digest("hex")
    .slice(0, 12);
  return `smile-${accountHash}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function paymentTransactionDocumentId(transactionNsu: string): string {
  return createHash("sha256").update(transactionNsu).digest("hex");
}

function validatePaymentTokens(input: {
  orderNsu?: unknown;
  transactionNsu?: unknown;
  slug?: unknown;
}): PaymentTokens {
  const orderNsu = asString(input.orderNsu);
  const transactionNsu = asString(input.transactionNsu);
  const slug = asString(input.slug);

  if (
    !/^smile-[a-f0-9]{12}-[a-z0-9]+-[a-f0-9-]{8}$/.test(orderNsu)
    || transactionNsu.length < 4
    || transactionNsu.length > 200
    || slug.length < 2
    || slug.length > 200
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Dados de confirmação do pagamento incompletos.",
    );
  }

  return { orderNsu, transactionNsu, slug };
}

function webhookUrl(runtime: InfinitePayRuntime): string {
  const projectId = requireConfiguredValue(runtime.getProjectId(), "projectId");
  return `https://${runtime.region}-${projectId}.cloudfunctions.net/infinitePayWebhook`;
}

async function postJson<T>(
  runtime: InfinitePayRuntime,
  path: "/links" | "/payment_check",
  payload: Record<string, unknown>,
): Promise<T> {
  const fetchImpl = runtime.fetchImpl ?? fetch;
  const response = await fetchImpl(`${INFINITEPAY_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    console.error("INFINITEPAY_HTTP_ERROR", {
      path,
      status: response.status,
    });
    throw new Error(`A InfinitePay recusou a operação (${response.status}).`);
  }
  return parsed as T;
}

async function verifyPaymentAtInfinitePay(
  runtime: InfinitePayRuntime,
  tokens: PaymentTokens,
): Promise<InfinitePayVerification> {
  return postJson<InfinitePayVerification>(runtime, "/payment_check", {
    handle: requireConfiguredValue(runtime.getHandle(), "handle"),
    order_nsu: tokens.orderNsu,
    transaction_nsu: tokens.transactionNsu,
    slug: tokens.slug,
  });
}

function acquisitionSource(value: unknown): AcquisitionSource {
  return value === "organic"
    || value === "paid"
    || value === "partner"
    || value === "prospecting"
    ? value
    : "bio";
}

function attribution(value: unknown): AttributionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AttributionInput;
}

async function applyAuthAccess(
  runtime: InfinitePayRuntime,
  activation: ActivationResult,
): Promise<void> {
  const authUser = await runtime.auth.getUser(activation.ownerUid);
  await runtime.auth.updateUser(activation.ownerUid, { disabled: false });
  await runtime.auth.setCustomUserClaims(activation.ownerUid, {
    ...(authUser.customClaims ?? {}),
    role: activation.role,
    accountId: activation.accountId,
    professionalId: activation.professionalId,
    accountStatus: "active",
    professionalStatus: "subscriber",
  });
}

async function activatePaidOrder(
  runtime: InfinitePayRuntime,
  tokens: PaymentTokens,
  verification: InfinitePayVerification,
  providerPayload: Record<string, unknown>,
  confirmationSource: "webhook" | "return",
): Promise<ActivationResult> {
  if (!verification.success || !verification.paid) {
    throw new HttpsError(
      "failed-precondition",
      "O pagamento ainda não foi confirmado pela InfinitePay.",
    );
  }

  const confirmedAmount = Number(verification.amount ?? 0);
  if (!Number.isInteger(confirmedAmount) || confirmedAmount <= 0) {
    throw new HttpsError(
      "failed-precondition",
      "A InfinitePay não confirmou o valor do pagamento.",
    );
  }

  const { firestore } = runtime;
  const orderRef = firestore.collection("paymentOrders").doc(tokens.orderNsu);
  const transactionRef = firestore
    .collection("paymentTransactions")
    .doc(paymentTransactionDocumentId(tokens.transactionNsu));

  const activation = await firestore.runTransaction(async (transaction) => {
    const [orderSnapshot, transactionSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(transactionRef),
    ]);
    if (!orderSnapshot.exists) {
      throw new HttpsError("not-found", "Pedido de pagamento não encontrado.");
    }

    const order = orderSnapshot.data() ?? {};
    const ledger = transactionSnapshot.data();
    if (ledger && ledger.orderNsu !== tokens.orderNsu) {
      throw new HttpsError(
        "already-exists",
        "Esta transação já foi utilizada em outro pedido.",
      );
    }
    if (
      order.status === "PAID"
      && order.transactionNsu
      && order.transactionNsu !== tokens.transactionNsu
    ) {
      throw new HttpsError(
        "already-exists",
        "Este pedido já foi confirmado por outra transação.",
      );
    }

    const expectedAmount = Number(order.amountCents ?? 0);
    if (expectedAmount <= 0 || expectedAmount !== confirmedAmount) {
      console.error("INFINITEPAY_AMOUNT_MISMATCH", {
        orderNsu: tokens.orderNsu,
        expectedAmount,
        confirmedAmount,
      });
      throw new HttpsError(
        "failed-precondition",
        "O valor confirmado não corresponde ao plano contratado.",
      );
    }

    const accountId = asString(order.accountId);
    const professionalId = asString(order.professionalId);
    const ownerUid = asString(order.ownerUid);
    if (!accountId || !professionalId || !ownerUid) {
      throw new HttpsError(
        "failed-precondition",
        "O pedido não possui uma conta válida associada.",
      );
    }

    const accountRef = firestore.collection("accounts").doc(accountId);
    const professionalRef = firestore
      .collection("professionals")
      .doc(professionalId);
    const [accountSnapshot, professionalSnapshot] = await Promise.all([
      transaction.get(accountRef),
      transaction.get(professionalRef),
    ]);
    if (!accountSnapshot.exists || !professionalSnapshot.exists) {
      throw new HttpsError("not-found", "Conta profissional não encontrada.");
    }

    const account = accountSnapshot.data() ?? {};
    const professional = professionalSnapshot.data() ?? {};
    if (
      account.ownerUid !== ownerUid
      || account.professionalId !== professionalId
      || professional.accountId !== accountId
    ) {
      throw new HttpsError(
        "permission-denied",
        "O pedido não corresponde ao titular da conta.",
      );
    }

    const { plan } = expectedInfinitePayAmountCents(order.planTier);
    const role = plan === "network" ? "clinic" as const : "professional" as const;
    const priorRenewAtMs = Number(account.renewAtMs ?? 0);
    const now = Date.now();
    const renewAtMs = order.status === "PAID"
      ? Number(order.renewAtMs ?? priorRenewAtMs)
      : nextBillingDueAt(priorRenewAtMs, undefined, now);

    const result: ActivationResult = {
      success: true,
      alreadyProcessed: order.status === "PAID",
      accountId,
      professionalId,
      ownerUid,
      planTier: plan,
      renewAtMs,
      role,
    };
    if (order.status === "PAID") return result;

    const wasTrial = professional.status === "trial"
      || account.subscriptionStatus === "trial"
      || account.subscriptionStatus === "trial_ready"
      || account.subscriptionStatus === "trial_expired"
      || ["ready", "active", "expired"].includes(asString(account.trialStatus));
    const firstActivation = !Number(account.activatedAtMs ?? 0);
    const source = acquisitionSource(account.acquisitionSource);
    const firstTouch = attribution(account.attributionFirstTouch);
    const receiptUrl = asString(providerPayload.receipt_url);
    const paidAmount = Number(
      verification.paid_amount
      ?? providerPayload.paid_amount
      ?? confirmedAmount,
    );
    const captureMethod = asString(
      verification.capture_method ?? providerPayload.capture_method,
    );
    const installments = Math.max(
      1,
      Number(verification.installments ?? providerPayload.installments ?? 1),
    );

    transaction.set(accountRef, {
      plan,
      tier: plan,
      requestedPlan: plan,
      requestedPrice: PLANS[plan].price,
      monthlyLeadLimit: PLANS[plan].monthlyLeadLimit,
      ownerType: plan === "network" ? "clinic" : "dentist",
      seatsTotal: PLANS[plan].includedSeats,
      extraSeatPrice: PLANS[plan].extraSeatPrice,
      status: "active",
      isActive: true,
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
      paymentProvider: "infinitepay",
      billingMode: "checkout_integrated",
      billingInterval: "monthly",
      trialStatus: wasTrial ? "converted" : account.trialStatus ?? "not_started",
      trialEligible: false,
      trialConvertedAtMs: wasTrial ? now : account.trialConvertedAtMs ?? null,
      timeToPaidMs: wasTrial && account.trialStartedAtMs
        ? Math.max(0, now - Number(account.trialStartedAtMs))
        : account.timeToPaidMs ?? null,
      activatedAtMs: Number(account.activatedAtMs ?? now),
      activatedBy: account.activatedBy ?? `infinitepay:${confirmationSource}`,
      activatedPlan: plan,
      activatedPrice: PLANS[plan].price,
      paymentConfirmedAtMs: now,
      paymentConfirmedBy: `infinitepay:${confirmationSource}`,
      lastPaymentAtMs: now,
      lastPaymentOrderNsu: tokens.orderNsu,
      lastPaymentTransactionNsu: tokens.transactionNsu,
      lastPaymentReceiptUrl: receiptUrl || null,
      renewAtMs,
      pendingPaymentOrderNsu: FieldValue.delete(),
      updatedAtMs: now,
    }, { merge: true });

    transaction.set(firestore.collection("users").doc(ownerUid), {
      role,
      status: "active",
      lifecycleStatus: "subscriber",
      updatedAtMs: now,
    }, { merge: true });

    transaction.set(professionalRef, {
      plan,
      isActive: true,
      status: "subscriber",
      trialStatus: wasTrial ? "converted" : professional.trialStatus ?? "not_started",
      updatedAtMs: now,
    }, { merge: true });

    const slug = asString(professional.publicSlug || account.slug);
    if (slug) {
      transaction.set(firestore.collection("publicProfiles").doc(slug), {
        accountId,
        professionalId,
        slug,
        plan,
        ownerType: plan === "network" ? "clinic" : "dentist",
        status: "subscriber",
        active: true,
        renewAtMs,
        updatedAtMs: now,
      }, { merge: true });
    }

    transaction.set(transactionRef, {
      provider: "INFINITEPAY",
      orderNsu: tokens.orderNsu,
      transactionNsu: tokens.transactionNsu,
      accountId,
      professionalId,
      amountCents: confirmedAmount,
      createdAtMs: now,
    });

    transaction.set(orderRef, {
      status: "PAID",
      transactionNsu: tokens.transactionNsu,
      invoiceSlug: tokens.slug,
      receiptUrl: receiptUrl || null,
      captureMethod: captureMethod || null,
      installments,
      providerAmountCents: confirmedAmount,
      providerPaidAmountCents: paidAmount,
      confirmationSource,
      paidAtMs: now,
      renewAtMs,
      updatedAtMs: now,
    }, { merge: true });

    transaction.set(firestore.collection("adminAuditLogs").doc(), {
      actorUid: `infinitepay:${confirmationSource}`,
      action: "account_status_changed",
      accountId,
      professionalId,
      details: {
        fromStatus: account.status ?? null,
        toStatus: "active",
        plan,
        orderNsu: tokens.orderNsu,
        transactionNsu: tokens.transactionNsu,
        renewAtMs,
      },
      createdAtMs: now,
    });

    transaction.set(firestore.collection("subscriptionHistory").doc(), {
      actorUid: `infinitepay:${confirmationSource}`,
      accountId,
      professionalId,
      fromStatus: account.subscriptionStatus ?? account.status ?? null,
      toStatus: "subscriber",
      reason: "pagamento confirmado automaticamente pela InfinitePay",
      orderNsu: tokens.orderNsu,
      transactionNsu: tokens.transactionNsu,
      createdAtMs: now,
    });

    if (firstActivation) {
      const input = {
        eventKey: `subscription_activated:${accountId}`,
        eventType: "subscription_activated" as const,
        accountId,
        professionalId,
        source,
        attribution: firstTouch,
        occurredAtMs: now,
        metadata: { plan, provider: "infinitepay", automatic: true },
      };
      transaction.set(
        firestore.collection("funnelEvents").doc(funnelEventId(input.eventKey)),
        funnelEventFields(input),
        { merge: true },
      );
    }
    if (wasTrial) {
      const input = {
        eventKey: `trial_converted:${accountId}`,
        eventType: "trial_converted" as const,
        accountId,
        professionalId,
        source,
        attribution: firstTouch,
        occurredAtMs: now,
        metadata: {
          plan,
          provider: "infinitepay",
          automatic: true,
          timeToPaidMs: account.trialStartedAtMs
            ? Math.max(0, now - Number(account.trialStartedAtMs))
            : null,
        },
      };
      transaction.set(
        firestore.collection("funnelEvents").doc(funnelEventId(input.eventKey)),
        funnelEventFields(input),
        { merge: true },
      );
    }
    return result;
  });

  await applyAuthAccess(runtime, activation);
  return activation;
}

function isAnonymous(request: any): boolean {
  return request.auth?.token?.firebase?.sign_in_provider === "anonymous";
}

export async function createInfinitePayCheckoutHandler(
  request: any,
  runtime: InfinitePayRuntime,
) {
  if (!request.auth || isAnonymous(request)) {
    throw new HttpsError(
      "unauthenticated",
      "Entre na sua conta para iniciar o pagamento.",
    );
  }

  const uid = request.auth.uid as string;
  const { firestore } = runtime;
  const userRef = firestore.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  const user = userSnapshot.data() ?? {};
  const accountId = asString(user.accountId);
  if (!accountId || !["professional", "clinic"].includes(asString(user.role))) {
    throw new HttpsError("permission-denied", "Conta profissional não encontrada.");
  }

  const accountRef = firestore.collection("accounts").doc(accountId);
  const accountSnapshot = await accountRef.get();
  const account = accountSnapshot.data() ?? {};
  if (!accountSnapshot.exists || account.ownerUid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Apenas o responsável pela conta pode iniciar o pagamento.",
    );
  }
  if (
    account.status === "active"
    && account.subscriptionStatus === "active"
    && account.paymentStatus === "confirmed"
    && !paidSubscriptionExpired(account)
  ) {
    throw new HttpsError("failed-precondition", "Este plano já está ativo.");
  }

  const { plan, amountCents } = expectedInfinitePayAmountCents(
    account.requestedPlan ?? account.plan ?? account.tier,
  );
  const returnOrigin = resolveInfinitePayReturnOrigin(
    request.data?.returnOrigin,
    requireConfiguredValue(runtime.getPublicAppUrl(), "publicAppUrl"),
  );
  const professionalId = asString(account.professionalId);
  if (!professionalId) {
    throw new HttpsError("failed-precondition", "Conta sem profissional responsável.");
  }
  const professionalSnapshot = await firestore
    .collection("professionals")
    .doc(professionalId)
    .get();
  if (!professionalSnapshot.exists || professionalSnapshot.data()?.accountId !== accountId) {
    throw new HttpsError("not-found", "Cadastro profissional não encontrado.");
  }
  const professional = professionalSnapshot.data() ?? {};

  type Reservation =
    | { reused: true; orderNsu: string; checkoutUrl: string }
    | { reused: false; orderNsu: string };

  const reservation = await firestore.runTransaction<Reservation>(async (transaction) => {
    const freshAccountSnapshot = await transaction.get(accountRef);
    const freshAccount = freshAccountSnapshot.data() ?? {};
    if (!freshAccountSnapshot.exists || freshAccount.ownerUid !== uid) {
      throw new HttpsError("permission-denied", "Conta profissional inválida.");
    }
    if (
      freshAccount.status === "active"
      && freshAccount.subscriptionStatus === "active"
      && freshAccount.paymentStatus === "confirmed"
      && !paidSubscriptionExpired(freshAccount)
    ) {
      throw new HttpsError("failed-precondition", "Este plano já está ativo.");
    }
    const freshPrice = expectedInfinitePayAmountCents(
      freshAccount.requestedPlan ?? freshAccount.plan ?? freshAccount.tier,
    );
    if (freshPrice.plan !== plan || freshPrice.amountCents !== amountCents) {
      throw new HttpsError(
        "aborted",
        "O plano foi atualizado. Recarregue a página antes de pagar.",
      );
    }

    const pendingOrderNsu = asString(freshAccount.pendingPaymentOrderNsu);
    if (pendingOrderNsu) {
      const pendingRef = firestore.collection("paymentOrders").doc(pendingOrderNsu);
      const pendingSnapshot = await transaction.get(pendingRef);
      const pending = pendingSnapshot.data() ?? {};
      const createdAtMs = Number(pending.createdAtMs ?? 0);
      const ageMs = Date.now() - createdAtMs;
      const sameOrder = pending.accountId === accountId
        && pending.professionalId === professionalId
        && pending.planTier === plan
        && Number(pending.amountCents ?? 0) === amountCents
        && pending.returnOrigin === returnOrigin;

      if (
        pendingSnapshot.exists
        && sameOrder
        && pending.status === "PENDING"
        && isOfficialInfinitePayCheckoutUrl(pending.checkoutUrl)
        && ageMs >= 0
        && ageMs < ORDER_REUSE_MS
      ) {
        return {
          reused: true,
          orderNsu: pendingOrderNsu,
          checkoutUrl: asString(pending.checkoutUrl),
        };
      }
      if (
        pendingSnapshot.exists
        && sameOrder
        && pending.status === "CREATING"
        && ageMs >= 0
        && ageMs < ORDER_CREATION_LOCK_MS
      ) {
        throw new HttpsError(
          "aborted",
          "O checkout já está sendo preparado. Aguarde alguns segundos.",
        );
      }
    }

    const orderNsu = buildInfinitePayOrderNsu(accountId);
    const now = Date.now();
    transaction.set(firestore.collection("paymentOrders").doc(orderNsu), {
      orderNsu,
      provider: "INFINITEPAY",
      accountId,
      professionalId,
      ownerUid: uid,
      planTier: plan,
      amountCents,
      currency: "BRL",
      returnOrigin,
      status: "CREATING",
      createdAtMs: now,
      updatedAtMs: now,
    });
    transaction.set(accountRef, {
      pendingPaymentOrderNsu: orderNsu,
      paymentProvider: "infinitepay",
      billingMode: "checkout_integrated",
      updatedAtMs: now,
    }, { merge: true });
    return { reused: false, orderNsu };
  });

  if (reservation.reused) {
    return {
      success: true,
      reused: true,
      orderNsu: reservation.orderNsu,
      checkoutUrl: reservation.checkoutUrl,
      planTier: plan,
      amountCents,
    };
  }

  const orderRef = firestore.collection("paymentOrders").doc(reservation.orderNsu);

  try {
    const providerResponse = await postJson<{ url?: string }>(runtime, "/links", {
      handle: requireConfiguredValue(runtime.getHandle(), "handle"),
      redirect_url: `${returnOrigin}/?payment_return=1`,
      webhook_url: webhookUrl(runtime),
      order_nsu: reservation.orderNsu,
      customer: {
        name: asString(account.checkoutName || professional.name),
        email: asString(account.checkoutEmail || professional.email || request.auth.token.email),
        phone_number: normalizePhone(account.checkoutWhatsapp || professional.whatsapp),
      },
      items: [{
        quantity: 1,
        price: amountCents,
        description: `Sorvy Smile ${PLANS[plan].label} - acesso mensal`,
      }],
    });
    const checkoutUrl = asString(providerResponse.url);
    if (!isOfficialInfinitePayCheckoutUrl(checkoutUrl)) {
      throw new Error("A InfinitePay não retornou um checkout válido.");
    }

    const batch = firestore.batch();
    batch.set(orderRef, {
      status: "PENDING",
      checkoutUrl,
      updatedAtMs: Date.now(),
    }, { merge: true });
    batch.set(accountRef, {
      pendingPaymentOrderNsu: reservation.orderNsu,
      paymentRequestedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    }, { merge: true });
    await batch.commit();

    return {
      success: true,
      reused: false,
      orderNsu: reservation.orderNsu,
      checkoutUrl,
      planTier: plan,
      amountCents,
    };
  } catch (error) {
    console.error("CREATE_INFINITEPAY_CHECKOUT_ERROR", {
      orderNsu: reservation.orderNsu,
      message: error instanceof Error ? error.message : "unknown",
    });
    await firestore.runTransaction(async (transaction) => {
      const latestAccount = await transaction.get(accountRef);
      transaction.set(orderRef, {
        status: "ERROR",
        errorCode: "provider_checkout_failed",
        updatedAtMs: Date.now(),
      }, { merge: true });
      if (latestAccount.data()?.pendingPaymentOrderNsu === reservation.orderNsu) {
        transaction.set(accountRef, {
          pendingPaymentOrderNsu: FieldValue.delete(),
          updatedAtMs: Date.now(),
        }, { merge: true });
      }
    });
    throw new HttpsError(
      "internal",
      "Não foi possível abrir o pagamento agora. Tente novamente em instantes.",
    );
  }
}

export async function confirmInfinitePayReturnHandler(
  request: any,
  runtime: InfinitePayRuntime,
) {
  if (!request.auth || isAnonymous(request)) {
    throw new HttpsError(
      "unauthenticated",
      "Entre na conta usada no cadastro para confirmar o pagamento.",
    );
  }
  const tokens = validatePaymentTokens({
    orderNsu: request.data?.orderNsu,
    transactionNsu: request.data?.transactionNsu,
    slug: request.data?.slug,
  });
  const orderSnapshot = await runtime.firestore
    .collection("paymentOrders")
    .doc(tokens.orderNsu)
    .get();
  if (!orderSnapshot.exists) {
    throw new HttpsError("not-found", "Pedido de pagamento não encontrado.");
  }
  if (orderSnapshot.data()?.ownerUid !== request.auth.uid) {
    throw new HttpsError(
      "permission-denied",
      "Este pagamento pertence a outra conta.",
    );
  }

  const verification = await verifyPaymentAtInfinitePay(runtime, tokens);
  return activatePaidOrder(
    runtime,
    tokens,
    verification,
    request.data ?? {},
    "return",
  );
}

export async function infinitePayWebhookHandler(
  request: any,
  response: any,
  runtime: InfinitePayRuntime,
): Promise<void> {
  if (request.method !== "POST") {
    response.status(405).json({ success: false, message: "Método não permitido" });
    return;
  }

  const payload = request.body && typeof request.body === "object"
    ? request.body as Record<string, unknown>
    : {};
  try {
    const tokens = validatePaymentTokens({
      orderNsu: payload.order_nsu,
      transactionNsu: payload.transaction_nsu,
      slug: payload.invoice_slug || payload.slug,
    });
    const orderSnapshot = await runtime.firestore
      .collection("paymentOrders")
      .doc(tokens.orderNsu)
      .get();
    if (!orderSnapshot.exists) {
      throw new HttpsError("not-found", "Pedido de pagamento não encontrado.");
    }
    const verification = await verifyPaymentAtInfinitePay(runtime, tokens);
    await activatePaidOrder(
      runtime,
      tokens,
      verification,
      payload,
      "webhook",
    );
    response.status(200).json({ success: true, message: null });
  } catch (error) {
    console.error("INFINITEPAY_WEBHOOK_ERROR", {
      orderNsu: asString(payload.order_nsu),
      transactionNsu: asString(payload.transaction_nsu),
      message: error instanceof Error ? error.message : "unknown",
    });
    response.status(400).json({
      success: false,
      message: error instanceof Error
        ? error.message
        : "Não foi possível processar o pagamento",
    });
  }
}
