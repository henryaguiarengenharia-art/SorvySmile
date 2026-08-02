import { MAX_VALIDATION_ATTEMPTS } from "./constants.js";

export type PlanTier = "lite" | "pro" | "elite";

export interface PlanDefinition {
  label: string;
  price: number;
  monthlyLeadLimit: number;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  lite: {
    label: "Lite",
    price: 149,
    monthlyLeadLimit: 15,
  },
  pro: {
    label: "Pro",
    price: 297,
    monthlyLeadLimit: 60,
  },
  elite: {
    label: "Elite",
    price: 497,
    monthlyLeadLimit: 150,
  },
};

export function normalizePlan(value: unknown): PlanTier {
  if (value === "network") return "elite";
  if (value === "lite" || value === "pro" || value === "elite") return value;
  throw new Error("Plano inválido.");
}

export function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function photoValidationLimit(plan: PlanTier): number {
  return PLANS[plan].monthlyLeadLimit * MAX_VALIDATION_ATTEMPTS;
}
