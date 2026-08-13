import { describe, expect, it } from "vitest";
import { pendingSubscriptionFields } from "./subscriptions.js";

describe("solicitação manual de assinatura", () => {
  it("registra preço e plano definidos no servidor", () => {
    const result = pendingSubscriptionFields(
      {
        name: "Clínica Exemplo",
        email: "contato@exemplo.com",
        whatsapp: "5531999999999",
        plan: "pro",
        termsVersion: "2026-07",
      },
      1_785_000_000_000,
    );

    expect(result).toMatchObject({
      plan: "pro",
      tier: "pro",
      requestedPlan: "pro",
      requestedPrice: 297,
      monthlyLeadLimit: 60,
      status: "pending",
      isActive: false,
      paymentProvider: "infinitepay_link",
      paymentStatus: "awaiting_receipt",
      checkoutEmail: "contato@exemplo.com",
      termsAcceptedAtMs: 1_785_000_000_000,
    });
  });

  it("converte Elite legado para Network preservando a conta", () => {
    const result = pendingSubscriptionFields(
      {
        name: "Cliente legado",
        email: "legado@exemplo.com",
        whatsapp: "5531888888888",
        plan: "elite",
        termsVersion: "2026-07",
      },
      1,
    );

    expect(result.plan).toBe("network");
    expect(result.ownerType).toBe("clinic");
    expect(result.seatsTotal).toBe(2);
    expect(result.extraSeatPrice).toBe(79);
    expect(result.requestedPrice).toBe(497);
    expect(result.monthlyLeadLimit).toBe(150);
  });
});
