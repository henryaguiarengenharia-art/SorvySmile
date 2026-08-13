import { SmileScores } from "../types";

export type VisualMetricLevel = "strength" | "opportunity" | "attention" | "evaluation";

export function visualMetricLevel(value: number): VisualMetricLevel {
  if (value >= 85) return "strength";
  if (value >= 70) return "opportunity";
  if (value >= 50) return "attention";
  return "evaluation";
}

export function visualMetricLabel(value: number): string {
  switch (visualMetricLevel(value)) {
    case "strength":
      return "Ponto forte — pode ser refinado";
    case "opportunity":
      return "Pode evoluir";
    case "attention":
      return "Merece atenção";
    case "evaluation":
      return "Precisa de avaliação";
  }
}

export function overallVisualIndex(scores: SmileScores): number {
  const average = (
    scores.harmonyIndex
    + scores.brightnessIndex
    + scores.technicalInsights.symmetry
    + scores.technicalInsights.alignment
    + scores.technicalInsights.reflectivity
  ) / 5;
  return Math.round(average / 5) * 5;
}

export function visualIndexHeadline(value: number): string {
  if (value >= 85) return "Seu sorriso tem uma base favorável e ainda pode ser refinado";
  if (value >= 70) return "Há oportunidades claras para valorizar seu sorriso";
  if (value >= 50) return "Há pontos importantes que merecem avaliação";
  return "Alterações visuais importantes precisam de avaliação odontológica";
}

export function visualIndexSummary(value: number): string {
  if (value >= 85) {
    return "Uma avaliação estética pode identificar refinamentos de harmonia, cor e acabamento.";
  }
  if (value >= 70) {
    return "A leitura encontrou uma boa base, mas também diferenças visuais que podem limitar a harmonia do conjunto.";
  }
  if (value >= 50) {
    return "A leitura encontrou diferenças visuais relevantes. Entender a causa e as possibilidades exige avaliação presencial.";
  }
  return "A leitura encontrou alterações marcantes. O próximo passo recomendado é uma avaliação presencial para investigar suas causas.";
}

export function reportHeadline(value: number): string {
  if (value >= 85) return "Veja como refinar os pontos fortes do seu sorriso";
  if (value >= 70) return "Veja onde seu sorriso pode evoluir";
  if (value >= 50) return "Entenda os pontos que merecem atenção";
  return "Priorize uma avaliação dos pontos identificados";
}

export function vitaToneDescription(classification: string): string {
  switch (classification.trim().toUpperCase().charAt(0)) {
    case "A":
      return "Tom quente, com nuance amarelada";
    case "B":
      return "Tom amarelado, com aparência luminosa";
    case "C":
      return "Tom com nuance acinzentada";
    case "D":
      return "Tom neutro, com nuance avermelhada";
    default:
      return "Percepção de cor a confirmar presencialmente";
  }
}
