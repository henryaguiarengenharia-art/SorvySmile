import { AcquisitionSource, FunnelEvent } from "../types";
import { MetricPeriod } from "./metrics";

export const ACQUISITION_SOURCES: AcquisitionSource[] = [
  "bio",
  "organic",
  "paid",
  "partner",
  "prospecting",
];

export interface FunnelSourceMetrics {
  source: AcquisitionSource;
  signups: number;
  trialsActivated: number;
  leads: number;
  trialConversions: number;
}

export interface LaunchFunnelMetrics {
  signups: number;
  trialsPrepared: number;
  trialsActivated: number;
  leadsCaptured: number;
  trialConversions: number;
  trialsExpired: number;
  activationRate: number;
  trialToPaidRate: number;
  medianTimeToValueMs: number | null;
  bySource: FunnelSourceMetrics[];
}

const uniqueAccounts = (events: FunnelEvent[], eventType: FunnelEvent["eventType"]): Set<string> =>
  new Set(events.filter((event) => event.eventType === eventType).map((event) => event.accountId));

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

export function calculateLaunchFunnelMetrics(
  events: FunnelEvent[],
  period: MetricPeriod,
  now = Date.now(),
): LaunchFunnelMetrics {
  const cutoff = period === "all" ? 0 : now - period * 86_400_000;
  const filtered = events.filter((event) => event.occurredAtMs >= cutoff && event.occurredAtMs <= now);
  const signups = uniqueAccounts(filtered, "account_signup");
  const prepared = uniqueAccounts(filtered, "trial_prepared");
  const activated = uniqueAccounts(filtered, "trial_activated");
  const converted = uniqueAccounts(filtered, "trial_converted");
  const convertedAsActivatedCohort = new Set(
    events
      .filter((event) => event.eventType === "trial_converted" && event.occurredAtMs <= now && activated.has(event.accountId))
      .map((event) => event.accountId),
  );
  const expired = uniqueAccounts(filtered, "trial_expired");
  const leads = filtered.filter((event) => event.eventType === "lead_captured");

  const preparedAt = new Map<string, number>();
  filtered.filter((event) => event.eventType === "trial_prepared").forEach((event) => {
    preparedAt.set(event.accountId, Math.min(preparedAt.get(event.accountId) ?? event.occurredAtMs, event.occurredAtMs));
  });
  const timeToValue = filtered
    .filter((event) => event.eventType === "trial_activated")
    .map((event) => {
      const started = preparedAt.get(event.accountId);
      return started === undefined ? null : Math.max(0, event.occurredAtMs - started);
    })
    .filter((value): value is number => value !== null);

  return {
    signups: signups.size,
    trialsPrepared: prepared.size,
    trialsActivated: activated.size,
    leadsCaptured: leads.length,
    trialConversions: converted.size,
    trialsExpired: expired.size,
    activationRate: prepared.size > 0 ? Math.round((activated.size / prepared.size) * 100) : 0,
    trialToPaidRate: activated.size > 0 ? Math.round((convertedAsActivatedCohort.size / activated.size) * 100) : 0,
    medianTimeToValueMs: median(timeToValue),
    bySource: ACQUISITION_SOURCES.map((source) => {
      const sourceEvents = filtered.filter((event) => event.source === source);
      return {
        source,
        signups: uniqueAccounts(sourceEvents, "account_signup").size,
        trialsActivated: uniqueAccounts(sourceEvents, "trial_activated").size,
        leads: sourceEvents.filter((event) => event.eventType === "lead_captured").length,
        trialConversions: uniqueAccounts(sourceEvents, "trial_converted").size,
      };
    }),
  };
}

export function formatTimeToValue(value: number | null): string {
  if (value === null) return "Sem dados";
  const hours = value / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(value / 60_000))} min`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} dias`;
}
