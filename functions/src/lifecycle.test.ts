import { describe, expect, it } from "vitest";
import {
  activatePreparedTrialFields,
  TRIAL_DURATION_MS,
  canStartTrial,
  startTrialFields,
  trialDaysRemaining,
  trialStatusAt,
} from "./lifecycle.js";

describe("professional trial lifecycle", () => {
  it("persists a seven-day window", () => {
    const now = 1_700_000_000_000;
    const trial = startTrialFields(now);
    expect(trial.trialEndsAtMs - trial.trialStartedAtMs).toBe(TRIAL_DURATION_MS);
    expect(trialStatusAt(trial, now + 60_000)).toBe("active");
    expect(trialDaysRemaining(trial, now + 60_000)).toBe(7);
  });

  it("does not allow a second trial and expires deterministically", () => {
    const now = 1_700_000_000_000;
    const trial = startTrialFields(now);
    expect(canStartTrial(trial)).toBe(false);
    expect(trialStatusAt(trial, trial.trialEndsAtMs + 1)).toBe("expired");
    expect(trialDaysRemaining(trial, trial.trialEndsAtMs + 1)).toBe(0);
  });

  it("keeps a prepared trial outside the countdown and blocks a second grant", () => {
    const ready = { trialStatus: "ready" as const };
    expect(trialStatusAt(ready, 1_700_000_000_000)).toBe("ready");
    expect(canStartTrial(ready)).toBe(false);
    expect(trialDaysRemaining(ready, 1_700_000_000_000)).toBe(0);
  });

  it("starts exactly once when the first lead activates a prepared trial", () => {
    const now = 1_700_000_000_000;
    const trial = activatePreparedTrialFields({
      trialStatus: "ready",
      subscriptionStatus: "trial_ready",
    }, now);

    expect(trial).toEqual(startTrialFields(now));
    expect(activatePreparedTrialFields({
      trialStatus: "active",
      subscriptionStatus: "trial",
      trialStartedAtMs: trial?.trialStartedAtMs,
      trialEndsAtMs: trial?.trialEndsAtMs,
    }, now + 1_000)).toBeNull();
  });
});
