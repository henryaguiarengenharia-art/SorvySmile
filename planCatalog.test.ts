import { describe, expect, it } from "vitest";
import { PLAN_CONFIGS, PLAN_COPY, PLAN_ORDER } from "./planCatalog";

describe("catálogo comercial", () => {
  it("mantém a progressão Lite, Pro e Elite", () => {
    expect(PLAN_ORDER).toEqual(["lite", "pro", "elite"]);
    expect(PLAN_COPY.lite.name).toBe("Lite");
    expect(PLAN_COPY.pro.name).toBe("Pro");
    expect(PLAN_COPY.elite.name).toBe("Elite");
  });

  it("mostra a prévia do futuro assistente somente no Elite", () => {
    expect(PLAN_CONFIGS.lite.features.assistantPreview).toBe(false);
    expect(PLAN_CONFIGS.pro.features.assistantPreview).toBe(false);
    expect(PLAN_CONFIGS.elite.features.assistantPreview).toBe(true);
  });

  it("aplica limites progressivos", () => {
    expect(PLAN_CONFIGS.lite.baseMonthlyLeadLimit).toBeLessThan(
      PLAN_CONFIGS.pro.baseMonthlyLeadLimit,
    );
    expect(PLAN_CONFIGS.pro.baseMonthlyLeadLimit).toBeLessThan(
      PLAN_CONFIGS.elite.baseMonthlyLeadLimit,
    );
    expect(PLAN_CONFIGS.lite.baseMonthlyLeadLimit).toBe(15);
  });
});
