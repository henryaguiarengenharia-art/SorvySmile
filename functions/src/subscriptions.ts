import { normalizePlan, PLANS, PlanTier } from "./plans.js";

const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

export function nextBillingDueAt(
  currentDueAt: number,
  requestedDueAt: number | undefined,
  now: number,
): number {
  if (requestedDueAt !== undefined) return requestedDueAt;
  return (currentDueAt > now ? currentDueAt : now) + BILLING_CYCLE_MS;
}

interface PendingSubscriptionInput {
  name: string;
  email: string;
  whatsapp: string;
  plan: PlanTier | "elite";
  termsVersion: string;
}

export function pendingSubscriptionFields(
  input: PendingSubscriptionInput,
  now: number,
) {
  const plan = normalizePlan(input.plan);
  return {
    plan,
    tier: plan,
    requestedPlan: plan,
    requestedPrice: PLANS[plan].price,
    monthlyLeadLimit: PLANS[plan].monthlyLeadLimit,
    ownerType: plan === "network" ? "clinic" as const : "dentist" as const,
    seatsTotal: PLANS[plan].includedSeats,
    seatsUsed: 1,
    extraSeatPrice: PLANS[plan].extraSeatPrice,
    status: "pending" as const,
    isActive: false,
    paymentProvider: "infinitepay" as const,
    paymentStatus: "awaiting_first_payment" as const,
    billingMode: "recurring_link" as const,
    billingInterval: "monthly" as const,
    paymentRequestedAtMs: now,
    trialStatus: "not_started" as const,
    trialEligible: true,
    checkoutName: input.name,
    checkoutEmail: input.email,
    checkoutWhatsapp: input.whatsapp,
    termsVersion: input.termsVersion,
    termsAcceptedAtMs: now,
    updatedAtMs: now,
  };
}
