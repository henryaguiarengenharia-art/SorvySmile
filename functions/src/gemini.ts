import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { visualStatusFor } from "./scoring.js";

const photoValidationSchema = z.object({
  isAdequate: z.boolean(),
  feedback: z.string().trim().min(3).max(240),
});

const scoreSchema = z.object({
  harmonyIndex: z.number().min(0).max(100),
  brightnessIndex: z.number().min(0).max(100),
  visualTone: z.string().trim().min(1).max(50),
  benchmarkText: z.string().trim().min(3).max(240),
  technicalInsights: z.object({
    symmetry: z.number().min(0).max(100),
    alignment: z.number().min(0).max(100),
    reflectivity: z.number().min(0).max(100),
  }),
  observations: z.array(z.string().trim().min(3).max(180)).min(2).max(4),
  recommendation: z.string().trim().min(3).max(280),
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
          "Não diagnostique doença, urgência ou tratamento. Se inadequada, dê uma única orientação curta e prática para refazer a foto.",
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
          "Analise apenas características visuais aparentes do sorriso para uma experiência educativa de estética odontológica.",
          "Produza índices aproximados de 0 a 100 para harmonia visual, brilho aparente, simetria, alinhamento aparente e refletividade.",
          "visualTone deve ser uma descrição simples como claro, intermediário ou escuro; não informe escala VITA, porque uma foto sem calibração não permite medição clínica.",
          "Não classifique urgência ou prioridade; o aplicativo calculará uma faixa visual a partir do índice de harmonia.",
          "Não diagnostique cárie, doença, dor, urgência, especialidade, prognóstico, custo, ticket ou prazo de tratamento.",
          "A recomendação deve sempre sugerir avaliação presencial por cirurgião-dentista para qualquer decisão clínica.",
          "Escreva em português do Brasil, com linguagem acolhedora, objetiva e sem promessas.",
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
    },
    required: [
      "harmonyIndex",
      "brightnessIndex",
      "visualTone",
      "benchmarkText",
      "technicalInsights",
      "observations",
      "recommendation",
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

  const result = scoreSchema.parse(parseJson(response.text));
  const harmonyIndex = Math.round(result.harmonyIndex);
  return {
    harmonyIndex,
    brightnessIndex: Math.round(result.brightnessIndex),
    vitaShade: `Tom visual: ${result.visualTone}`,
    status: visualStatusFor(harmonyIndex),
    benchmarkText: result.benchmarkText,
    technicalInsights: {
      symmetry: Math.round(result.technicalInsights.symmetry),
      alignment: Math.round(result.technicalInsights.alignment),
      reflectivity: Math.round(result.technicalInsights.reflectivity),
    },
    observations: result.observations,
    recommendation: result.recommendation,
    intentCategory: "Avaliação estética",
    recommendedSpecialty: "Cirurgião-dentista",
  };
}
