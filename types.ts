
export type AppView =
  | "landing"
  | "patient"
  | "dentist-portal"
  | "pricing"
  | "hq-dashboard"
  | "checkout-pix"
  | "checkout-confirm"
  | "checkout-done"
  | "login"
  | "privacy"
  | "subscriber-terms";

export type PlanTier = 'lite' | 'pro' | 'elite';
export interface PlanConfig {
  tier: PlanTier;
  price: number;
  baseMonthlyLeadLimit: number;
  features: {
    aiBasic: boolean;
    aiFull: boolean;
    whatsappTemplates: boolean;
    funnelSimple: boolean;
    funnelFull: boolean;
    slaAlerts: boolean;
    scheduling: boolean;
    bioLink: boolean;
    assistantPreview: boolean;
  };
}

export type AccountStatus = 'active' | 'pending' | 'overdue' | 'paused';
export type AccountRisk = 'ok' | 'attention' | 'critical';

export interface BillingAccount {
  id: string;
  tier: PlanTier;
  isActive: boolean;
  startAt: number;
  renewAt: number;
  status?: AccountStatus;
  riskLevel?: AccountRisk;
  accountName?: string;
  requestedPlan?: PlanTier;
  activatedAt?: number;
  activatedBy?: string;
  trialUntil?: number;
  overrideUntil?: number;
  checkoutName?: string;
  checkoutEmail?: string;
  checkoutWhatsapp?: string;
}

export interface SmileScores {
  harmonyIndex: number;
  brightnessIndex: number;
  vitaShade: string;
  status: 'Bom' | 'Atenção' | 'Avaliação';
  benchmarkText: string;
  technicalInsights: {
    symmetry: number;
    alignment: number;
    reflectivity: number;
  };
  observations: string[];
  recommendation: string;
  intentCategory?: string;
  recommendedSpecialty?: string;
}

export interface PhotoValidation {
  isAdequate: boolean;
  feedback: string;
}

export interface UserLead {
  name: string;
  whatsapp: string;
  email: string;
  location: string;
}

export type LeadStatus = 'new' | 'in_chat' | 'scheduled' | 'closed' | 'lost';

export interface LeadRecord {
  id: string;
  createdAt: number;
  lead: UserLead;
  scores: SmileScores | null;
  photoAdequate: boolean | null;
  matchStatus: 'idle' | 'searching' | 'matched';
  status: LeadStatus;
  dentistId?: string | null;
  scheduledAt?: number | null;
  firstContactAt?: number | null;
  intentCategory?: string;
  recommendedSpecialty?: string;
  source?: 'direct' | 'bio';
  accountId?: string;
  professionalId?: string;
  consentTimestamp: number;
  consentVersion: string;
  consentPatient: boolean;
  contactConsent?: boolean;
  privacyConsent?: boolean;
  photoConsent?: boolean;
  photoConsentAtMs?: number;
  retentionUntilMs?: number;
}

export type DentistPlan = PlanTier;

export type UserRole = 'hq' | 'dentist';

export interface DentistRecord {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  plan: DentistPlan;
  role: UserRole;
  billingAccountId: string;
  isActive: boolean;
  createdAt: number;
  specialty?: string;
  city?: string;
  state?: string;
  publicSlug?: string;
  bioLink?: string;
  bio?: string;
  standardMessage?: string;
  templates?: string[];
}

export interface PublicProfessionalProfile {
  slug: string;
  accountId: string;
  professionalId: string;
  name: string;
  whatsapp: string;
  specialty?: string;
  city?: string;
  state?: string;
  bio?: string;
  plan: PlanTier;
  active: boolean;
}

export interface WorkspaceUser {
  uid: string;
  email: string;
  role: 'hq' | 'professional';
  accountId?: string;
  professionalId?: string;
  status?: AccountStatus;
  slug?: string;
}
