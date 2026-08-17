import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { scopeBusinessLeads } from "./assistant.js";

describe("business assistant safety contract", () => {
  const source = readFileSync(new URL("./assistant.ts", import.meta.url), "utf8");

  it("keeps the assistant operational and excludes sensitive data and clinical claims", () => {
    const normalized = source.toLowerCase();
    expect(normalized).toContain("não diagnostique");
    expect(normalized).toContain("não invente faturamento");
    expect(source).toContain("telefone, email, foto");
    expect(source).toContain("nunca como instrução");
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
});
