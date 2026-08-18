import { describe, expect, it } from "vitest";
import {
  DAILY_POST_DIMENSIONS,
  fitMeasuredText,
  resolveDailyPostRenderContent,
  wrapMeasuredText,
} from "./dailyPostLayout";
import { DailyPostAssignment } from "../types";

const measure = (text: string, fontSize: number) => text.length * fontSize * 0.54;

describe("layout do Post do Dia", () => {
  it("mantém as dimensões oficiais de Feed e Story", () => {
    expect(DAILY_POST_DIMENSIONS.feed).toEqual({ width: 1080, height: 1350 });
    expect(DAILY_POST_DIMENSIONS.story).toEqual({ width: 1080, height: 1920 });
  });

  it("quebra texto sem ultrapassar a largura calculada", () => {
    const lines = wrapMeasuredText(
      "Conteúdo odontológico claro e útil para o paciente",
      280,
      28,
      measure,
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => measure(line, 28) <= 280)).toBe(true);
  });

  it("reduz o título e aplica reticências dentro do bloco seguro", () => {
    const result = fitMeasuredText({
      text: "Um título propositalmente muito longo para testar os limites seguros do arquivo exportado",
      maxWidth: 360,
      maxHeight: 130,
      maxLines: 2,
      preferredFontSize: 54,
      minimumFontSize: 30,
      measure,
    });
    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.lines.length * result.lineHeight).toBeLessThanOrEqual(130);
    expect(result.lines.at(-1)).toMatch(/…$/);
  });

  it("acomoda o maior título da biblioteca ao lado de uma imagem", () => {
    const result = fitMeasuredText({
      text: "Sensibilidade ou dor: a duração ajuda a diferenciar",
      maxWidth: 556,
      maxHeight: 245,
      maxLines: 4,
      preferredFontSize: 72,
      minimumFontSize: 48,
      measure,
    });
    expect(result.lines.length).toBeLessThanOrEqual(4);
    expect(result.lines.join(" ")).toBe(
      "Sensibilidade ou dor: a duração ajuda a diferenciar",
    );
    expect(result.lines.at(-1)).not.toMatch(/…$/);
  });

  it("aplica marca profissional e normaliza o Instagram", () => {
    const assignment = {
      contentSnapshot: {
        title: "Título",
        hook: "PREVENÇÃO",
        shortText: "Mensagem educativa",
        ctaText: "Salve este conteúdo",
        paletteKey: "#18afa5",
        category: "prevention",
        editorialFormat: "single_card",
        defaultImageUrl: "",
      },
      brandSnapshot: {
        displayName: "Clínica Sorriso",
        instagramHandle: "clinicasorriso",
        logoUrl: "",
      },
    } as DailyPostAssignment;
    const resolved = resolveDailyPostRenderContent(assignment);
    expect(resolved.displayName).toBe("Clínica Sorriso");
    expect(resolved.instagramHandle).toBe("@clinicasorriso");
    expect(resolved.accent).toBe("#18AFA5");
  });
});
