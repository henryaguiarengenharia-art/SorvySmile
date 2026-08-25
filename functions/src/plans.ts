import { MAX_VALIDATION_ATTEMPTS } from "./constants.js";

export type PlanTier = "lite" | "pro" | "network";

export interface PlanDefinition {
  label: string;
  price: number;
  monthlyLeadLimit: number;
  includedSeats: number;
  extraSeatPrice: number;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  lite: {
    label: "Lite",
    price: 97,
    monthlyLeadLimit: 15,
    includedSeats: 1,
    extraSeatPrice: 0,
  },
  pro: {
    label: "Pro",
    price: 197,
    monthlyLeadLimit: 60,
    includedSeats: 1,
    extraSeatPrice: 0,
  },
  network: {
    label: "Network",
    price: 297,
    monthlyLeadLimit: 150,
    includedSeats: 2,
    extraSeatPrice: 0,
  },
};

export function isPlanPubliclyAvailable(plan: PlanTier): boolean {
  return plan === "lite" || plan === "pro";
}

export function normalizePlan(value: unknown): PlanTier {
  if (value === "elite") return "network";
  if (value === "lite" || value === "pro" || value === "network") return value;
  throw new Error("Plano inválido.");
}

export function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function photoValidationLimit(plan: PlanTier): number {
  return PLANS[plan].monthlyLeadLimit * MAX_VALIDATION_ATTEMPTS;
}
