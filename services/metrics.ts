import { LeadRecord } from "../types";

export type MetricPeriod = 7 | 30 | 90 | "all";

export function filterLeadsByPeriod(
  leads: LeadRecord[],
  period: MetricPeriod,
  now = Date.now(),
): LeadRecord[] {
  if (period === "all") return leads;
  const cutoff = now - period * 24 * 60 * 60 * 1000;
  return leads.filter((lead) => lead.createdAt >= cutoff && lead.createdAt <= now);
}

export function previousPeriodLeads(
  leads: LeadRecord[],
  period: Exclude<MetricPeriod, "all">,
  now = Date.now(),
): LeadRecord[] {
  const duration = period * 24 * 60 * 60 * 1000;
  const currentStart = now - duration;
  return leads.filter((lead) => lead.createdAt >= currentStart - duration && lead.createdAt < currentStart);
}

export function periodDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}
