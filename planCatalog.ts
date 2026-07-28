import { PlanConfig, PlanTier } from "./types";

export interface PlanCopy {
  name: string;
  tagline: string;
  features: string[];
}

export const PLAN_ORDER: PlanTier[] = ["lite", "pro", "elite"];

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  lite: {
    tier: "lite",
    price: 149,
    baseMonthlyLeadLimit: 15,
    features: {
      aiBasic: true,
      aiFull: false,
      whatsappTemplates: false,
      funnelSimple: true,
      funnelFull: false,
      slaAlerts: false,
      scheduling: false,
      bioLink: true,
      assistantPreview: false,
    },
  },
  pro: {
    tier: "pro",
    price: 297,
    baseMonthlyLeadLimit: 60,
    features: {
      aiBasic: true,
      aiFull: true,
      whatsappTemplates: true,
      funnelSimple: false,
      funnelFull: true,
      slaAlerts: true,
      scheduling: true,
      bioLink: true,
      assistantPreview: false,
    },
  },
  elite: {
    tier: "elite",
    price: 497,
    baseMonthlyLeadLimit: 150,
    features: {
      aiBasic: true,
      aiFull: true,
      whatsappTemplates: true,
      funnelSimple: false,
      funnelFull: true,
      slaAlerts: true,
      scheduling: true,
      bioLink: true,
      assistantPreview: true,
    },
  },
};

export const PLAN_COPY: Record<PlanTier, PlanCopy> = {
  lite: {
    name: "Lite",
    tagline: "Comece a captar com simplicidade",
    features: [
      "Até 15 triagens por mês",
      "Preview visual com IA",
      "Link profissional para a bio",
      "Captação por nome e WhatsApp",
    ],
  },
  pro: {
    name: "Pro",
    tagline: "Converta e organize seu atendimento",
    features: [
      "Até 60 triagens por mês",
      "Relatório visual completo",
      "Painel de leads e funil CRM",
      "Templates, alertas e agendamento",
    ],
  },
  elite: {
    name: "Elite",
    tagline: "Automatize o acompanhamento",
    features: [
      "Até 150 triagens por mês",
      "Tudo do plano Pro",
      "Assistente especializado (em validação)",
      "Follow-up com liberação por etapas",
    ],
  },
};

export function planName(tier: PlanTier): string {
  return PLAN_COPY[tier].name;
}

export function paymentUrlFor(tier: PlanTier): string {
  const urls: Record<PlanTier, string> = {
    lite: import.meta.env.VITE_PAYMENT_URL_LITE ?? "",
    pro: import.meta.env.VITE_PAYMENT_URL_PRO ?? "",
    elite: import.meta.env.VITE_PAYMENT_URL_ELITE ?? "",
  };
  return urls[tier].trim();
}
