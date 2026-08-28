export const COMPLIMENTARY_TRIAGES_PER_MONTH = 1;

export interface TriageUsageState {
  completed: number;
  charged: number;
}

function nonNegativeInteger(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

/**
 * `triages` was the only field before the complimentary first-triage rule.
 * Treat that legacy value as completed analyses and transparently credit the
 * first one, so existing accounts do not lose their promised courtesy.
 */
export function triageUsageFromData(data?: Record<string, unknown>): TriageUsageState {
  const legacyCompleted = nonNegativeInteger(data?.triages);
  const completed = nonNegativeInteger(data?.triagesCompleted ?? legacyCompleted);
  const charged = nonNegativeInteger(
    data?.triagesCharged ?? Math.max(0, legacyCompleted - COMPLIMENTARY_TRIAGES_PER_MONTH),
  );
  return {
    completed,
    charged: Math.min(charged, completed),
  };
}

export function nextTriageUsage(current: TriageUsageState): {
  next: TriageUsageState;
  chargedThisTriage: boolean;
} {
  const completed = current.completed + 1;
  const charged = Math.max(0, completed - COMPLIMENTARY_TRIAGES_PER_MONTH);
  return {
    next: { completed, charged },
    chargedThisTriage: charged > current.charged,
  };
}

export function previousTriageUsage(
  current: TriageUsageState,
  chargedThisTriage: boolean,
): TriageUsageState {
  return {
    completed: Math.max(0, current.completed - 1),
    charged: Math.max(0, current.charged - (chargedThisTriage ? 1 : 0)),
  };
}

export function triageUsageFields(state: TriageUsageState): Record<string, number> {
  return {
    // Maintained for existing dashboard readers and integrations. It now means
    // consumed quota, never the complimentary first triage.
    triages: state.charged,
    triagesCharged: state.charged,
    triagesCompleted: state.completed,
  };
}

export function canStartAnotherTriage(
  current: TriageUsageState,
  monthlyLimit: number,
): boolean {
  return current.charged < monthlyLimit;
}
