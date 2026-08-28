import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  MAX_VALIDATION_ATTEMPTS,
  SUBSCRIBER_TERMS_VERSION,
} from "./constants.js";
import {
  monthKey,
  isPlanPubliclyAvailable,
  normalizePlan,
  photoValidationLimit,
  PLANS,
} from "./plans.js";
import {
  captureLeadSchema,
  checkoutSchema,
  leadAssignmentSchema,
  patientConversionActionSchema,
  slugify,
  startTriageSchema,
  teamMemberSchema,
} from "./validation.js";

describe("planos", () => {
  it("migra o valor Elite legado para Network", () => {
    expect(normalizePlan("elite")).toBe("network");
  });

  it("mantém limites progressivos", () => {
    expect(PLANS.lite.monthlyLeadLimit).toBeLessThan(PLANS.pro.monthlyLeadLimit);
    expect(PLANS.pro.monthlyLeadLimit).toBeLessThan(PLANS.network.monthlyLeadLimit);
  });

  it("usa quinze triagens no Lite", () => {
    expect(PLANS.lite.monthlyLeadLimit).toBe(15);
  });

  it("preserva três tentativas por triagem, incluindo a primeira cortesia", () => {
    expect(photoValidationLimit("lite")).toBe(48);
    expect(photoValidationLimit("pro")).toBe(183);
    expect(photoValidationLimit("network")).toBe(453);
  });

  it("mantém os preços atuais do Smile", () => {
    expect(PLANS.lite.price).toBe(97);
    expect(PLANS.pro.price).toBe(197);
    expect(PLANS.network.price).toBe(297);
  });

  it("mantém dois acessos incluídos sem vender acesso adicional", () => {
    expect(PLANS.network.includedSeats).toBe(2);
    expect(PLANS.network.extraSeatPrice).toBe(0);
  });

  it("libera contratação pública somente para Lite e Pro", () => {
    expect(isPlanPubliclyAvailable("lite")).toBe(true);
    expect(isPlanPubliclyAvailable("pro")).toBe(true);
    expect(isPlanPubliclyAvailable("network")).toBe(false);
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

describe("gestão Network", () => {
  it("valida um novo acesso profissional com senha temporária forte", () => {
    const generatedTestPassword = `${crypto.randomUUID()}A!`;
    expect(
      teamMemberSchema.parse({
        name: "Dentista Exemplo",
        email: "dentista@example.com",
        whatsapp: "31999999999",
        specialty: "Ortodontia",
        teamTag: "Especialista",
        temporaryPassword: generatedTestPassword,
      }),
    ).toBeTruthy();
  });

  it("permite devolver um lead à fila sem responsável", () => {
    expect(
      leadAssignmentSchema.parse({
        leadId: "lead_exemplo",
        professionalId: null,
      }).professionalId,
    ).toBeNull();
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

  it("distingue contratação paga e teste gratuito", () => {
    const base = {
      name: "Clínica",
      email: "clinica@example.com",
      whatsapp: "31999999999",
      specialty: "",
      plan: "pro" as const,
      termsVersion: SUBSCRIBER_TERMS_VERSION,
    };
    expect(checkoutSchema.parse(base).checkoutMode).toBe("paid");
    expect(checkoutSchema.parse({ ...base, checkoutMode: "trial" }).checkoutMode).toBe("trial");
  });
});

describe("ações de conversão do paciente", () => {
  it("aceita somente ações conhecidas vinculadas à sessão", () => {
    expect(
      patientConversionActionSchema.parse({
        sessionId: "sessao-segura-123",
        action: "contact_requested",
      }),
    ).toBeTruthy();
    expect(() =>
      patientConversionActionSchema.parse({
        sessionId: "sessao-segura-123",
        action: "diagnostico",
      }),
    ).toThrow();
  });
});
