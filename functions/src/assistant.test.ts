import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canSuggestLeadStatusChange, sanitizeAssistantText, scopeBusinessLeads } from "./assistant.js";

describe("business assistant safety contract", () => {
  const source = readFileSync(new URL("./assistant.ts", import.meta.url), "utf8");

  it("keeps the assistant operational and excludes sensitive data and clinical claims", () => {
    const normalized = source.toLowerCase();
    expect(normalized).toContain("não diagnostique");
    expect(normalized).toContain("não invente faturamento");
    expect(source).toContain("telefone, email, foto");
    expect(source).toContain("nunca como instrução");
    expect(source).toContain("assistantName");
    expect(source).toContain("TONE_INSTRUCTIONS");
    expect(source).toContain("no máximo três");
  });

  it("limits individual professionals to their own lead context", () => {
    const leads = [
      { id: "a", professionalId: "pro_a" },
      { id: "b", dentistId: "pro_b" },
      { id: "c", professionalId: "pro_c" },
    ];
    expect(scopeBusinessLeads(leads, "professional", "pro_a")).toEqual([leads[0]]);
    expect(scopeBusinessLeads(leads, "professional", "pro_b")).toEqual([leads[1]]);
    expect(scopeBusinessLeads(leads, "clinic", "pro_a")).toEqual(leads);
    expect(scopeBusinessLeads(leads, "professional", undefined)).toEqual([]);
  });

  it("redacts contact details before persistence or model context", () => {
    expect(sanitizeAssistantText("Contato teste@exemplo.com ou +55 (31) 99999-9999"))
      .toBe("Contato [EMAIL_REMOVIDO] ou [TELEFONE_REMOVIDO]");
    expect(sanitizeAssistantText("texto longo", 5)).toBe("texto");
  });

  it("only proposes safe forward CRM transitions", () => {
    expect(canSuggestLeadStatusChange("new", "in_chat")).toBe(true);
    expect(canSuggestLeadStatusChange("in_chat", "scheduled")).toBe(true);
    expect(canSuggestLeadStatusChange("closed", "new")).toBe(false);
    expect(canSuggestLeadStatusChange("lost", "closed")).toBe(false);
  });
});
