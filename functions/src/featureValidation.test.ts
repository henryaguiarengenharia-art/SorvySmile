import { describe, expect, it } from "vitest";
import { assistantRequestSchema, dailyPostSchema } from "./validation.js";

describe("new feature validation", () => {
  it("requires a schedule date for scheduled daily posts", () => {
    const post = {
      title: "Conteúdo do dia",
      caption: "Legenda completa para a publicação.",
      cta: "Agende sua avaliação",
      status: "scheduled",
    };
    expect(dailyPostSchema.safeParse(post).success).toBe(false);
    expect(dailyPostSchema.safeParse({ ...post, publishAtMs: Date.now() + 60_000 }).success).toBe(true);
  });

  it("keeps contact data out of assistant questions", () => {
    expect(assistantRequestSchema.safeParse({
      mode: "management",
      question: "Quais são as prioridades desta semana?",
    }).success).toBe(true);
    expect(assistantRequestSchema.safeParse({
      mode: "management",
      question: "Analise o telefone (31) 99999-9999",
    }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({
      mode: "management",
      question: "Analise paciente@example.com",
    }).success).toBe(false);
  });
});
