import { describe, expect, it } from "vitest";
import { FunnelEvent } from "../types";
import { calculateLaunchFunnelMetrics } from "./funnelMetrics";

const event = (eventType: FunnelEvent["eventType"], accountId: string, occurredAtMs: number, source: FunnelEvent["source"] = "bio"): FunnelEvent => ({
  id: `${eventType}-${accountId}-${occurredAtMs}`,
  eventType,
  accountId,
  source,
  occurredAtMs,
});

describe("launch funnel metrics", () => {
  it("deduplicates accounts and calculates conversion rates", () => {
    const events = [
      event("account_signup", "a", 10, "paid"),
      event("trial_prepared", "a", 20, "paid"),
      event("trial_activated", "a", 3_600_020, "paid"),
      event("lead_captured", "a", 3_600_020, "paid"),
      event("lead_captured", "a", 4_000_000, "paid"),
      event("trial_converted", "a", 5_000_000, "paid"),
      event("trial_prepared", "b", 30, "organic"),
    ];
    const result = calculateLaunchFunnelMetrics(events, "all", 10_000_000);
    expect(result.trialsPrepared).toBe(2);
    expect(result.trialsActivated).toBe(1);
    expect(result.activationRate).toBe(50);
    expect(result.trialToPaidRate).toBe(100);
    expect(result.leadsCaptured).toBe(2);
    expect(result.medianTimeToValueMs).toBe(3_600_000);
    expect(result.bySource.find((row) => row.source === "paid")?.trialConversions).toBe(1);
  });
});
