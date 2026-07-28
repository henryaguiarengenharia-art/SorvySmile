import { describe, expect, it } from "vitest";
import { visualStatusFor } from "./scoring.js";

describe("classificação visual determinística", () => {
  it.each([
    [100, "Bom"],
    [80, "Bom"],
    [79, "Atenção"],
    [60, "Atenção"],
    [59, "Avaliação"],
    [0, "Avaliação"],
  ] as const)("classifica %i como %s", (score, expected) => {
    expect(visualStatusFor(score)).toBe(expected);
  });
});
