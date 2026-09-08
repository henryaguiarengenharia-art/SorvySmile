import { SmileScores } from "../types";

export type SmileV6AreaId = "alignment" | "brightness" | "harmony" | "balance";

export interface SmileV6TimeReference {
  eyebrow: string;
  range: string;
  headline: string;
  body: string;
  source: string;
}

export interface SmileV6Area {
  id: SmileV6AreaId;
  label: string;
  score: number;
  headline: string;
  summary: string;
  action: string;
  question: string;
  time: SmileV6TimeReference;
}

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const fullAreas = (scores: SmileScores): SmileV6Area[] => [
  {
    id: "alignment",
    label: "Alinhamento aparente",
    score: clampScore(scores.technicalInsights.alignment),
    headline: "É o ponto que mais merece ser entendido presencialmente.",
    summary: "Diferenças de posicionamento foram comparadas com os outros sinais visuais do sorriso.",
    action: "Entender se o alinhamento percebido é apenas uma característica visual ou se existe algo que vale investigar com o dentista.",
    question: "Esse alinhamento merece uma avaliação mais específica no meu caso?",
    time: {
      eyebrow: "Se houver indicação ortodôntica",
      range: "~6–30 meses",
      headline: "Mudanças de alinhamento costumam exigir horizonte de meses.",
      body: "A duração depende de complexidade, técnica, resposta individual e objetivo. A avaliação define se esse caminho é necessário no seu caso.",
      source: "Referência geral de duração: NHS · não é estimativa individual.",
    },
  },
  {
    id: "brightness",
    label: "Cor & brilho",
    score: clampScore(scores.brightnessIndex),
    headline: "A leitura de luminosidade pode abrir uma conversa sobre refinamento.",
    summary: "Cor e brilho ajudam a comparar a aparência geral, mas luz, câmera e objetivo pessoal influenciam essa percepção.",
    action: "Entender se manutenção, limpeza profissional ou clareamento supervisionado fazem sentido para o seu objetivo.",
    question: "O que eu poderia melhorar na cor sem perder naturalidade?",
    time: {
      eyebrow: "Se o objetivo for melhorar a tonalidade",
      range: "~2–6 semanas",
      headline: "Algumas mudanças de cor podem acontecer em semanas.",
      body: "Clareamento supervisionado pode ter horizontes mais curtos que mudanças de alinhamento. O dentista define indicação, técnica e segurança.",
      source: "Referência geral de clareamento domiciliar supervisionado: NHS · não é estimativa individual.",
    },
  },
  {
    id: "harmony",
    label: "Harmonia do sorriso",
    score: clampScore(scores.harmonyIndex),
    headline: "O conjunto também mostra o que vale preservar e acompanhar.",
    summary: "A harmonia visual organiza como os elementos do sorriso são percebidos em conjunto e ajuda a identificar onde existe mais contraste.",
    action: "Confirmar em avaliação se a boa base visual corresponde a uma condição bucal saudável e bem mantida.",
    question: "O que preciso fazer para preservar ou melhorar esta harmonia ao longo do tempo?",
    time: {
      eyebrow: "Se o objetivo for preservar e manter",
      range: "A partir de 1 consulta",
      headline: "Prevenção pode começar de forma simples.",
      body: "Uma avaliação pode organizar revisão, higiene profissional e manutenção quando indicadas, além de definir se existe algo que precisa de acompanhamento.",
      source: "O tempo depende do que for indicado após avaliação profissional.",
    },
  },
  {
    id: "balance",
    label: "Equilíbrio visual",
    score: clampScore(scores.technicalInsights.symmetry),
    headline: "O equilíbrio entre os lados ajuda a entender o conjunto.",
    summary: "A simetria visual da imagem é comparada com os demais sinais para mostrar onde existe maior diferença no sorriso.",
    action: "Levar este ponto para uma avaliação estética e funcional, sem presumir que exista necessidade de tratamento.",
    question: "Existe algum aspecto de equilíbrio visual que realmente valha investigar no meu sorriso?",
    time: {
      eyebrow: "Se houver uma oportunidade de refinamento",
      range: "Horizonte variável",
      headline: "Equilíbrio visual não aponta para um único caminho.",
      body: "O tempo muda conforme o objetivo e o tipo de abordagem considerada. Primeiro é preciso entender se existe algo que realmente valha modificar.",
      source: "Não há estimativa individual sem avaliação e definição de objetivo.",
    },
  },
];

const liteAreas = (scores: SmileScores): SmileV6Area[] => {
  const areas = fullAreas(scores);
  return areas.filter((area) => area.id === "brightness" || area.id === "harmony");
};

export function smileV6Areas(scores: SmileScores, fullReport: boolean): SmileV6Area[] {
  return fullReport ? fullAreas(scores) : liteAreas(scores);
}

export function smileV6OverallIndex(scores: SmileScores, fullReport: boolean): number {
  const areas = smileV6Areas(scores, fullReport);
  const average = areas.reduce((total, area) => total + area.score, 0) / areas.length;
  return Math.round(average);
}

export function smileV6PrimaryArea(scores: SmileScores, fullReport: boolean): SmileV6Area {
  const areas = smileV6Areas(scores, fullReport);
  return [...areas].sort((left, right) => left.score - right.score)[0];
}

export function smileV6HighestArea(scores: SmileScores, fullReport: boolean): SmileV6Area {
  const areas = smileV6Areas(scores, fullReport);
  return [...areas].sort((left, right) => right.score - left.score)[0];
}

export function smileV6GapFromOverall(scores: SmileScores, fullReport: boolean): number {
  const overall = smileV6OverallIndex(scores, fullReport);
  const primary = smileV6PrimaryArea(scores, fullReport);
  return Math.max(0, overall - primary.score);
}
