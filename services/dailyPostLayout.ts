import { DailyPostAssignment, DailyPostVariant } from "../types";

export const DAILY_POST_DIMENSIONS = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;

export type DailyPostExportFormat = keyof typeof DAILY_POST_DIMENSIONS;

export interface TextFit {
  fontSize: number;
  lineHeight: number;
  lines: string[];
}

export interface TextFitInput {
  text: string;
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  preferredFontSize: number;
  minimumFontSize: number;
  lineHeightRatio?: number;
  measure: (text: string, fontSize: number) => number;
}

function truncateLine(
  value: string,
  maxWidth: number,
  fontSize: number,
  measure: TextFitInput["measure"],
): string {
  const ellipsis = "…";
  let output = value.trim();
  while (output && measure(output + ellipsis, fontSize) > maxWidth) {
    output = output.slice(0, -1).trimEnd();
  }
  return output ? output + ellipsis : ellipsis;
}

export function wrapMeasuredText(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: TextFitInput["measure"],
): string[] {
  const paragraphs = text.trim().split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (line && measure(candidate, fontSize) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function fitMeasuredText(input: TextFitInput): TextFit {
  const ratio = input.lineHeightRatio ?? 1.18;
  for (
    let fontSize = input.preferredFontSize;
    fontSize >= input.minimumFontSize;
    fontSize -= 2
  ) {
    const lineHeight = Math.round(fontSize * ratio);
    const lines = wrapMeasuredText(input.text, input.maxWidth, fontSize, input.measure);
    if (lines.length <= input.maxLines && lines.length * lineHeight <= input.maxHeight) {
      return { fontSize, lineHeight, lines };
    }
  }
  const fontSize = input.minimumFontSize;
  const lineHeight = Math.round(fontSize * ratio);
  const wrapped = wrapMeasuredText(input.text, input.maxWidth, fontSize, input.measure);
  const allowed = Math.max(1, Math.min(input.maxLines, Math.floor(input.maxHeight / lineHeight)));
  const lines = wrapped.slice(0, allowed);
  if (wrapped.length > allowed && lines.length) {
    lines[lines.length - 1] = truncateLine(
      lines[lines.length - 1] + " " + wrapped.slice(allowed).join(" "),
      input.maxWidth,
      fontSize,
      input.measure,
    );
  }
  return { fontSize, lineHeight, lines };
}

const CATEGORY_LABELS: Record<string, string> = {
  prevention: "PREVENÇÃO",
  aesthetics: "ESTÉTICA",
  orthodontics: "ORTODONTIA",
  implants: "IMPLANTES E PRÓTESES",
  pediatric: "ODONTOPEDIATRIA",
  periodontics: "SAÚDE GENGIVAL",
  urgent_care: "ATENÇÃO E URGÊNCIA",
};

const FORMAT_LABELS: Record<string, string> = {
  single_card: "CONTEÚDO EDUCATIVO",
  carousel: "CARROSSEL EDUCATIVO",
  qa: "DENTISTA RESPONDE",
  myth_truth: "MITO OU VERDADE",
  checklist: "CHECKLIST PRÁTICO",
};

function normalizeAccent(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value).toUpperCase() : "#14B8A6";
}

function normalizeHandle(value: string | undefined): string {
  const clean = String(value ?? "").trim().replace(/^@+/, "");
  return clean ? "@" + clean : "";
}

export interface DailyPostRenderContent {
  title: string;
  hook: string;
  body: string;
  cta: string;
  accent: string;
  categoryLabel: string;
  formatLabel: string;
  displayName: string;
  instagramHandle: string;
  imageUrl: string;
  logoUrl: string;
  includeLogo: boolean;
}

export function resolveDailyPostRenderContent(
  assignment: DailyPostAssignment,
  variant?: DailyPostVariant | null,
): DailyPostRenderContent {
  const content = assignment.contentSnapshot;
  const brand = assignment.brandSnapshot;
  const displayName = String(variant?.displayName || brand?.displayName || "Seu consultório").trim();
  return {
    title: String(variant?.title || content.title).trim(),
    hook: String(content.hook || CATEGORY_LABELS[content.category] || "SAÚDE BUCAL").trim(),
    body: String(content.shortText).trim(),
    cta: String(variant?.ctaText || content.ctaText).trim(),
    accent: normalizeAccent(variant?.paletteKey || content.paletteKey),
    categoryLabel: CATEGORY_LABELS[content.category] || "SAÚDE BUCAL",
    formatLabel: FORMAT_LABELS[content.editorialFormat] || "CONTEÚDO EDUCATIVO",
    displayName: displayName || "Seu consultório",
    instagramHandle: normalizeHandle(variant?.instagramHandle || brand?.instagramHandle),
    imageUrl: String(variant?.imageUrl || content.defaultImageUrl || "").trim(),
    logoUrl: String(brand?.logoUrl || "").trim(),
    includeLogo: variant?.includeLogo !== false,
  };
}
