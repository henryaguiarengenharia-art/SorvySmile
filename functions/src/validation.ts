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
  termsVersion: z.literal(SUBSCRIBER_TERMS_VERSION),
});

export const profilePatchSchema = z.object({
  whatsapp: phoneSchema,
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().toUpperCase().length(2),
  bio: z.string().trim().max(400).optional().default(""),
  bioLink: z.string().trim().max(250).optional().default(""),
  standardMessage: z.string().trim().max(500).optional().default(""),
  templates: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  profileImage: optionalHttpsUrl.optional().default(""),
});

export const accountStatusSchema = z.object({
  accountId: z.string().min(3).max(160),
  status: z.enum(["active", "overdue", "paused"]),
  plan: z.enum(["lite", "pro", "network", "elite"]).optional(),
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
  whatsapp: phoneSchema.optional(),
  city: z.string().trim().min(2).max(80).optional(),
  state: z.string().trim().toUpperCase().length(2).optional(),
  bio: z.string().trim().max(400).optional(),
  bioLink: z.string().trim().max(250).optional(),
  standardMessage: z.string().trim().max(500).optional(),
  templates: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  teamTag: z.string().trim().max(80).optional(),
  isOnDuty: z.boolean().optional(),
  profileImage: optionalHttpsUrl.optional(),
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

export const assistantRequestSchema = z.object({
  mode: z.enum(["management", "conversion"]),
  accountId: z.string().min(3).max(160).optional(),
  leadId: z.string().min(3).max(160).optional(),
  question: z.string().trim().min(3).max(600).refine(
    (value) => !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)
      && !/(?:\d[\s().+-]*){10,}/.test(value),
    "Não inclua email ou telefone na pergunta.",
  ),
}).refine((value) => value.mode !== "conversion" || Boolean(value.leadId), {
  message: "Selecione um lead para a assistente de conversão.",
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
