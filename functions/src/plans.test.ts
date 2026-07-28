import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  MAX_VALIDATION_ATTEMPTS,
  SUBSCRIBER_TERMS_VERSION,
} from "./constants.js";
import {
  monthKey,
  normalizePlan,
  photoValidationLimit,
  PLANS,
} from "./plans.js";
import {
  captureLeadSchema,
  checkoutSchema,
  slugify,
  startTriageSchema,
} from "./validation.js";

describe("planos", () => {
  it("migra o plano Network legado para Elite", () => {
    expect(normalizePlan("network")).toBe("elite");
  });

  it("mantém limites progressivos", () => {
    expect(PLANS.lite.monthlyLeadLimit).toBeLessThan(PLANS.pro.monthlyLeadLimit);
    expect(PLANS.pro.monthlyLeadLimit).toBeLessThan(PLANS.elite.monthlyLeadLimit);
  });

  it("usa quinze triagens no Lite", () => {
    expect(PLANS.lite.monthlyLeadLimit).toBe(15);
  });

  it("limita validações de foto a três tentativas por triagem contratada", () => {
    expect(photoValidationLimit("lite")).toBe(45);
    expect(photoValidationLimit("pro")).toBe(180);
    expect(photoValidationLimit("elite")).toBe(450);
  });

  it("mantém os preços atuais do Smile", () => {
    expect(PLANS.lite.price).toBe(149);
    expect(PLANS.pro.price).toBe(297);
    expect(PLANS.elite.price).toBe(497);
  });

  it("gera a chave mensal em UTC", () => {
    expect(monthKey(new Date("2026-07-27T12:00:00Z"))).toBe("2026-07");
  });
});

describe("slug", () => {
  it("normaliza nomes com acentos", () => {
    expect(slugify("Clínica Saúde Integrada BH")).toBe(
      "clinica-saude-integrada-bh",
    );
  });
});

describe("consentimentos versionados", () => {
  it("aceita o consentimento explícito e a confirmação de maioridade", () => {
    expect(
      startTriageSchema.parse({
        slug: "clinica-saude-integrada-bh",
        consentVersion: CONSENT_VERSION,
        photoConsent: true,
        adultAndOwnershipConfirmed: true,
      }),
    ).toBeTruthy();
  });

  it("recusa captura sem as duas autorizações", () => {
    expect(() =>
      captureLeadSchema.parse({
        sessionId: "sessao-segura-123",
        name: "Paciente",
        whatsapp: "31999999999",
        contactConsent: false,
        privacyConsent: true,
        consentVersion: CONSENT_VERSION,
      }),
    ).toThrow();
  });

  it("recusa versões antigas dos termos", () => {
    expect(() =>
      checkoutSchema.parse({
        name: "Clínica",
        email: "clinica@example.com",
        whatsapp: "31999999999",
        specialty: "",
        plan: "pro",
        termsVersion: "antiga",
      }),
    ).toThrow();
    expect(SUBSCRIBER_TERMS_VERSION).toBe(CONSENT_VERSION);
    expect(MAX_VALIDATION_ATTEMPTS).toBe(3);
  });
});
