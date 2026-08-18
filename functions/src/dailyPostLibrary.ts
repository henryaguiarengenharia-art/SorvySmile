import { DAILY_POST_TOPICS, EditorialTopic } from "./dailyPostContent.js";

export type DailyPostCategory =
  | "prevention"
  | "aesthetics"
  | "orthodontics"
  | "implants"
  | "pediatric"
  | "periodontics"
  | "urgent_care";

export type DailyPostGoal = "education" | "problem_awareness" | "authority" | "conversion";
export type DailyPostFormat = "single_card" | "carousel" | "qa" | "myth_truth" | "checklist";

export const DAILY_POST_LIBRARY_REVISION = 2;

export function dailyPostAssignmentDocumentId(
  professionalId: string,
  assignmentDate: string,
): string {
  return professionalId
    + "_"
    + assignmentDate
    + "_v"
    + DAILY_POST_LIBRARY_REVISION;
}

export interface SeedDailyPostTemplate {
  id: string;
  title: string;
  hook: string;
  shortText: string;
  caption: string;
  ctaText: string;
  ctaType: "schedule" | "contact" | "learn" | "save" | "share";
  hashtags: string[];
  seoKeywords: string[];
  category: DailyPostCategory;
  communicationGoal: DailyPostGoal;
  targetAudienceTags: string[];
  specialtyTags: string[];
  editorialFormat: DailyPostFormat;
  feedLayoutKey: string;
  storyLayoutKey: string;
  paletteKey: string;
  imageStrategy: "illustration" | "no_photo";
  defaultImageUrl: string;
  carouselSlides: Array<{ title: string; text: string }>;
  status: "published";
  isEvergreen: true;
  priority: number;
  availableFrom: null;
  availableUntil: null;
  version: number;
  mandatoryDate?: string;
}

const categoryHooks: Record<DailyPostCategory, string> = {
  prevention: "PREVENÇÃO NA PRÁTICA",
  aesthetics: "ESTÉTICA COM RESPONSABILIDADE",
  orthodontics: "ORTODONTIA SEM DÚVIDAS",
  implants: "REABILITAÇÃO E LONGEVIDADE",
  pediatric: "SORRISO DESDE A INFÂNCIA",
  periodontics: "GENGIVA TAMBÉM É SAÚDE",
  urgent_care: "SINAIS QUE PEDEM ATENÇÃO",
};

const palettes: Record<DailyPostCategory, string> = {
  prevention: "#14B8A6",
  aesthetics: "#8B7CF6",
  orthodontics: "#38BDF8",
  implants: "#94A3B8",
  pediatric: "#F59E8B",
  periodontics: "#FB7185",
  urgent_care: "#F97373",
};

const formatForIndex = (index: number): DailyPostFormat => {
  const position = index % 10;
  if (position <= 3) return "single_card";
  if (position <= 6) return "carousel";
  if (position === 7) return "qa";
  if (position === 8) return "myth_truth";
  return "checklist";
};

const goalPattern: DailyPostGoal[] = [
  ...Array<DailyPostGoal>(8).fill("education"),
  ...Array<DailyPostGoal>(5).fill("problem_awareness"),
  ...Array<DailyPostGoal>(4).fill("authority"),
  ...Array<DailyPostGoal>(3).fill("conversion"),
];

function buildCaption(topic: EditorialTopic): string {
  const practicalPoints = topic.points
    .map((point) => "• " + point.title + ": " + point.text)
    .join("\n");
  return [
    topic.title,
    "",
    topic.shortText,
    "",
    practicalPoints,
    "",
    "👉 " + topic.ctaText,
    "",
    "Conteúdo educativo. A orientação adequada depende de avaliação odontológica individual.",
  ].join("\n");
}

function buildCarouselSlides(topic: EditorialTopic): Array<{ title: string; text: string }> {
  return [
    { title: topic.title, text: topic.shortText },
    ...topic.points,
    { title: "PRÓXIMO PASSO", text: topic.ctaText },
  ];
}

export const DAILY_POST_TEMPLATES: SeedDailyPostTemplate[] = DAILY_POST_TOPICS.map((topic, index) => {
  const editorialFormat = formatForIndex(index);
  return {
    id: "sorvy-post-" + String(index + 1).padStart(2, "0"),
    title: topic.title,
    hook: categoryHooks[topic.category],
    shortText: topic.shortText,
    caption: buildCaption(topic),
    ctaText: topic.ctaText,
    ctaType: topic.ctaType,
    hashtags: [...topic.hashtags, "#SorvySmile"],
    seoKeywords: topic.seoKeywords,
    category: topic.category,
    communicationGoal: goalPattern[index % goalPattern.length],
    targetAudienceTags: topic.audience,
    specialtyTags: topic.specialties,
    editorialFormat,
    feedLayoutKey: "feed-editorial-v2",
    storyLayoutKey: "story-editorial-v2",
    paletteKey: palettes[topic.category],
    imageStrategy: "no_photo",
    defaultImageUrl: "",
    carouselSlides: editorialFormat === "carousel" ? buildCarouselSlides(topic) : [],
    status: "published",
    isEvergreen: true,
    priority: 100 - index,
    availableFrom: null,
    availableUntil: null,
    version: DAILY_POST_LIBRARY_REVISION,
  };
});

export function localDateKey(nowMs: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(nowMs));
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return read("year") + "-" + read("month") + "-" + read("day");
  } catch {
    return localDateKey(nowMs, "America/Sao_Paulo");
  }
}

export function scoreDailyPostTemplate(template: SeedDailyPostTemplate, input: {
  specialties: string[];
  targetAudiences: string[];
  preferredCategories: string[];
}): number {
  const matches = (left: string[], right: string[]) => left.some((item) => right.includes(item));
  return template.priority
    + (matches(template.specialtyTags, input.specialties) ? 40 : 0)
    + (matches(template.targetAudienceTags, input.targetAudiences) ? 30 : 0)
    + (input.preferredCategories.includes(template.category) ? 20 : 0);
}

export function chooseDailyPostTemplate<T extends SeedDailyPostTemplate>(templates: T[], input: {
  specialties: string[];
  targetAudiences: string[];
  preferredCategories: string[];
  blockedCategories: string[];
  usedTemplateIds: string[];
  previousCategory?: string;
}): { template: T; reason: string } | null {
  const available = templates.filter((item) => !input.blockedCategories.includes(item.category));
  if (!available.length) return null;
  const unused = available.filter((item) => !input.usedTemplateIds.includes(item.id));
  const cycle = unused.length ? unused : available;
  const withoutPrevious = cycle.filter((item) => item.category !== input.previousCategory);
  const candidates = withoutPrevious.length ? withoutPrevious : cycle;
  const ranked = [...candidates].sort((a, b) => (
    scoreDailyPostTemplate(b, input) - scoreDailyPostTemplate(a, input)
    || a.id.localeCompare(b.id)
  ));
  const template = ranked[0];
  const specific = template.specialtyTags.some((item) => input.specialties.includes(item));
  const audience = template.targetAudienceTags.some((item) => input.targetAudiences.includes(item));
  const preferred = input.preferredCategories.includes(template.category);
  return {
    template,
    reason: specific
      ? "specialty_match"
      : audience
        ? "audience_match"
        : preferred
          ? "preferred_category"
          : "evergreen_fallback",
  };
}
