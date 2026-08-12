import { describe, expect, it, vi } from "vitest";
import { verifyGeminiApi } from "./verify-gemini-api.mjs";

describe("verificação pré-deploy da Gemini API", () => {
  it("valida imagem e modelo sem colocar a chave na URL", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "OK" }] } }],
      }),
    }));

    await expect(
      verifyGeminiApi("test-secret", "gemini-3.6-flash", fetchImpl),
    ).resolves.toEqual({ model: "gemini-3.6-flash", answer: "OK" });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain("models/gemini-3.6-flash:generateContent");
    expect(url).not.toContain("test-secret");
    expect(options.headers["x-goog-api-key"]).toBe("test-secret");
    expect(options.body).toContain("inline_data");
  });

  it("interrompe o deploy quando a API rejeita a chave", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "API key not valid" } }),
    }));

    await expect(
      verifyGeminiApi("invalid-secret", "gemini-3.6-flash", fetchImpl),
    ).rejects.toThrow("API key not valid");
  });
});
