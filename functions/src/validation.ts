import { z } from "zod";
import {
  CONSENT_VERSION,
  SUBSCRIBER_TERMS_VERSION,
} from "./constants.js";

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length >= 10 && value.length <= 15, "WhatsApp inválido.");

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

export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  whatsapp: phoneSchema,
  specialty: z.string().trim().max(100).optional().default(""),
  plan: z.enum(["lite", "pro", "elite", "network"]),
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
});

export const accountStatusSchema = z.object({
  accountId: z.string().min(3).max(160),
  status: z.enum(["active", "overdue", "paused"]),
  plan: z.enum(["lite", "pro", "elite", "network"]).optional(),
});

export const leadIdSchema = z.object({
  leadId: z.string().min(3).max(160),
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
