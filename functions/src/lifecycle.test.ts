import { describe, expect, it } from "vitest";
import {
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
});
