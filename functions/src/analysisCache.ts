export const ANALYSIS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ANALYSIS_CACHE_VERSION = "visual-calibration-v1";

export function analysisCacheId(imageDigest: string): string {
  return `${ANALYSIS_CACHE_VERSION}_${imageDigest}`;
}

export function cachedAnalysisScores(
  value: unknown,
  now = Date.now(),
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const cache = value as { expiresAtMs?: unknown; scores?: unknown };
  if (
    typeof cache.expiresAtMs !== "number"
    || cache.expiresAtMs <= now
    || !cache.scores
    || typeof cache.scores !== "object"
    || Array.isArray(cache.scores)
  ) {
    return null;
  }
  return cache.scores as Record<string, unknown>;
}
