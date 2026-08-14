export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type ProfessionalLifecycleStatus =
  | "active"
  | "trial"
  | "subscriber"
  | "inactive"
  | "archived";
export type TrialStatus = "not_started" | "active" | "expired" | "converted";

export interface TrialFields {
  trialStatus: TrialStatus;
  trialStartedAtMs: number;
  trialEndsAtMs: number;
  trialUntil: number;
}

export function startTrialFields(now: number): TrialFields {
  const endsAt = now + TRIAL_DURATION_MS;
  return { trialStatus: "active", trialStartedAtMs: now, trialEndsAtMs: endsAt, trialUntil: endsAt };
}

export function canStartTrial(record: { trialStartedAtMs?: number; trialEndsAtMs?: number; trialUntil?: number }): boolean {
  return !Number(record.trialStartedAtMs ?? record.trialEndsAtMs ?? record.trialUntil ?? 0);
}

export function trialStatusAt(record: {
  trialStatus?: TrialStatus;
  trialStartedAtMs?: number;
  trialEndsAtMs?: number;
  trialUntil?: number;
  status?: ProfessionalLifecycleStatus;
  isArchived?: boolean;
}, now: number): TrialStatus {
  if (record.isArchived === true || record.status === "archived") return "expired";
  if (record.trialStatus === "converted") return "converted";
  const endsAt = Number(record.trialEndsAtMs ?? record.trialUntil ?? 0);
  if (endsAt > now && Number(record.trialStartedAtMs ?? 0) > 0) return "active";
  if (record.trialStatus === "active" || endsAt > 0) return "expired";
  return "not_started";
}

export function trialDaysRemaining(record: { trialEndsAtMs?: number; trialUntil?: number }, now: number): number {
  const endsAt = Number(record.trialEndsAtMs ?? record.trialUntil ?? 0);
  return endsAt > now ? Math.ceil((endsAt - now) / 86_400_000) : 0;
}
