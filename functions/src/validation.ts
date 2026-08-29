import { z } from "zod";
import {
  CONSENT_VERSION,
  SUBSCRIBER_TERMS_VERSION,
} from "./constants.js";

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length >= 10 && value.length <= 15, "WhatsApp inválido.");

const optionalHttpsUrl = z.string().trim().max(500).refine((value) => {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use uma URL https válida.");

const attributionSchema = z.object({
  utmSource: z.string().trim().max(100).optional(),
  utmMedium: z.string().trim().max(100).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  utmContent: z.string().trim().max(160).optional(),
  referrer: z.string().trim().max(500).optional(),
  landingPath: z.string().trim().max(300).optional(),
}).optional().default({});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Link público inválido.");

export const imageSchema = z.object({
  sessionId: z.string().min(10).max(160),
  imageBase64: z.string().min(100).max(7_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const startTriageSchema = z.object({
  slug: slugSchema,
  consentVersion: z.literal(CONSENT_VERSION),
  photoConsent: z.literal(true),
  adultAndOwnershipConfirmed: z.literal(true),
  attribution: attributionSchema,
});

export const captureLeadSchema = z.object({
  sessionId: z.string().min(10).max(160),
  name: z.string().trim().min(2).max(100),
  whatsapp: phoneSchema,
  contactConsent: z.literal(true),
  privacyConsent: z.literal(true),
  consentVersion: z.literal(CONSENT_VERSION),
});

export const patientConversionActionSchema = z.object({
  sessionId: z.string().min(10).max(160),
  action: z.enum(["whatsapp_opened", "contact_requested"]),
});

export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  whatsapp: phoneSchema,
  specialty: z.string().trim().max(100).optional().default(""),
  plan: z.enum(["lite", "pro", "network", "elite"]),
  checkoutMode: z.enum(["paid", "trial"]).default("paid"),
  termsVersion: z.literal(SUBSCRIBER_TERMS_VERSION),
  attribution: attributionSchema,
});

export const subscriptionIntentSchema = z.object({
  context: z.enum(["trial_ready", "trial_active", "trial_expired", "pending", "overdue"]),
});

export const profilePatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  specialty: z.string().trim().max(100).optional(),
  registrationNumber: z.string().trim().max(40).optional(),
  whatsapp: phoneSchema,
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().toUpperCase().length(2),
  bio: z.string().trim().max(400).optional().default(""),
  bioLink: optionalHttpsUrl.optional().default(""),
  standardMessage: z.string().trim().max(500).optional().default(""),
  templates: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  profileImage: optionalHttpsUrl.optional().default(""),
  coverImage: optionalHttpsUrl.optional(),
  instagramHandle: z.string().trim().max(80).optional(),
});

export const accountStatusSchema = z.object({
  accountId: z.string().min(3).max(160),
  status: z.enum(["active", "overdue", "paused"]),
  plan: z.enum(["lite", "pro", "network", "elite"]).optional(),
  renewAtMs: z.number().int().positive().optional(),
});

export const leadIdSchema = z.object({
  leadId: z.string().min(3).max(160),
});

export const leadAssignmentSchema = z.object({
  leadId: z.string().min(3).max(160),
  professionalId: z.string().min(3).max(160).nullable(),
});

export const teamMemberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  whatsapp: phoneSchema,
  specialty: z.string().trim().max(100).optional().default(""),
  teamTag: z.string().trim().max(80).optional().default("Dentista"),
  temporaryPassword: z.string().min(10).max(128),
});

export const professionalStatusSchema = z.object({
  professionalId: z.string().min(3).max(160),
  isActive: z.boolean(),
});

const optionalProfileFields = {
  name: z.string().trim().min(2).max(120).optional(),
  specialty: z.string().trim().max(100).optional(),
  registrationNumber: z.string().trim().max(40).optional(),
  whatsapp: phoneSchema.optional(),
  city: z.string().trim().min(2).max(80).optional(),
  state: z.string().trim().toUpperCase().length(2).optional(),
  bio: z.string().trim().max(400).optional(),
  bioLink: optionalHttpsUrl.optional(),
  standardMessage: z.string().trim().max(500).optional(),
  templates: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  teamTag: z.string().trim().max(80).optional(),
  isOnDuty: z.boolean().optional(),
  profileImage: optionalHttpsUrl.optional(),
  coverImage: optionalHttpsUrl.optional(),
  instagramHandle: z.string().trim().max(80).optional(),
};

