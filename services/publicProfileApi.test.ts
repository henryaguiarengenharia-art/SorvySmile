import { describe, expect, it } from "vitest";
import { publicProfileFromData } from "./publicProfileApi";

const NOW = 1_788_000_000_000;

describe("perfil profissional público", () => {
  it("mapeia somente um perfil ativo e vigente", () => {
    const profile = publicProfileFromData("dra-helena", {
      active: true,
      accountId: "acc_1",
      professionalId: "pro_1",
      name: "Dra. Helena",
      whatsapp: "5511999999999",
      plan: "pro",
      renewAtMs: NOW + 86_400_000,
    }, NOW);

    expect(profile).toMatchObject({
      slug: "dra-helena",
      accountId: "acc_1",
      professionalId: "pro_1",
      name: "Dra. Helena",
      plan: "pro",
      active: true,
    });
  });

  it("não expõe perfil inativo ou com assinatura vencida", () => {
    expect(publicProfileFromData("inativo", { active: false, accountId: "acc_1" }, NOW)).toBeNull();
    expect(publicProfileFromData("vencido", {
      active: true,
      accountId: "acc_1",
      renewAtMs: NOW,
    }, NOW)).toBeNull();
  });

  it("oculta a vitrine no instante em que o trial termina", () => {
    expect(publicProfileFromData("trial-vencido", {
      active: true,
      accountId: "acc_1",
      status: "trial",
      trialEndsAtMs: NOW,
    }, NOW)).toBeNull();
    expect(publicProfileFromData("trial-ativo", {
      active: true,
      accountId: "acc_1",
      status: "trial",
      trialEndsAtMs: NOW + 1,
    }, NOW)).not.toBeNull();
  });

  it("rejeita perfil sem conta ou com slug inválido", () => {
    expect(publicProfileFromData("sem-conta", { active: true }, NOW)).toBeNull();
    expect(publicProfileFromData("slug/invalido", {
      active: true,
      accountId: "acc_1",
    }, NOW)).toBeNull();
  });

  it("preserva a configuração personalizada da assistente", () => {
    const profile = publicProfileFromData("dra-helena", {
      active: true,
      accountId: "acc_1",
      name: "Dra. Helena",
      whatsapp: "5511999999999",
      patientAssistant: {
        id: "assistant_1",
        name: "Lia",
        ctaText: "Falar com a Dra. Helena",
        primaryColor: "#123456",
        isCustom: true,
      },
    }, NOW);

    expect(profile?.patientAssistant).toMatchObject({
      id: "assistant_1",
      name: "Lia",
      ctaText: "Falar com a Dra. Helena",
      primaryColor: "#123456",
      isCustom: true,
    });
  });
});
