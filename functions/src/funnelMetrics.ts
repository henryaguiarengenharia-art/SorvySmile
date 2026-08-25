import { createHash } from "node:crypto";
import { AcquisitionSource, AttributionInput } from "./attribution.js";

export type FunnelEventType =
  | "account_signup"
  | "trial_prepared"
  | "lead_captured"
  | "trial_activated"
  | "whatsapp_opened"
  | "contact_requested"
  | "subscription_cta_clicked"
  | "subscription_activated"
  | "trial_converted"
  | "trial_expired";

export interface FunnelEventInput {
  eventKey: string;
  eventType: FunnelEventType;
  accountId: string;
  professionalId?: string | null;
  leadId?: string | null;
  source: AcquisitionSource;
  attribution?: AttributionInput;
  occurredAtMs: number;
  metadata?: Record<string, unknown>;
}

export function funnelEventId(eventKey: string): string {
  return createHash("sha256").update(eventKey).digest("hex").slice(0, 32);
}

export function funnelEventFields(input: FunnelEventInput) {
  return {
    eventKey: input.eventKey,
    eventType: input.eventType,
    accountId: input.accountId,
    professionalId: input.professionalId ?? null,
    leadId: input.leadId ?? null,
    source: input.source,
    attribution: input.attribution ?? {},
    metadata: input.metadata ?? {},
    occurredAtMs: input.occurredAtMs,
    createdAtMs: input.occurredAtMs,
  };
}
