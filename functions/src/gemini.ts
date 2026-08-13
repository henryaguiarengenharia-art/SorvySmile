import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { visualStatusFor } from "./scoring.js";

const photoValidationSchema = z.object({
  isAdequate: z.boolean(),
  feedback: z.string().trim().min(3).max(240),
});

const VITA_CLASSIFICATIONS = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
] as const;

const vitaClassificationSchema = z.preprocess(
  (value) => typeof value === "string" ? value.trim().toUpperCase() : value,
  z.enum(VITA_CLASSIFICATIONS),
);

const scoreSchema = z.object({
  harmonyIndex: z.number().min(0).max(100),
  brightnessIndex: z.number().min(0).max(100),
  visualTone: vitaClassificationSchema,
  benchmarkText: z.string().trim().min(3).max(240),
  technicalInsights: z.object({
    symmetry: z.number().min(0).max(100),
    alignment: z.number().min(0).max(100),
    reflectivity: z.number().min(0).max(100),
  }),
  observations: z.array(z.string().trim().min(3).max(180)).min(2).max(4),
  recommendation: z.string().trim().min(3).max(280),
  intentCategory: z.string().trim().min(3).max(100),
  recommendedSpecialty: z.string().trim().min(3).max(100),
});

export type PhotoValidationResult = z.infer<typeof photoValidationSchema>;

export interface SmileAnalysisResult {
  harmonyIndex: number;
  brightnessIndex: number;
  vitaShade: string;
  status: "Bom" | "Atenção" | "Avaliação";
  benchmarkText: string;
  technicalInsights: {
    symmetry: number;
    alignment: number;
    reflectivity: number;
  };
  observations: string[];
  recommendation: string;
  intentCategory: string;
  recommendedSpecialty: string;
}

export interface AiFailureDetails {
  name: string;
  message: string;
  status: number | null;
  code: string | null;
}

export function normalizeSmileAnalysisResult(value: unknown): SmileAnalysisResult {
  const result = scoreSchema.parse(value);
  const harmonyIndex = Math.round(result.harmonyIndex);
  const brightnessIndex = Math.round(result.brightnessIndex);
  const symmetry = Math.round(result.technicalInsights.symmetry);
  const alignment = Math.round(result.technicalInsights.alignment);
  const reflectivity = Math.round(result.technicalInsights.reflectivity);
  const overallIndex = Math.round(
    (harmonyIndex + brightnessIndex + symmetry + alignment + reflectivity) / 5,
  );
  return {
    harmonyIndex,
    brightnessIndex,
    vitaShade: `Tom visual: ${result.visualTone}`,
    status: visualStatusFor(overallIndex),
    benchmarkText: result.benchmarkText,
    technicalInsights: {
      symmetry,
      alignment,
      reflectivity,
    },
    observations: result.observations,
    recommendation: result.recommendation,
    intentCategory: result.intentCategory,
    recommendedSpecialty: result.recommendedSpecialty,
  };
}

export function describeAiFailure(error: unknown): AiFailureDetails {
  if (error instanceof ApiError) {
    return {
      name: error.name || "ApiError",
      message: error.message,
      status: error.status,
      code: String(error.status),
    };
  }
  if (error instanceof Error) {
    const extra = error as Error & { status?: unknown; code?: unknown };
    return {
      name: error.name || "Error",
      message: error.message || "Erro sem mensagem.",
      status: typeof extra.status === "number" ? extra.status : null,
      code: extra.code == null ? null : String(extra.code),
    };
  }
  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Erro sem mensagem.",
    status: null,
    code: null,
  };
}

function parseJson(text: string | undefined): unknown {
  if (!text) throw new Error("A IA não retornou conteúdo.");
  return JSON.parse(text);
}

function imagePart(imageBase64: string, mimeType: string) {
  return {
    inlineData: {
      data: imageBase64,
      mimeType,
    },
  };
}

function isStructuredOutputRejected(error: unknown): boolean {
  return describeAiFailure(error).status === 400;
}

export function geminiDeveloperClient(apiKey: string): GoogleGenAI {
  if (!apiKey.trim()) {
    throw new Error("A chave Gemini não está configurada.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function validatePhotoWithGemini(
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: string,
): Promise<PhotoValidationResult> {
  const ai = geminiDeveloperClient(apiKey);
  const contents = {
    parts: [
      imagePart(imageBase64, mimeType),
      {
        text: [
          "Você valida somente a qualidade técnica de uma foto para uma triagem estética odontológica informativa.",
          "Marque isAdequate=true apenas quando houver uma boca humana, sorriso frontal, dentes visíveis, foco e iluminação suficientes.",
          "Não diagnostique doença, urgência ou tratamento. Se inadequada, dê uma única orientação curta e prática para reenquadrar o sorriso.",
          "Na mensagem ao usuário, prefira as palavras sorriso ou imagem; a captura já aconteceu.",
          'Responda somente JSON com {"isAdequate":boolean,"feedback":string}.',
        ].join(" "),
      },
    ],
  };
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAdequate: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
          },
          required: ["isAdequate", "feedback"],
        },
      },
    });
  } catch (error) {
    if (!isStructuredOutputRejected(error)) throw error;
    response = await ai.models.generateContent({
      model,
      contents,
      config: { temperature: 0.1, responseMimeType: "application/json" },
    });
  }

  return photoValidationSchema.parse(parseJson(response.text));
}

