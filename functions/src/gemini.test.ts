import { describe, expect, it } from "vitest";
import { describeAiFailure, geminiDeveloperClient } from "./gemini.js";

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
});
