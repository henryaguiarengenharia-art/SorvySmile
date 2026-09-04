import { describe, expect, it } from "vitest";
import { LeadRecord } from "../types";
import { routeAssistantQuestion } from "./assistantRouting";

const lead = (overrides: Partial<LeadRecord>): LeadRecord => ({
  id: "lead-1",
  createdAt: Date.now() - 48 * 3_600_000,
  lead: { name: "Ana Beatriz", whatsapp: "5500000000000", email: "", location: "" },
  scores: null,
  photoAdequate: true,
  matchStatus: "matched",
  status: "new",
  consentTimestamp: Date.now(),
  consentVersion: "test",
  consentPatient: true,
  ...overrides,
});

describe("roteamento operacional da Sofia", () => {
  it("responde prioridades localmente sem depender da Gemini", () => {
    const result = routeAssistantQuestion({
      question: "Quem devo contatar hoje?",
      leads: [lead({ contactRequestedAtMs: Date.now() - 3_600_000 })],
      role: "professional",
      now: Date.now(),
    });

    expect(result?.headline).toBe("Prioridades de hoje");
    expect(result?.answer).toContain("Ana Beatriz");
    expect(result?.answer).toContain("prioridade ALTA");
    expect(result?.answer).toContain("Motivo: pediu contato e ainda não recebeu o primeiro atendimento");
    expect(result?.answer).not.toMatch(/\bscore\s+\d+/i);
    expect(result?.actionKeys).toContain("open-lead");
  });

  it("mantém o score numérico apenas como cálculo interno e expõe prioridade semântica", () => {
    const result = routeAssistantQuestion({
      question: "O que faço com Ana Beatriz?",
      leads: [lead({ contactRequestedAtMs: Date.now() - 3_600_000 })],
      role: "professional",
      now: Date.now(),
    });

    expect(result?.headline).toBe("Ana Beatriz");
    expect(result?.answer).toContain("Prioridade operacional: ALTA");
    expect(result?.answer).toContain("Próxima ação: fazer o primeiro contato");
    expect(result?.answer).not.toMatch(/\bscore\b/i);
    expect(result?.answer).not.toMatch(/Prioridade operacional:\s*\d+/i);
  });

  it("entrega atalhos de funil, post e mensagem", () => {
    const leads = [lead({}), lead({ id: "lead-2", status: "closed" })];
    expect(routeAssistantQuestion({ question: "Análise do funil", leads, role: "professional" })?.shortcut).toBe("funnel");
    expect(routeAssistantQuestion({ question: "Post do dia", leads, role: "professional" })?.actionKeys).toContain("open-post");
    expect(routeAssistantQuestion({ question: "Mensagem para novos leads", leads, role: "professional" })?.suggestedMessage).toContain("[NOME]");
  });

  it("deixa perguntas fora do roteiro para o fallback", () => {
    expect(routeAssistantQuestion({
      question: "Como devo estruturar uma campanha nova para minha clínica?",
      leads: [],
      role: "clinic",
    })).toBeNull();
  });

  it("responde informações de atendimento cadastradas sem chamar a IA", () => {
    const result = routeAssistantQuestion({
      question: "Quais são minhas informações de atendimento?",
      leads: [],
      role: "professional",
      assistantSettings: {
        accountId: "account-1",
        professionalId: "professional-1",
        enabled: true,
        name: "Clara",
        tone: "empathetic_educational",
        serviceContext: "Atendimento de segunda a sexta, das 8h às 18h.",
      },
    });
    expect(result?.headline).toBe("Informações do seu atendimento");
    expect(result?.answer).toContain("segunda a sexta");
    expect(result?.answer).toContain("Vamos organizar isso com clareza:");
    expect(result?.actionKeys).toContain("open-assistant");
  });

  it("aplica o nome escolhido nas respostas locais sem invocar a IA", () => {
    const result = routeAssistantQuestion({
      question: "Mensagem para novos leads",
      leads: [],
      role: "professional",
      assistantSettings: {
        accountId: "account-1",
        professionalId: "professional-1",
        enabled: true,
        name: "Clara",
        tone: "casual_friendly",
        serviceContext: "",
      },
    });
    expect(result?.answer).toContain("Clara prepara o rascunho");
    expect(result?.answer).toContain("Vamos lá!");
    expect(result?.answer).not.toContain("Sofia");
  });
});