export async function analyzePhotoWithGemini(
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: string,
): Promise<SmileAnalysisResult> {
  const ai = geminiDeveloperClient(apiKey);
  const contents = {
    parts: [
      imagePart(imageBase64, mimeType),
      {
        text: [
          "Analise com rigor e objetividade as características visuais aparentes do sorriso para uma triagem odontológica informativa.",
          "Seu papel é retratar o que está visível e conduzir a pessoa a uma avaliação presencial; não suavize alterações relevantes com expressões vagas como 'pontos interessantes', 'explorar possibilidades' ou 'está tudo bem'.",
          "Produza índices aproximados de 0 a 100 para harmonia visual, brilho aparente, simetria, alinhamento aparente e refletividade: 100 representa condição visual muito favorável e 0 representa alterações visuais muito marcantes.",
          "Calibre os índices de forma coerente entre si: alterações extensas, áreas muito escurecidas, perda aparente de estrutura, fraturas aparentes ou grande desorganização não podem receber notas medianas ou altas.",
          "visualTone deve conter somente a classificação VITA Classic aparente mais próxima: A1, A2, A3, A3.5, A4, B1, B2, B3, B4, C1, C2, C3, C4, D2, D3 ou D4.",
          "A classificação VITA é apenas uma estimativa visual da imagem; não acrescente explicação dentro de visualTone.",
          "Não confirme diagnóstico, doença, dor, prognóstico, custo ou prazo de tratamento a partir da imagem.",
          "Você pode e deve nomear achados visuais com precisão, usando qualificadores quando necessário: áreas escurecidas, manchas aparentes, restaurações aparentes, desgaste aparente, fratura ou perda aparente de estrutura, desalinhamento, assimetria e alteração aparente do contorno gengival.",
          "Nunca afirme 'cárie', 'infecção' ou outra doença como diagnóstico confirmado; nesses casos recomende investigar presencialmente as alterações visíveis.",
          "benchmarkText deve identificar em uma frase direta o principal achado visual e por que ele merece avaliação. Evite elogios genéricos que ocultem o achado principal.",
          "Cada observação deve ser curta, concreta, ordenada da mais relevante para a menos relevante e servir como ponto para conversar com o dentista.",
          "recommendation deve começar com 'Sugerimos uma avaliação' e indicar de forma objetiva o que precisa ser investigado ou aprimorado. Em alterações marcantes, use 'avaliação odontológica prioritária'; prioridade de avaliação não significa diagnóstico de urgência.",
          "recommendedSpecialty deve indicar a principal área sugerida entre Estética odontológica, Dentística restauradora, Ortodontia, Periodontia, Reabilitação oral ou Avaliação odontológica geral. Não invente especialidade quando a imagem não permitir direcionamento seguro.",
          "intentCategory deve informar um foco concreto do cuidado, como Restaurações e estrutura dental, Alinhamento e harmonia, Cor e luminosidade, Gengiva e contorno ou Avaliação integral do sorriso. Não use 'Explorar possibilidades'.",
          "Não prescreva tratamento. Pode mencionar restaurações, alinhamento, clareamento ou cuidado gengival apenas como tema a ser avaliado, nunca como tratamento já definido.",
          "Exemplo moderado: 'O alinhamento dos dentes anteriores é o principal ponto que pode limitar a harmonia do sorriso e merece avaliação estética.'",
          "Exemplo marcante: 'Áreas muito escurecidas e perda aparente de estrutura em vários dentes exigem investigação odontológica prioritária.'",
          "Escreva em português do Brasil, com linguagem clara, firme, persuasiva, sem alarmismo e sem promessas.",
          "Responda somente JSON com todos os campos solicitados.",
        ].join(" "),
      },
    ],
  };
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      harmonyIndex: { type: Type.NUMBER },
      brightnessIndex: { type: Type.NUMBER },
      visualTone: { type: Type.STRING },
      benchmarkText: { type: Type.STRING },
      technicalInsights: {
        type: Type.OBJECT,
        properties: {
          symmetry: { type: Type.NUMBER },
          alignment: { type: Type.NUMBER },
          reflectivity: { type: Type.NUMBER },
        },
        required: ["symmetry", "alignment", "reflectivity"],
      },
      observations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      recommendation: { type: Type.STRING },
      intentCategory: { type: Type.STRING },
      recommendedSpecialty: { type: Type.STRING },
    },
    required: [
      "harmonyIndex",
      "brightnessIndex",
      "visualTone",
      "benchmarkText",
      "technicalInsights",
      "observations",
      "recommendation",
      "intentCategory",
      "recommendedSpecialty",
    ],
  };
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema,
      },
    });
  } catch (error) {
    if (!isStructuredOutputRejected(error)) throw error;
    response = await ai.models.generateContent({
      model,
      contents,
      config: { temperature: 0.1, responseMimeType: "application/json" },
    });
  }

  return normalizeSmileAnalysisResult(parseJson(response.text));
}
