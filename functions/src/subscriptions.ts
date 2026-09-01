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

export type CheckoutMode = "paid" | "trial";

export function paidSubscriptionExpired(
  record: {
    subscriptionStatus?: unknown;
    paymentStatus?: unknown;
    renewAtMs?: unknown;
  },
  now = Date.now(),
): boolean {
  const renewAtMs = Number(record.renewAtMs ?? 0);
  const isPaidSubscription = record.subscriptionStatus === "active"
    || record.paymentStatus === "confirmed";
  return isPaidSubscription
    && Number.isFinite(renewAtMs)
    && renewAtMs > 0
    && renewAtMs <= now;
}

function subscriptionPlanFields(input: PendingSubscriptionInput, now: number) {
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
    paymentProvider: "infinitepay" as const,
    billingMode: "checkout_integrated" as const,
    billingInterval: "monthly" as const,
    checkoutName: input.name,
    checkoutEmail: input.email,
    checkoutWhatsapp: input.whatsapp,
    termsVersion: input.termsVersion,
    termsAcceptedAtMs: now,
    updatedAtMs: now,
  };
}

export function pendingSubscriptionFields(
  input: PendingSubscriptionInput,
  now: number,
) {
  return {
    ...subscriptionPlanFields(input, now),
    status: "pending" as const,
    isActive: false,
    paymentStatus: "awaiting_first_payment" as const,
    subscriptionStatus: "pending" as const,
    paymentRequestedAtMs: now,
    trialStatus: "not_started" as const,
    trialEligible: true,
  };
}

export function trialSubscriptionFields(
  input: PendingSubscriptionInput,
  now: number,
) {
  return {
    ...subscriptionPlanFields(input, now),
    status: "active" as const,
    isActive: true,
    paymentStatus: "trial" as const,
    subscriptionStatus: "trial_ready" as const,
    trialStatus: "ready" as const,
    trialEligible: false,
    trialPreparedAtMs: now,
    trialStartedAtMs: null,
    trialEndsAtMs: null,
    trialUntil: null,
  };
}
