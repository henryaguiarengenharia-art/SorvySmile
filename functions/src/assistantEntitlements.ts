import { PlanTier } from "./plans.js";

export const DEFAULT_ASSISTANT_MONTHLY_LIMIT = 100;
export const DEFAULT_ASSISTANT_DAILY_LIMIT = 20;
export const DEFAULT_ASSISTANT_TRIAL_LIMIT = 10;

export interface AssistantSettingsLike {
  enabled?: boolean;
  enabledAssistants?: string[];
  monthlyLimit?: number;
  dailyLimit?: number;
  trialLimit?: number;
  trialUsed?: number;
  inputTokenCostPerMillion?: number;
  outputTokenCostPerMillion?: number;
}

export interface AssistantUsageLike {
  requests?: number;
  trialRequests?: number;
  dailyUsage?: Record<string, number>;
}

export function planHasProfessionalAssistants(plan: PlanTier): boolean {
  return plan === "pro" || plan === "network";
}

export type AssistantActorRole = "hq" | "clinic" | "professional";
export type AssistantMode = "conversion" | "management";

export function assistantModesForActor(
  role: AssistantActorRole,
  ownerType?: "dentist" | "clinic",
): AssistantMode[] {
  if (role === "clinic") return ["management"];
  if (role === "professional" && ownerType === "clinic") return ["conversion"];
  return ["conversion", "management"];
}

function positiveLimit(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function assistantLimits(settings?: AssistantSettingsLike): {
  monthlyLimit: number;
  dailyLimit: number;
  trialLimit: number;
} {
  return {
    monthlyLimit: positiveLimit(settings?.monthlyLimit, DEFAULT_ASSISTANT_MONTHLY_LIMIT),
    dailyLimit: positiveLimit(settings?.dailyLimit, DEFAULT_ASSISTANT_DAILY_LIMIT),
    trialLimit: positiveLimit(settings?.trialLimit, DEFAULT_ASSISTANT_TRIAL_LIMIT),
  };
}

export function assistantEntitlement(input: {
  plan: PlanTier;
  accountActive: boolean;
  trialActive: boolean;
  trialExpired?: boolean;
  settings?: AssistantSettingsLike;
  usage?: AssistantUsageLike;
  day: string;
}): {
  enabled: boolean;
  reason: "available" | "plan" | "account" | "disabled" | "monthly_limit" | "daily_limit" | "trial_limit" | "trial_expired";
  monthlyLimit: number;
  dailyLimit: number;
  trialLimit: number;
  usedThisMonth: number;
  usedToday: number;
  usedInTrial: number;
  remainingThisMonth: number;
  remainingToday: number;
  remainingInTrial: number;
} {
  const limits = assistantLimits(input.settings);
  const usedThisMonth = Number(input.usage?.requests ?? 0);
  const usedToday = Number(input.usage?.dailyUsage?.[input.day] ?? 0);
  const usedInTrial = Number(input.usage?.trialRequests ?? 0);
  let reason: "available" | "plan" | "account" | "disabled" | "monthly_limit" | "daily_limit" | "trial_limit" | "trial_expired" = "available";
  if (!planHasProfessionalAssistants(input.plan)) reason = "plan";
  else if (input.trialExpired) reason = "trial_expired";
  else if (!input.accountActive) reason = "account";
  else if (input.settings?.enabled === false) reason = "disabled";
  else if (usedThisMonth >= limits.monthlyLimit) reason = "monthly_limit";
  else if (usedToday >= limits.dailyLimit) reason = "daily_limit";
  else if (input.trialActive && usedInTrial >= limits.trialLimit) reason = "trial_limit";
  return {
    enabled: reason === "available",
    reason,
    ...limits,
    usedThisMonth,
    usedToday,
    usedInTrial,
    remainingThisMonth: Math.max(0, limits.monthlyLimit - usedThisMonth),
    remainingToday: Math.max(0, limits.dailyLimit - usedToday),
    remainingInTrial: Math.max(0, limits.trialLimit - usedInTrial),
  };
}
