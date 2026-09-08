import { describe, expect, it } from "vitest";
import { SmileScores } from "../types";
import {
  smileV6Areas,
  smileV6GapFromOverall,
  smileV6HighestArea,
  smileV6OverallIndex,
  smileV6PrimaryArea,
} from "./smileV6Presentation";

const scores: SmileScores = {
  harmonyIndex: 78,
  brightnessIndex: 82,
  vitaShade: "A2",
  status: "Bom",
  benchmarkText: "Exemplo",
  technicalInsights: {
    symmetry: 74,
    alignment: 71,
    reflectivity: 91,
  },
  observations: ["Exemplo"],
  recommendation: "Avaliação",
  intentCategory: "Estética",
  recommendedSpecialty: "Clínica geral",
};

describe("Smile V6 presentation", () => {
  it("uses four real user-facing metrics for full reports", () => {
    expect(smileV6Areas(scores, true).map((area) => [area.id, area.score])).toEqual([
      ["alignment", 71],
      ["brightness", 82],
      ["harmony", 78],
      ["balance", 74],
    ]);
    expect(smileV6OverallIndex(scores, true)).toBe(76);
    expect(smileV6PrimaryArea(scores, true).id).toBe("alignment");
    expect(smileV6HighestArea(scores, true).id).toBe("brightness");
    expect(smileV6GapFromOverall(scores, true)).toBe(5);
  });

  it("preserves Lite differentiation by exposing only harmony and brightness", () => {
    expect(smileV6Areas(scores, false).map((area) => area.id)).toEqual([
      "brightness",
      "harmony",
    ]);
    expect(smileV6OverallIndex(scores, false)).toBe(80);
    expect(smileV6PrimaryArea(scores, false).id).toBe("harmony");
  });
});