export const hqProfessionalPatchSchema = z.object({
  accountId: z.string().min(3).max(160),
  professionalId: z.string().min(3).max(160),
  ...optionalProfileFields,
}).refine((value) => Object.keys(value).some((key) =>
  !["accountId", "professionalId"].includes(key)
  && value[key as keyof typeof value] !== undefined,
), "Informe pelo menos um campo para atualizar.");

export const professionalArchiveSchema = z.object({
  accountId: z.string().min(3).max(160),
  professionalId: z.string().min(3).max(160),
  confirmation: z.literal("ARQUIVAR"),
  reason: z.string().trim().max(240).optional().default(""),
});
export const professionalRestoreSchema = z.object({
  accountId: z.string().min(3).max(160),
  professionalId: z.string().min(3).max(160),
});
export const professionalTrialSchema = z.object({
  accountId: z.string().min(3).max(160),
  professionalId: z.string().min(3).max(160),
});

export const professionalSlugSchema = z.object({
  accountId: z.string().min(3).max(160).optional(),
  professionalId: z.string().min(3).max(160).optional(),
  slug: slugSchema,
});

export const dailyPostSchema = z.object({
  postId: z.string().min(3).max(160).optional(),
  title: z.string().trim().min(3).max(120),
  caption: z.string().trim().min(10).max(2200),
  cta: z.string().trim().min(3).max(300),
  imageUrl: optionalHttpsUrl.optional().default(""),
  status: z.enum(["draft", "scheduled", "published", "inactive"]),
  publishAtMs: z.number().int().positive().nullable().optional(),
  expiresAtMs: z.number().int().positive().nullable().optional(),
}).refine((value) => value.status !== "scheduled" || Boolean(value.publishAtMs), {
  message: "Informe quando o conteúdo programado deve ser publicado.",
}).refine((value) => !value.expiresAtMs || !value.publishAtMs || value.expiresAtMs > value.publishAtMs, {
  message: "A expiração precisa ocorrer depois da publicação.",
});

const dailyPostStatusSchema = z.enum(["draft", "scheduled", "published", "inactive", "archived"]);
const dailyPostCategorySchema = z.enum(["prevention", "aesthetics", "orthodontics", "implants", "pediatric", "periodontics", "urgent_care"]);
const dailyPostGoalSchema = z.enum(["education", "problem_awareness", "authority", "conversion"]);
const dailyPostFormatSchema = z.enum(["single_card", "carousel", "qa", "myth_truth", "checklist"]);

