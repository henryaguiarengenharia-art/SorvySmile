import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInfinitePayCheckoutHandler,
  infinitePayWebhookHandler,
  type InfinitePayRuntime,
} from "./infinitePay.js";

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

function webhookResponse() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { response, state };
}

describe.skipIf(!hasEmulator)("InfinitePay com Firestore real", () => {
  let firestore: Firestore;
  const getUser = vi.fn(async () => ({ customClaims: { existing: true } }));
  const updateUser = vi.fn(async () => ({}));
  const setCustomUserClaims = vi.fn(async () => undefined);

  beforeAll(() => {
    const app = getApps()[0] ?? initializeApp({ projectId: "demo-sorvy-smile" });
    firestore = getFirestore(app);
  });

  beforeEach(async () => {
    getUser.mockClear();
    updateUser.mockClear();
    setCustomUserClaims.mockClear();
    for (const collectionName of [
      "users",
      "accounts",
      "professionals",
      "publicProfiles",
      "paymentOrders",
      "paymentTransactions",
      "adminAuditLogs",
      "subscriptionHistory",
      "funnelEvents",
    ]) {
      const snapshots = await firestore.collection(collectionName).get();
      const batch = firestore.batch();
      snapshots.docs.forEach((snapshot) => batch.delete(snapshot.ref));
      if (!snapshots.empty) await batch.commit();
    }

    await Promise.all([
      firestore.doc("users/user-pro").set({
        role: "professional",
        status: "pending",
        accountId: "acc-pro",
        professionalId: "pro-main",
      }),
      firestore.doc("accounts/acc-pro").set({
        ownerUid: "user-pro",
        professionalId: "pro-main",
        slug: "dra-teste",
        plan: "pro",
        requestedPlan: "pro",
        status: "pending",
        subscriptionStatus: "pending",
        paymentStatus: "awaiting_first_payment",
        checkoutName: "Dra. Teste",
        checkoutEmail: "teste@example.com",
        checkoutWhatsapp: "5531999999999",
        acquisitionSource: "paid",
        attributionFirstTouch: { utmCampaign: "hml" },
        createdAtMs: 1,
      }),
      firestore.doc("professionals/pro-main").set({
        accountId: "acc-pro",
        ownerUid: "user-pro",
        publicSlug: "dra-teste",
        name: "Dra. Teste",
        email: "teste@example.com",
        whatsapp: "5531999999999",
        plan: "pro",
        status: "inactive",
        isActive: false,
      }),
    ]);
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  function runtime(paymentAmount = 19700): InfinitePayRuntime {
    return {
      firestore,
      auth: {
        getUser,
        updateUser,
        setCustomUserClaims,
      } as unknown as InfinitePayRuntime["auth"],
      getHandle: () => "henry-augusto-pinheiro",
      getPublicAppUrl: () => "https://sorvysmile-homologacao.web.app",
      getProjectId: () => "demo-sorvy-smile",
      region: "southamerica-east1",
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/links")) {
          return new Response(JSON.stringify({
            url: "https://checkout.infinitepay.com.br/henry?lenc=test",
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          success: true,
          paid: true,
          amount: paymentAmount,
          paid_amount: paymentAmount,
          installments: 1,
          capture_method: "pix",
        }), { status: 200 });
      }) as typeof fetch,
    };
  }

  async function createCheckout(activeRuntime: InfinitePayRuntime) {
    return createInfinitePayCheckoutHandler({
      auth: {
        uid: "user-pro",
        token: {
          email: "teste@example.com",
          firebase: { sign_in_provider: "password" },
        },
      },
      data: { returnOrigin: "https://sorvysmile-homologacao.web.app" },
    }, activeRuntime);
  }

  it("ativa plano, limites, perfil e auditoria uma única vez", async () => {
    const activeRuntime = runtime();
    const checkout = await createCheckout(activeRuntime);
    const reusedCheckout = await createCheckout(activeRuntime);
    expect(reusedCheckout).toMatchObject({
      reused: true,
      orderNsu: checkout.orderNsu,
      checkoutUrl: checkout.checkoutUrl,
    });
    expect(activeRuntime.fetchImpl).toHaveBeenCalledTimes(1);
    const payload = {
      order_nsu: checkout.orderNsu,
      transaction_nsu: "transaction-approved-1",
      invoice_slug: "invoice-approved-1",
      amount: 19700,
      paid_amount: 19700,
      capture_method: "pix",
      receipt_url: "https://example.com/receipt",
    };

    const first = webhookResponse();
    await infinitePayWebhookHandler(
      { method: "POST", body: payload },
      first.response,
      activeRuntime,
    );
    expect(first.state.status).toBe(200);

    const accountAfterFirst = (await firestore.doc("accounts/acc-pro").get()).data();
    expect(accountAfterFirst).toMatchObject({
      status: "active",
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
      billingMode: "checkout_integrated",
      monthlyLeadLimit: 60,
      renewAtMs: expect.any(Number),
      lastPaymentOrderNsu: checkout.orderNsu,
    });
    expect((await firestore.doc("professionals/pro-main").get()).data()).toMatchObject({
      status: "subscriber",
      isActive: true,
      plan: "pro",
    });
    expect((await firestore.doc("publicProfiles/dra-teste").get()).data()).toMatchObject({
      active: true,
      status: "subscriber",
      plan: "pro",
      renewAtMs: accountAfterFirst?.renewAtMs,
    });
    expect(setCustomUserClaims).toHaveBeenCalledWith(
      "user-pro",
      expect.objectContaining({
        existing: true,
        accountStatus: "active",
        professionalStatus: "subscriber",
      }),
    );

    const renewAtMs = accountAfterFirst?.renewAtMs;
    const second = webhookResponse();
    await infinitePayWebhookHandler(
      { method: "POST", body: payload },
      second.response,
      activeRuntime,
    );
    expect(second.state.status).toBe(200);
    expect((await firestore.doc("accounts/acc-pro").get()).data()?.renewAtMs).toBe(renewAtMs);
    expect((await firestore.collection("paymentTransactions").get()).size).toBe(1);
    expect((await firestore.collection("subscriptionHistory").get()).size).toBe(1);
  });

  it("recusa divergência entre o valor aprovado e o plano", async () => {
    const activeRuntime = runtime(9700);
    const checkout = await createCheckout(activeRuntime);
    const result = webhookResponse();
    await infinitePayWebhookHandler(
      {
        method: "POST",
        body: {
          order_nsu: checkout.orderNsu,
          transaction_nsu: "transaction-wrong-value",
          invoice_slug: "invoice-wrong-value",
        },
      },
      result.response,
      activeRuntime,
    );
    expect(result.state.status).toBe(400);
    expect((await firestore.doc("accounts/acc-pro").get()).data()).toMatchObject({
      status: "pending",
      paymentStatus: "awaiting_first_payment",
    });
    expect((await firestore.collection("paymentTransactions").get()).size).toBe(0);
  });

  it("permite renovar imediatamente após o vencimento e abre um novo ciclo", async () => {
    const activeRuntime = runtime();
    const firstCheckout = await createCheckout(activeRuntime);
    const firstPayment = webhookResponse();
    await infinitePayWebhookHandler(
      {
        method: "POST",
        body: {
          order_nsu: firstCheckout.orderNsu,
          transaction_nsu: "transaction-first-cycle",
          invoice_slug: "invoice-first-cycle",
        },
      },
      firstPayment.response,
      activeRuntime,
    );
    expect(firstPayment.state.status).toBe(200);

    await firestore.doc("accounts/acc-pro").update({
      renewAtMs: Date.now() - 60_000,
    });

    const renewalCheckout = await createCheckout(activeRuntime);
    expect(renewalCheckout.orderNsu).not.toBe(firstCheckout.orderNsu);

    const renewalPayment = webhookResponse();
    await infinitePayWebhookHandler(
      {
        method: "POST",
        body: {
          order_nsu: renewalCheckout.orderNsu,
          transaction_nsu: "transaction-renewal-cycle",
          invoice_slug: "invoice-renewal-cycle",
        },
      },
      renewalPayment.response,
      activeRuntime,
    );
    expect(renewalPayment.state.status).toBe(200);

    const renewedAccount = (await firestore.doc("accounts/acc-pro").get()).data();
    expect(renewedAccount).toMatchObject({
      status: "active",
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
      lastPaymentOrderNsu: renewalCheckout.orderNsu,
    });
    expect(Number(renewedAccount?.renewAtMs)).toBeGreaterThan(Date.now());
    expect((await firestore.collection("paymentTransactions").get()).size).toBe(2);
    expect((await firestore.collection("subscriptionHistory").get()).size).toBe(2);
  });
});
