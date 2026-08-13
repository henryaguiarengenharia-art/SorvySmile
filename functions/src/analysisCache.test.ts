import { describe, expect, it } from "vitest";
import {
  ANALYSIS_CACHE_VERSION,
  ANALYSIS_CACHE_TTL_MS,
  analysisCacheId,
  cachedAnalysisScores,
} from "./analysisCache.js";

describe("cache temporário da análise visual", () => {
  it("reutiliza o resultado válido da mesma imagem", () => {
    const scores = { harmonyIndex: 60, vitaShade: "Tom visual: A3.5" };

    expect(cachedAnalysisScores({ scores, expiresAtMs: 2_000 }, 1_000)).toBe(scores);
  });

  it("descarta resultados expirados ou inválidos", () => {
    expect(cachedAnalysisScores({ scores: {}, expiresAtMs: 1_000 }, 1_000)).toBeNull();
    expect(cachedAnalysisScores({ scores: null, expiresAtMs: 2_000 }, 1_000)).toBeNull();
  });

  it("limita a reutilização a 24 horas", () => {
    expect(ANALYSIS_CACHE_TTL_MS).toBe(86_400_000);
  });

  it("isola o cache por versão da calibração", () => {
    expect(analysisCacheId("abc123")).toBe(`${ANALYSIS_CACHE_VERSION}_abc123`);
  });
});
