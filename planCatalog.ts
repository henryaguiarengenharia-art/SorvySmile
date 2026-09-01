import { PlanConfig, PlanTier } from "./types";

export interface PlanCopy {
  name: string;
  tagline: string;
  features: string[];
}

export const PLAN_ORDER: PlanTier[] = ["lite", "pro", "network"];
export const PUBLIC_PLAN_TIERS: PlanTier[] = ["lite", "pro"];

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  lite: {
    tier: "lite",
    price: 97,
    baseMonthlyLeadLimit: 15,
    includedSeats: 1,
    extraSeatPrice: 0,
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
      gamification: false,
      performanceKpis: false,
      teamManagement: false,
      leadAssignment: false,
    },
  },
  pro: {
    tier: "pro",
    price: 197,
    baseMonthlyLeadLimit: 60,
    includedSeats: 1,
    extraSeatPrice: 0,
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
      gamification: true,
      performanceKpis: false,
      teamManagement: false,
      leadAssignment: false,
    },
  },
  network: {
    tier: "network",
    price: 297,
    baseMonthlyLeadLimit: 150,
    includedSeats: 2,
    extraSeatPrice: 0,
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
      gamification: true,
      performanceKpis: true,
      teamManagement: true,
      leadAssignment: true,
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
      "Sofia para Conversão e Gestão",
      "Templates, alertas e agendamento",
    ],
  },
  network: {
    name: "Network",
    tagline: "Gerencie sua clínica e sua equipe",
    features: [
      "Até 150 triagens por mês",
      "Tudo do plano Pro",
      "2 acessos profissionais incluídos",
      "KPIs de 7, 30 e 90 dias por dentista",
      "Sofia para Conversão e Gestão",
      "Gestão de equipe e atribuição de leads",
    ],
  },
};

export function planName(tier: PlanTier): string {
  return PLAN_COPY[tier].name;
}

export function isPlanPubliclyAvailable(tier: PlanTier): boolean {
  return PUBLIC_PLAN_TIERS.includes(tier);
}
