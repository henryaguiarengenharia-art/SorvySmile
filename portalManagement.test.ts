import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const portal = readFileSync("components/DentistPortalView.tsx", "utf8");
const dailyPost = readFileSync("components/DailyPostCard.tsx", "utf8");
const app = readFileSync("App.tsx", "utf8");
const patientGuide = readFileSync("components/PatientAssistantGuide.tsx", "utf8");
const backend = readFileSync("functions/src/index.ts", "utf8");

describe("gestão individual do dentista", () => {
  it("abre a lista correta ao clicar nos indicadores de lead", () => {
    expect(portal).toContain("const openLeadList");
    expect(portal).toContain('onClick={() => openLeadList("new")}');
    expect(portal).toContain('onClick={() => openLeadList("in_chat")}');
    expect(portal).toContain('onClick={() => openLeadList("scheduled")}');
    expect(portal).toContain('onClick={() => openLeadList("closed")}');
  });

  it("mantém o Post do Dia como atalho, não como centro do dashboard", () => {
    expect(portal).not.toContain("<DailyPostCard post={dailyPost} history={dailyPostHistory} compact");
    expect(portal).toContain("Preparar publicação");
    expect(portal).toContain('onClick={() => setTab("post")}');
  });

  it("só mostra confirmação de Post do Dia depois de confirmar a persistência", () => {
    expect(dailyPost).toContain("const emitEvent");
    expect(dailyPost).toContain("A ação do Post do Dia não está disponível neste painel.");
    expect(app).toContain("Não foi possível confirmar a atualização do Post do Dia.");
    expect(backend).toContain("assignment: updated.exists");
  });

  it("vincula a Aury ao profissional do slug e nunca usa link externo como destino", () => {
    expect(patientGuide).toContain("Assistente virtual de ${professionalName}");
    expect(patientGuide).toContain("const contactLink = profile.whatsapp");
    expect(patientGuide).not.toContain("assistant.ctaLink ||");
    expect(backend).toContain("publicPatientAssistantForProfile");
    expect(backend).toContain("patientAssistant: publicPatientAssistantForProfile");
  });
});
