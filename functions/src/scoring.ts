export type VisualStatus = "Bom" | "Atenção" | "Avaliação";

export function visualStatusFor(harmonyIndex: number): VisualStatus {
  if (harmonyIndex >= 80) return "Bom";
  if (harmonyIndex >= 60) return "Atenção";
  return "Avaliação";
}
