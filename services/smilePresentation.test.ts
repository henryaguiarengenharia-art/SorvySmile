import { describe, expect, it } from "vitest";
import {
  overallVisualIndex,
  reportHeadline,
  visualIndexHeadline,
  visualMetricLabel,
  vitaToneDescription,
} from "./smilePresentation";

describe("linguagem de conversão da leitura visual", () => {
  it("não apresenta um índice 72 como resultado já resolvido", () => {
    expect(visualIndexHeadline(72)).toBe(
      "Há oportunidades claras para valorizar seu sorriso",
    );
    expect(visualMetricLabel(72)).toBe("Pode evoluir");
    expect(reportHeadline(72)).toBe("Veja onde seu sorriso pode evoluir");
  });

  it("trata um índice 26 como necessidade clara de avaliação", () => {
    expect(visualIndexHeadline(26)).toBe(
      "Alterações visuais importantes precisam de avaliação odontológica",
    );
    expect(visualMetricLabel(26)).toBe("Precisa de avaliação");
    expect(reportHeadline(26)).toBe(
      "Priorize uma avaliação dos pontos identificados",
    );
  });

  it("mantém possibilidade de refinamento mesmo nos índices altos", () => {
    expect(visualMetricLabel(92)).toBe("Ponto forte — pode ser refinado");
  });

  it("traduz a classificação VITA em uma direção visual curta", () => {
    expect(vitaToneDescription("A3.5")).toBe("Tom quente, com nuance amarelada");
    expect(vitaToneDescription("C2")).toBe("Tom com nuance acinzentada");
  });

  it("apresenta o índice geral em passos de cinco para evitar falsa precisão", () => {
    expect(overallVisualIndex({
      harmonyIndex: 45,
      brightnessIndex: 50,
      vitaShade: "Tom visual: A3.5",
      technicalInsights: {
        symmetry: 45,
        alignment: 50,
        reflectivity: 45,
      },
      benchmarkText: "Diferença localizada.",
      recommendation: "Avaliação presencial.",
      observations: [],
    })).toBe(45);
  });
});
