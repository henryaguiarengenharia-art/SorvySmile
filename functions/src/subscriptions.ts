import { normalizePlan, PLANS, PlanTier } from "./plans.js";

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
    paymentProvider: "infinitepay_link" as const,
    paymentStatus: "awaiting_receipt" as const,
    paymentRequestedAtMs: now,
    checkoutName: input.name,
    checkoutEmail: input.email,
    checkoutWhatsapp: input.whatsapp,
    termsVersion: input.termsVersion,
    termsAcceptedAtMs: now,
    updatedAtMs: now,
  };
}
