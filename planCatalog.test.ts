import { describe, expect, it } from "vitest";
import {
  isPlanPubliclyAvailable,
  PLAN_CONFIGS,
  PLAN_COPY,
  PLAN_ORDER,
  PUBLIC_PLAN_TIERS,
} from "./planCatalog";

describe("catálogo comercial", () => {
  it("mantém a progressão Lite, Pro e Network", () => {
    expect(PLAN_ORDER).toEqual(["lite", "pro", "network"]);
    expect(PLAN_COPY.lite.name).toBe("Lite");
    expect(PLAN_COPY.pro.name).toBe("Pro");
    expect(PLAN_COPY.network.name).toBe("Network");
  });

  it("libera Sofia no Pro e Network, mantendo equipe somente no Network", () => {
    expect(PLAN_CONFIGS.lite.features.assistantPreview).toBe(false);
    expect(PLAN_CONFIGS.pro.features.assistantPreview).toBe(true);
    expect(PLAN_CONFIGS.network.features.assistantPreview).toBe(true);
    expect(PLAN_CONFIGS.network.features.teamManagement).toBe(true);
    expect(PLAN_CONFIGS.network.features.leadAssignment).toBe(true);
    expect(PLAN_CONFIGS.network.includedSeats).toBe(2);
    expect(PLAN_CONFIGS.network.extraSeatPrice).toBe(0);
  });

  it("publica Lite e Pro e mantém Network indisponível no lançamento", () => {
    expect(PUBLIC_PLAN_TIERS).toEqual(["lite", "pro"]);
    expect(isPlanPubliclyAvailable("lite")).toBe(true);
    expect(isPlanPubliclyAvailable("pro")).toBe(true);
    expect(isPlanPubliclyAvailable("network")).toBe(false);
  });

  it("aplica os preços oficiais do lançamento", () => {
    expect(PLAN_CONFIGS.lite.price).toBe(97);
    expect(PLAN_CONFIGS.pro.price).toBe(197);
    expect(PLAN_CONFIGS.network.price).toBe(297);
  });

  it("aplica limites progressivos", () => {
    expect(PLAN_CONFIGS.lite.baseMonthlyLeadLimit).toBeLessThan(
      PLAN_CONFIGS.pro.baseMonthlyLeadLimit,
    );
    expect(PLAN_CONFIGS.pro.baseMonthlyLeadLimit).toBeLessThan(
      PLAN_CONFIGS.network.baseMonthlyLeadLimit,
    );
    expect(PLAN_CONFIGS.lite.baseMonthlyLeadLimit).toBe(15);
  });
});
