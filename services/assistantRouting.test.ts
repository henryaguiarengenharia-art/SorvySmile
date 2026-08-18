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
    expect(result?.actionKeys).toContain("open-lead");
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
});
