#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
export async function verifyGeminiApi(
  apiKey,
  model = "gemini-3.6-flash",
  fetchImpl = fetch,
) {
  if (!apiKey.trim()) throw new Error("A chave Gemini está vazia.");
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: "image/png", data: onePixelPng } },
          { text: "Confirme o recebimento da imagem respondendo apenas OK." },
        ],
      }],
      generationConfig: { maxOutputTokens: 128, temperature: 0 },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  const answer = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!response.ok || !answer) {
    const reason = String(
      payload?.error?.message || `HTTP ${response.status}`,
    ).slice(0, 300);
    throw new Error(reason);
  }

  return { model, answer };
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const apiKey = Buffer.concat(chunks).toString("utf8").trim();
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  try {
    await verifyGeminiApi(apiKey, model);
    console.log(`Gemini API multimodal OK (${model}).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Falha ao validar a chave Gemini: ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
