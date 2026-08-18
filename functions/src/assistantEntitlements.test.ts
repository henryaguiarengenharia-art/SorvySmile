import { describe, expect, it } from "vitest";
import {
  assistantEntitlement,
  assistantLimits,
  assistantModesForActor,
  planHasProfessionalAssistants,
} from "./assistantEntitlements.js";

describe("assistant entitlements", () => {
  it("enables Pro and Network but blocks Lite", () => {
    expect(planHasProfessionalAssistants("lite")).toBe(false);
    expect(planHasProfessionalAssistants("pro")).toBe(true);
    expect(planHasProfessionalAssistants("network")).toBe(true);
  });

  it("uses configurable account limits with safe defaults", () => {
    expect(assistantLimits()).toEqual({ monthlyLimit: 100, dailyLimit: 20, trialLimit: 10 });
    expect(assistantLimits({ monthlyLimit: 250, dailyLimit: 30, trialLimit: 8 }))
      .toEqual({ monthlyLimit: 250, dailyLimit: 30, trialLimit: 8 });
  });

  it("separates Conversion and Management by operational role", () => {
    expect(assistantModesForActor("clinic", "clinic")).toEqual(["management"]);
    expect(assistantModesForActor("professional", "clinic")).toEqual(["conversion"]);
    expect(assistantModesForActor("professional", "dentist")).toEqual(["conversion", "management"]);
    expect(assistantModesForActor("hq", "clinic")).toEqual(["conversion", "management"]);
  });

  it("enforces account, monthly, daily and trial limits", () => {
    const base = { plan: "pro" as const, accountActive: true, trialActive: false, day: "2026-08-18" };
    expect(assistantEntitlement(base).reason).toBe("available");
    expect(assistantEntitlement({ ...base, trialExpired: true }).reason).toBe("trial_expired");
    expect(assistantEntitlement({ ...base, accountActive: false }).reason).toBe("account");
    expect(assistantEntitlement({ ...base, usage: { requests: 100 } }).reason).toBe("monthly_limit");
    expect(assistantEntitlement({ ...base, usage: { requests: 2, dailyUsage: { "2026-08-18": 20 } } }).reason).toBe("daily_limit");
    expect(assistantEntitlement({ ...base, trialActive: true, usage: { trialRequests: 10 } }).reason).toBe("trial_limit");
  });
});
