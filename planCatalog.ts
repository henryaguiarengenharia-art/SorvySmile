import { PlanConfig, PlanTier } from "./types";

export interface PlanCopy {
  name: string;
  tagline: string;
  features: string[];
}

export const PLAN_ORDER: PlanTier[] = ["lite", "pro", "network"];

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  lite: {
    tier: "lite",
    price: 149,
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
    price: 297,
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
    price: 497,
    baseMonthlyLeadLimit: 150,
    includedSeats: 2,
    extraSeatPrice: 79,
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

export const LEAD_ADD_ONS = [
  { leads: 50, price: 99 },
  { leads: 150, price: 249 },
] as const;

export function planName(tier: PlanTier): string {
  return PLAN_COPY[tier].name;
}

export function paymentUrlFor(tier: PlanTier): string {
  const urls: Record<PlanTier, string> = {
    lite: import.meta.env.VITE_PAYMENT_URL_LITE ?? "",
    pro: import.meta.env.VITE_PAYMENT_URL_PRO ?? "",
    network:
      import.meta.env.VITE_PAYMENT_URL_NETWORK
      ?? import.meta.env.VITE_PAYMENT_URL_ELITE
      ?? "",
  };
  return urls[tier].trim();
}
