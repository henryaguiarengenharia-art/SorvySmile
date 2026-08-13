import { describe, expect, it } from "vitest";
import {
  reportHeadline,
  visualIndexHeadline,
  visualMetricLabel,
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
});
