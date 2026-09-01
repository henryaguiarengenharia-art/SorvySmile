import { describe, expect, it } from "vitest";
import {
  nextBillingDueAt,
  paidSubscriptionExpired,
  pendingSubscriptionFields,
  trialSubscriptionFields,
} from "./subscriptions.js";

describe("solicitação de assinatura pela InfinitePay", () => {
  it("registra preço e plano definidos no servidor", () => {
    const result = pendingSubscriptionFields(
      {
        name: "Clínica Exemplo",
        email: "contato@exemplo.com",
        whatsapp: "5531999999999",
        plan: "pro",
        termsVersion: "2026-08",
      },
      1_785_000_000_000,
    );

    expect(result).toMatchObject({
      plan: "pro",
      tier: "pro",
      requestedPlan: "pro",
      requestedPrice: 197,
      monthlyLeadLimit: 60,
      status: "pending",
      isActive: false,
      paymentProvider: "infinitepay",
      paymentStatus: "awaiting_first_payment",
      billingMode: "checkout_integrated",
      billingInterval: "monthly",
      checkoutEmail: "contato@exemplo.com",
      termsAcceptedAtMs: 1_785_000_000_000,
    });
  });

  it("aceita o vencimento confirmado na InfinitePay", () => {
    expect(nextBillingDueAt(0, 2_000, 1_000)).toBe(2_000);
  });

  it("prepara o teste sem iniciar a janela de sete dias", () => {
    const result = trialSubscriptionFields(
      {
        name: "Dra. Teste",
        email: "teste@exemplo.com",
        whatsapp: "5531999999999",
        plan: "pro",
        termsVersion: "2026-08",
      },
      1_785_000_000_000,
    );

    expect(result).toMatchObject({
      status: "active",
      isActive: true,
      subscriptionStatus: "trial_ready",
      trialStatus: "ready",
      trialEligible: false,
      paymentStatus: "trial",
      trialPreparedAtMs: 1_785_000_000_000,
      trialStartedAtMs: null,
      trialEndsAtMs: null,
    });
  });

  it("avança 30 dias sem reduzir um vencimento futuro", () => {
    const cycle = 30 * 24 * 60 * 60 * 1000;
    expect(nextBillingDueAt(5_000, undefined, 1_000)).toBe(5_000 + cycle);
    expect(nextBillingDueAt(500, undefined, 1_000)).toBe(1_000 + cycle);
  });

  it("encerra o acesso pago no vencimento sem quebrar contas legadas", () => {
    expect(paidSubscriptionExpired({
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
      renewAtMs: 999,
    }, 1_000)).toBe(true);
    expect(paidSubscriptionExpired({
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
      renewAtMs: 1_001,
    }, 1_000)).toBe(false);
    expect(paidSubscriptionExpired({
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
    }, 1_000)).toBe(false);
  });

  it("converte Elite legado para Network preservando a conta", () => {
    const result = pendingSubscriptionFields(
      {
        name: "Cliente legado",
        email: "legado@exemplo.com",
        whatsapp: "5531888888888",
        plan: "elite",
        termsVersion: "2026-08",
      },
      1,
    );

    expect(result.plan).toBe("network");
    expect(result.ownerType).toBe("clinic");
    expect(result.seatsTotal).toBe(2);
    expect(result.extraSeatPrice).toBe(0);
    expect(result.requestedPrice).toBe(297);
    expect(result.monthlyLeadLimit).toBe(150);
  });
});
