
import { GoogleGenAI, Type } from "@google/genai";
import { SmileScores, PhotoValidation } from "../types";

// Always use the process.env.API_KEY directly in the constructor
const getAIInstance = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const validatePhotoQuality = async (imageBase64: string): Promise<PhotoValidation> => {
  const ai = getAIInstance();
  
  const prompt = `Aja como um assistente técnico de triagem visual odontológica. Analise a imagem e valide:
  1. É um close-up nítido da boca humana (dentes e gengiva)?
  2. A imagem está focada e bem iluminada?
  
  Retorne isAdequate=true se a imagem permitir uma análise de harmonia e croma. 
  Caso contrário, retorne isAdequate=false e dê uma dica técnica curta de como melhorar (ex: "Aproxime mais a câmera" ou "Evite sombras nos dentes").`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAdequate: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ["isAdequate", "feedback"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("Resposta da IA vazia");
    return JSON.parse(text);
  } catch (e: any) {
    console.error("Erro na validação:", e);
    throw new Error("Falha ao validar imagem. Tente novamente.");
  }
};

export const analyzeSmile = async (imageBase64: string): Promise<SmileScores> => {
  const ai = getAIInstance();
  
  const prompt = `Aja como um especialista em Estética Dental e Visagismo para triagem digital. 
  Analise a foto do sorriso e gere um resumo de triagem preliminar:
  
  - Índice de Harmonia (0-100): Avalie simetria e proporção áurea.
  - Índice de Brilho (0-100): Avalie a refletividade do esmalte e uniformidade.
  - Tom VITA: Identifique o tom na escala profissional (ex: BL1, A1, A2, B1, C2).
  - Benchmarking: Crie uma frase comparativa realista (ex: "Seu brilho está acima da média para sua faixa etária").
  - Status: Classifique em 'Bom' (80-100), 'Atenção' (60-79) ou 'Prioridade' (0-59).
  - Insights Técnicos: Dê notas de 0-100 para Simetria, Alinhamento e Refletividade.
  - Recomendação: Sugira uma ação clínica não diagnóstica (ex: "Sugerimos avaliação para clareamento profissional" ou "Check-up preventivo indicado").
  
  Inteligência de Atribuição (EXTRAIA ESTES CAMPOS):
  - intentCategory: Classifique em 'Clareamento', 'Ortodontia', 'Lentes/Facetas', 'Implantes', 'Preventivo'.
  - ticketLikely: Estime o potencial financeiro do caso em 'Baixo', 'Médio' ou 'Alto'.
  - recommendedSpecialty: Sugira a especialidade ideal (ex: 'Ortodontia', 'Estética', 'Implantodontia', 'Clínico Geral').

  Responda estritamente em JSON. Use termos técnicos mas acessíveis.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            harmonyIndex: { type: Type.NUMBER },
            brightnessIndex: { type: Type.NUMBER },
            vitaShade: { type: Type.STRING },
            status: { type: Type.STRING, enum: ['Bom', 'Atenção', 'Prioridade'] },
            benchmarkText: { type: Type.STRING },
            technicalInsights: {
              type: Type.OBJECT,
              properties: {
                symmetry: { type: Type.NUMBER },
                alignment: { type: Type.NUMBER },
                reflectivity: { type: Type.NUMBER }
              },
              required: ["symmetry", "alignment", "reflectivity"]
            },
            observations: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING },
            intentCategory: { type: Type.STRING },
            ticketLikely: { type: Type.STRING, enum: ['Baixo', 'Médio', 'Alto'] },
            recommendedSpecialty: { type: Type.STRING }
          },
          required: [
            "harmonyIndex", "brightnessIndex", "vitaShade", "status", 
            "benchmarkText", "technicalInsights", "observations", 
            "recommendation", "intentCategory", "ticketLikely", "recommendedSpecialty"
          ]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("IA não retornou dados.");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Erro na análise Gemini:", error);
    throw new Error("Erro ao processar análise visual técnica.");
  }
};