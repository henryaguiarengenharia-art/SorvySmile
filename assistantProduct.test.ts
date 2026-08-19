import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_CONFIGS } from "./planCatalog";

const backend = readFileSync("functions/src/index.ts", "utf8");
const assistantCore = readFileSync("functions/src/assistant.ts", "utf8");
const panel = readFileSync("components/AIAssistantPanel.tsx", "utf8");
const routing = readFileSync("services/assistantRouting.ts", "utf8");
const patientGuide = readFileSync("components/PatientAssistantGuide.tsx", "utf8");
const assistantSettings = readFileSync("components/ProfessionalAssistantSettingsCard.tsx", "utf8");
const professionalPortal = readFileSync("components/DentistPortalView.tsx", "utf8");
const entitlements = readFileSync("functions/src/assistantEntitlements.ts", "utf8");
const app = readFileSync("App.tsx", "utf8");
const rules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const deploy = readFileSync("scripts/deploy-firebase-homologation-full.sh", "utf8");

describe("produto de assistentes SorvySmile", () => {
  it("habilita Sofia somente no Pro e Network", () => {
    expect(PLAN_CONFIGS.lite.features.assistantPreview).toBe(false);
    expect(PLAN_CONFIGS.pro.features.assistantPreview).toBe(true);
    expect(PLAN_CONFIGS.network.features.assistantPreview).toBe(true);
    expect(backend).toContain('plan: access.plan');
    expect(backend).toContain("A Sofia está disponível nos planos Pro e Network");
  });

  it("apresenta uma única Sofia com modos, atalhos e confirmação humana", () => {
    expect(panel).toContain("assistantName");
    expect(panel).toContain("Quem devo contatar hoje?");
    expect(panel).toContain("Resumo dos últimos 30 dias");
    expect(panel).toContain("Aplicar alteração");
    expect(panel).toContain("Cancelar");
    expect(backend).toContain("resolveAssistantAction");
    expect(assistantCore).toContain("Nenhuma mensagem pode ser enviada");
  });

  it("roteia atalhos localmente e reserva a Gemini para o fallback", () => {
    expect(panel).toContain("routeAssistantQuestion");
    expect(panel).not.toContain("getAssistantWorkspace");
    expect(routing).toContain("Post do dia");
    expect(routing).toContain("Mensagem para novos leads");
    expect(panel).toContain("IA avançada somente quando necessário");
  });

  it("persiste conversas sanitizadas, uso por conta e auditoria sem acesso direto", () => {
    expect(backend).toContain("assistantConversations");
    expect(backend).toContain("sanitizedContent");
    expect(backend).toContain('assistantUsage/${access.accountId}_${access.period}');
    expect(backend).toContain("assistantAuditLogs");
    expect(rules).toContain("match /assistantConversations/{conversationId}");
    expect(rules).toContain("match /assistantActions/{actionId}");
    expect(rules).toContain("allow read, write: if false");
  });

  it("mantém Aury fora do arquivo protegido da triagem", () => {
    expect(app).toContain("PatientAssistantGuide");
    expect(app).toContain('<PatientAssistantGuide profile={profile} stage="journey" />');
    const landingPosition = app.indexOf('{view === "landing"');
    const guidePosition = app.indexOf('<PatientAssistantGuide profile={profile} stage="journey" />');
    const triagePosition = app.indexOf('{view === "patient"');
    expect(landingPosition).toBeGreaterThan(-1);
    expect(guidePosition).toBeGreaterThan(landingPosition);
    expect(guidePosition).toBeLessThan(triagePosition);
    expect(patientGuide).toContain("Como a foto é usada?");
    expect(patientGuide.toLowerCase()).toContain("não é diagnóstico nem prescrição");
    expect(patientGuide).not.toContain("askBusinessAssistant");
  });

  it("separa os modos por papel e preserva personalizações específicas", () => {
    expect(entitlements).toContain('if (role === "clinic") return ["management"]');
    expect(entitlements).toContain('ownerType === "clinic") return ["conversion"]');
    expect(backend).toContain("activeProfessionalOverrides");
    expect(backend).toContain("inheritedPublicProfile");
    expect(backend).toContain('`custom_${input.accountId}_${input.professionalId}`');
    expect(storageRules).toContain("match /assistant-assets/{accountId}/{professionalId}/{fileName}");
    expect(storageRules).toContain("currentUser().data.role == 'hq'");
    expect(backend).toContain("professionalAssistantSettings");
    expect(backend).toContain("Você só pode configurar sua própria assistente.");
    expect(assistantSettings).toContain("Configurações da Assistente IA");
    for (const tone of ["Profissional e Acolhedora", "Direta e Clínica", "Empática e Educada", "Descontraída e Amigável"]) {
      expect(readFileSync("services/professionalAssistantProfile.ts", "utf8")).toContain(tone);
    }
    expect(professionalPortal).toContain('label="Assistente"');
    expect(professionalPortal).toContain("Link da bio");
    expect(professionalPortal).toContain("Copiar link");
  });

  it("inclui callables e seeds no deploy de homologação", () => {
    for (const name of [
      "getAssistantWorkspace",
      "resolveAssistantAction",
      "recordAssistantFeedback",
      "recordAssistantClientEvent",
      "getAssistantAdminSettings",
      "getAssistantAdminOverview",
      "updateAssistantSettings",
      "updateCustomAssistantProfile",
      "getProfessionalAssistantSettings",
      "updateProfessionalAssistantSettings",
      "seedAssistantDefinitions.js",
    ]) expect(deploy).toContain(name);
  });
});
