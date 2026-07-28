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

  it("converte Network legado para Elite sem reintroduzir o produto antigo", () => {
    const result = pendingSubscriptionFields(
      {
        name: "Cliente legado",
        email: "legado@exemplo.com",
        whatsapp: "5531888888888",
        plan: "network",
        termsVersion: "2026-07",
      },
      1,
    );

    expect(result.plan).toBe("elite");
    expect(result.requestedPrice).toBe(497);
    expect(result.monthlyLeadLimit).toBe(150);
  });
});
