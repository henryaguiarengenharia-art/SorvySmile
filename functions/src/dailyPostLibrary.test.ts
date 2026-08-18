import { describe, expect, it } from "vitest";
import { chooseDailyPostTemplate, DAILY_POST_TEMPLATES, localDateKey } from "./dailyPostLibrary.js";

describe("biblioteca do Post do Dia", () => {
  it("contém exatamente 60 conteúdos únicos nas distribuições aprovadas", () => {
    expect(DAILY_POST_TEMPLATES).toHaveLength(60);
    expect(new Set(DAILY_POST_TEMPLATES.map((item) => item.id)).size).toBe(60);
    expect(new Set(DAILY_POST_TEMPLATES.map((item) => item.title)).size).toBe(60);
    const count = (field: "category" | "communicationGoal" | "editorialFormat", value: string) => DAILY_POST_TEMPLATES.filter((item) => item[field] === value).length;
    expect([count("category", "prevention"), count("category", "aesthetics"), count("category", "orthodontics"), count("category", "implants"), count("category", "pediatric"), count("category", "periodontics"), count("category", "urgent_care")]).toEqual([12, 10, 8, 8, 8, 6, 8]);
    expect([count("communicationGoal", "education"), count("communicationGoal", "problem_awareness"), count("communicationGoal", "authority"), count("communicationGoal", "conversion")]).toEqual([24, 15, 12, 9]);
    expect([count("editorialFormat", "single_card"), count("editorialFormat", "carousel"), count("editorialFormat", "qa"), count("editorialFormat", "myth_truth"), count("editorialFormat", "checklist")]).toEqual([24, 18, 6, 6, 6]);
  });

  it("mantém entre quatro e sete páginas em todos os carrosséis", () => {
    for (const template of DAILY_POST_TEMPLATES.filter((item) => item.editorialFormat === "carousel")) {
      expect(template.carouselSlides.length).toBeGreaterThanOrEqual(4);
      expect(template.carouselSlides.length).toBeLessThanOrEqual(7);
    }
  });

  it("prioriza conteúdo compatível, evita categoria consecutiva e reinicia o ciclo", () => {
    const selected = chooseDailyPostTemplate(DAILY_POST_TEMPLATES, {
      specialties: ["orthodontics"], targetAudiences: ["teens"], preferredCategories: ["orthodontics"],
      blockedCategories: [], usedTemplateIds: [], previousCategory: "prevention",
    });
    expect(selected?.template.category).toBe("orthodontics");
    const afterCycle = chooseDailyPostTemplate(DAILY_POST_TEMPLATES.slice(0, 2), {
      specialties: [], targetAudiences: [], preferredCategories: [], blockedCategories: [],
      usedTemplateIds: DAILY_POST_TEMPLATES.slice(0, 2).map((item) => item.id), previousCategory: "prevention",
    });
    expect(afterCycle).not.toBeNull();
  });

  it("calcula a data local do profissional", () => {
    expect(localDateKey(Date.UTC(2026, 0, 2, 1), "America/Sao_Paulo")).toBe("2026-01-01");
  });
});
