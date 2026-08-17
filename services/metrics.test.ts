import { describe, expect, it } from "vitest";
import { filterLeadsByPeriod, periodDelta, previousPeriodLeads } from "./metrics";
import { LeadRecord } from "../types";

const leadAt = (id: string, createdAt: number): LeadRecord => ({
  id,
  createdAt,
  lead: { name: "Lead", whatsapp: "5531999999999", email: "", location: "" },
  scores: null,
  photoAdequate: true,
  matchStatus: "matched",
  status: "new",
  consentTimestamp: createdAt,
  consentVersion: "test",
  consentPatient: true,
});

describe("metric periods", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 100 * day;
  const leads = [leadAt("today", now), leadAt("six", now - 6 * day), leadAt("ten", now - 10 * day), leadAt("fourteen", now - 14 * day)];

  it("filters current and previous windows without overlap", () => {
    expect(filterLeadsByPeriod(leads, 7, now).map((lead) => lead.id)).toEqual(["today", "six"]);
    expect(previousPeriodLeads(leads, 7, now).map((lead) => lead.id)).toEqual(["ten", "fourteen"]);
  });

  it("keeps general history and reports safe deltas", () => {
    expect(filterLeadsByPeriod(leads, "all", now)).toHaveLength(4);
    expect(periodDelta(12, 10)).toBe(20);
    expect(periodDelta(2, 0)).toBeNull();
  });
});
