import { describe, expect, it } from "vitest";
import {
  chooseDailyPostTemplate,
  dailyPostAssignmentDocumentId,
  DAILY_POST_LIBRARY_REVISION,
  DAILY_POST_TEMPLATES,
  localDateKey,
} from "./dailyPostLibrary.js";

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
      expect(template.carouselSlides).toHaveLength(5);
      expect(template.carouselSlides.some((slide) => /^Ponto \d/.test(slide.title))).toBe(false);
      expect(new Set(template.carouselSlides.map((slide) => slide.title)).size).toBe(5);
    }
  });

  it("entrega conteúdo completo, pesquisável e pronto para conversão", () => {
    for (const template of DAILY_POST_TEMPLATES) {
      expect(template.version).toBe(DAILY_POST_LIBRARY_REVISION);
      expect(template.shortText.length).toBeGreaterThanOrEqual(120);
      expect(template.shortText.length).toBeLessThanOrEqual(500);
      expect(template.caption).toContain(template.ctaText);
      expect(template.caption).toContain("Conteúdo educativo");
      expect(template.hashtags.length).toBeGreaterThanOrEqual(6);
      expect(new Set(template.hashtags).size).toBe(template.hashtags.length);
      expect(template.seoKeywords.length).toBeGreaterThanOrEqual(3);
      expect(template.seoKeywords.every((keyword) => keyword.length >= 4)).toBe(true);
    }
  });

  it("evita promessas e linguagem mercantilista incompatíveis com a ética odontológica", () => {
    const libraryText = DAILY_POST_TEMPLATES
      .map((template) => [
        template.title,
        template.shortText,
        template.caption,
        template.ctaText,
      ].join(" "))
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    for (const forbidden of [
      "resultado garantido",
      "sorriso perfeito",
      "sem dor garantido",
      "o melhor dentista",
      "preço imperdível",
    ]) {
      expect(libraryText).not.toContain(forbidden);
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

  it("retorna uma proposta realmente diferente ao pedir outra opção", () => {
    const current = DAILY_POST_TEMPLATES[0];
    const replacement = chooseDailyPostTemplate(DAILY_POST_TEMPLATES, {
      specialties: current.specialtyTags,
      targetAudiences: current.targetAudienceTags,
      preferredCategories: [current.category],
      blockedCategories: [],
      usedTemplateIds: [current.id],
      previousCategory: current.category,
    });
    expect(replacement).not.toBeNull();
    expect(replacement?.template.id).not.toBe(current.id);
    expect(replacement?.template.category).not.toBe(current.category);
  });

  it("calcula a data local do profissional", () => {
    expect(localDateKey(Date.UTC(2026, 0, 2, 1), "America/Sao_Paulo")).toBe("2026-01-01");
  });

  it("cria uma nova atribuição para a revisão editorial v2 sem apagar o legado", () => {
    expect(dailyPostAssignmentDocumentId("profissional-1", "2026-08-18"))
      .toBe("profissional-1_2026-08-18_v2");
  });
});