export const dailyPostTemplateSchema = z.object({
  templateId: z.string().min(3).max(160).optional(),
  title: z.string().trim().min(3).max(120),
  hook: z.string().trim().min(3).max(160),
  shortText: z.string().trim().min(10).max(500),
  caption: z.string().trim().min(10).max(2200),
  ctaText: z.string().trim().min(3).max(160),
  ctaType: z.enum(["schedule", "contact", "learn", "save", "share"]),
  hashtags: z.array(z.string().trim().min(2).max(60)).max(20),
  seoKeywords: z.array(z.string().trim().min(3).max(80)).max(12).optional().default([]),
  category: dailyPostCategorySchema,
  communicationGoal: dailyPostGoalSchema,
  targetAudienceTags: z.array(z.string().trim().min(2).max(80)).max(20),
  specialtyTags: z.array(z.string().trim().min(2).max(80)).max(20),
  editorialFormat: dailyPostFormatSchema,
  feedLayoutKey: z.string().trim().min(3).max(80),
  storyLayoutKey: z.string().trim().min(3).max(80),
  paletteKey: z.string().regex(/^#[0-9a-f]{6}$/i),
  imageStrategy: z.enum(["library", "professional_photo", "clinic_photo", "uploaded_by_professional", "illustration", "no_photo"]),
  defaultImageUrl: optionalHttpsUrl.optional().default(""),
  carouselSlides: z.array(z.object({ title: z.string().max(120), text: z.string().max(500) })).max(7),
  status: dailyPostStatusSchema,
  isEvergreen: z.boolean(),
  priority: z.number().int().min(0).max(1000),
  mandatoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(""),
  availableFromMs: z.number().int().positive().nullable().optional(),
  availableUntilMs: z.number().int().positive().nullable().optional(),
}).refine((value) => value.editorialFormat !== "carousel" || (value.carouselSlides.length >= 4 && value.carouselSlides.length <= 7), {
  message: "O carrossel precisa ter entre 4 e 7 páginas.",
}).refine((value) => !value.availableUntilMs || !value.availableFromMs || value.availableUntilMs > value.availableFromMs, {
  message: "A data final precisa ocorrer depois da data inicial.",
});

export const dailyPostAssignmentRequestSchema = z.object({
  professionalId: z.string().min(3).max(160).optional(),
});

export const dailyPostEventSchema = z.object({
  assignmentId: z.string().min(3).max(220),
  eventType: z.enum(["view", "customize", "copy_caption", "download_feed", "download_story", "mark_as_used", "request_alternative"]),
  format: z.enum(["feed", "story", "carousel", "none"]).optional().default("none"),
  customizedVariant: z.object({
    title: z.string().trim().min(3).max(120),
    caption: z.string().trim().min(10).max(2200),
    ctaText: z.string().trim().min(3).max(160),
    imageUrl: optionalHttpsUrl.optional().default(""),
    includeLogo: z.boolean(),
    displayName: z.string().trim().max(120),
    instagramHandle: z.string().trim().max(80),
    paletteKey: z.string().regex(/^#[0-9a-f]{6}$/i),
  }).optional(),
});

export const assistantRequestSchema = z.object({
  mode: z.enum(["management", "conversion"]),
  accountId: z.string().min(3).max(160).optional(),
  leadId: z.string().min(3).max(160).optional(),
  conversationId: z.string().min(3).max(160).optional(),
  question: z.string().trim().min(3).max(600).refine(
    (value) => !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)
      && !/(?:\d[\s().+-]*){10,}/.test(value),
    "Não inclua email ou telefone na pergunta.",
  ),
});

export const assistantWorkspaceSchema = z.object({
  accountId: z.string().min(3).max(160).optional(),
  professionalId: z.string().min(3).max(160).optional(),
  conversationId: z.string().min(3).max(160).optional(),
});

export const assistantActionDecisionSchema = z.object({
  actionId: z.string().min(3).max(160),
  decision: z.enum(["confirm", "cancel"]),
});

export const assistantFeedbackSchema = z.object({
  conversationId: z.string().min(3).max(160),
  messageId: z.string().min(3).max(160),
  feedback: z.enum(["positive", "negative"]),
});

export const assistantClientEventSchema = z.object({
  conversationId: z.string().min(3).max(160),
  eventType: z.enum(["suggestion_copied"]),
});

export const assistantSettingsSchema = z.object({
  accountId: z.string().min(3).max(160),
  enabled: z.boolean(),
  monthlyLimit: z.number().int().min(1).max(5000),
  dailyLimit: z.number().int().min(1).max(500),
  trialLimit: z.number().int().min(1).max(100),
  inputTokenCostPerMillion: z.number().min(0).max(100),
  outputTokenCostPerMillion: z.number().min(0).max(100),
  enabledAssistants: z.array(z.enum(["sofia-conversion", "sofia-management"])).min(1).max(2),
});

export const professionalAssistantTargetSchema = z.object({
  accountId: z.string().min(3).max(160),
  professionalId: z.string().min(3).max(160),
});

export const professionalAssistantSettingsSchema = professionalAssistantTargetSchema.extend({
  enabled: z.boolean(),
  name: z.string().trim().min(2).max(40),
  tone: z.enum([
    "professional_warm",
    "direct_clinical",
    "empathetic_educational",
    "casual_friendly",
  ]),
  serviceContext: z.string().trim().max(2000),
});

export const customAssistantProfileSchema = z.object({
  accountId: z.string().min(3).max(160),
  professionalId: z.string().min(3).max(160).optional(),
  enabled: z.boolean(),
  name: z.string().trim().min(2).max(40),
  roleName: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(240),
  greeting: z.string().trim().min(3).max(260),
  avatarUrl: optionalHttpsUrl.optional().default(""),
  fullImageUrl: optionalHttpsUrl.optional().default(""),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  tone: z.string().trim().min(3).max(160),
  vocabulary: z.string().trim().max(400).optional().default(""),
  institutionalContext: z.string().trim().max(800).optional().default(""),
  approvedKnowledgeTags: z.array(z.string().trim().min(2).max(60)).max(20),
  ctaText: z.string().trim().min(2).max(100),
  ctaLink: optionalHttpsUrl,
});

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}
