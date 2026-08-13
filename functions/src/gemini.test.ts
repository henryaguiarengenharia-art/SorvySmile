import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  describeAiFailure,
  geminiDeveloperClient,
  normalizeSmileAnalysisResult,
} from "./gemini.js";

describe("integração Gemini Developer API", () => {
  it("usa o mesmo provedor por chave do aplicativo original", () => {
    const client = geminiDeveloperClient("test-only-key");

    expect(client.vertexai).toBe(false);
    expect(() => geminiDeveloperClient("  ")).toThrow(
      "A chave Gemini não está configurada.",
    );
  });

  it("serializa erros reais para o Cloud Logging", () => {
    const error = Object.assign(new Error("Modelo indisponível"), {
      status: 503,
      code: "UNAVAILABLE",
    });

    expect(describeAiFailure(error)).toEqual({
      name: "Error",
      message: "Modelo indisponível",
      status: 503,
      code: "UNAVAILABLE",
    });
  });

  it("instrui a análise a ser objetiva sem transformar imagem em diagnóstico", () => {
    const source = readFileSync(new URL("./gemini.ts", import.meta.url), "utf8");

    expect(source).toContain("não suavize alterações relevantes");
    expect(source).toContain("perda aparente de estrutura");
    expect(source).toContain("Nunca afirme 'cárie'");
    expect(source).toContain("avaliação odontológica prioritária");
    expect(source).toContain("Não use 'Explorar possibilidades'");
    expect(source).toContain("result.recommendedSpecialty");
    expect(source).toContain("result.intentCategory");
  });

  it("preserva o direcionamento objetivo em uma leitura com alterações marcantes", () => {
    const result = normalizeSmileAnalysisResult({
      harmonyIndex: 26.2,
      brightnessIndex: 20.4,
      visualTone: "escuro",
      benchmarkText:
        "Áreas muito escurecidas e perda aparente de estrutura em vários dentes exigem investigação odontológica prioritária.",
      technicalInsights: { symmetry: 38.1, alignment: 22.3, reflectivity: 18.4 },
      observations: [
        "Há áreas escurecidas extensas nos dentes anteriores.",
        "A estrutura dental aparenta estar comprometida em vários pontos.",
      ],
      recommendation:
        "Sugerimos uma avaliação odontológica prioritária para investigar as alterações visíveis e definir o cuidado adequado.",
      intentCategory: "Restaurações e estrutura dental",
      recommendedSpecialty: "Dentística restauradora",
    });

    expect(result.status).toBe("Avaliação");
    expect(result.intentCategory).toBe("Restaurações e estrutura dental");
    expect(result.recommendedSpecialty).toBe("Dentística restauradora");
    expect(result.benchmarkText).toContain("investigação odontológica prioritária");
  });

  it("não reduz a classificação ao índice isolado de harmonia", () => {
    const result = normalizeSmileAnalysisResult({
      harmonyIndex: 82,
      brightnessIndex: 42,
      visualTone: "intermediário",
      benchmarkText: "Diferenças de luminosidade merecem avaliação.",
      technicalInsights: { symmetry: 44, alignment: 48, reflectivity: 39 },
      observations: ["Luminosidade irregular.", "Resposta à luz reduzida."],
      recommendation: "Sugerimos uma avaliação estética e funcional presencial.",
      intentCategory: "Cor e luminosidade",
      recommendedSpecialty: "Estética odontológica",
    });

    expect(result.status).toBe("Avaliação");
  });
});
