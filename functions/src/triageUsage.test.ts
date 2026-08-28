import { describe, expect, it } from "vitest";
import {
  canStartAnotherTriage,
  nextTriageUsage,
  previousTriageUsage,
  triageUsageFromData,
} from "./triageUsage.js";

describe("cota de triagens", () => {
  it("oferece a primeira triagem do mês sem consumir a franquia", () => {
    const first = nextTriageUsage({ completed: 0, charged: 0 });
    expect(first).toEqual({
      next: { completed: 1, charged: 0 },
      chargedThisTriage: false,
    });
    const second = nextTriageUsage(first.next);
    expect(second).toEqual({
      next: { completed: 2, charged: 1 },
      chargedThisTriage: true,
    });
  });

  it("permite a cortesia mais toda a franquia contratada", () => {
    const limit = 60;
    const beforeLast = { completed: 60, charged: 59 };
    expect(canStartAnotherTriage(beforeLast, limit)).toBe(true);
    const last = nextTriageUsage(beforeLast).next;
    expect(last).toEqual({ completed: 61, charged: 60 });
    expect(canStartAnotherTriage(last, limit)).toBe(false);
  });

  it("migra o contador legado sem cobrar a primeira análise já realizada", () => {
    expect(triageUsageFromData({ triages: 1 })).toEqual({ completed: 1, charged: 0 });
    expect(triageUsageFromData({ triages: 4 })).toEqual({ completed: 4, charged: 3 });
  });

  it("devolve apenas a unidade realmente cobrada quando a análise falha", () => {
    expect(previousTriageUsage({ completed: 2, charged: 1 }, true)).toEqual({ completed: 1, charged: 0 });
    expect(previousTriageUsage({ completed: 1, charged: 0 }, false)).toEqual({ completed: 0, charged: 0 });
  });
});
