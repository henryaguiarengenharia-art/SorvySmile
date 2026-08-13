
export type AppView =
  | "landing"
  | "patient"
  | "dentist-portal"
  | "admin-dashboard"
  | "pricing"
  | "hq-dashboard"
  | "checkout-pix"
  | "checkout-confirm"
  | "checkout-done"
  | "login"
  | "privacy"
  | "subscriber-terms";

export type PlanTier = 'lite' | 'pro' | 'network';
export interface PlanConfig {
  tier: PlanTier;
  price: number;
  baseMonthlyLeadLimit: number;
  includedSeats: number;
  extraSeatPrice: number;
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
    gamification: boolean;
    performanceKpis: boolean;
    teamManagement: boolean;
    leadAssignment: boolean;
  };
}

export type AccountStatus = 'active' | 'pending' | 'overdue' | 'paused';
export type AccountRisk = 'ok' | 'attention' | 'critical';

export interface BillingAccount {
  id: string;
  ownerType?: 'dentist' | 'clinic';
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
  seatsTotal?: number;
  seatsUsed?: number;
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
  contactRequestedAtMs?: number | null;
  patientOpenedWhatsAppAtMs?: number | null;
  contactPreference?: 'patient_whatsapp' | 'professional_contact';
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

export type UserRole = 'hq' | 'clinic' | 'dentist';

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
  teamTag?: string;
  isOnDuty?: boolean;
  profileImage?: string;
}

export interface PublicProfessionalProfile {
  slug: string;
  accountId: string;
  professionalId?: string | null;
  ownerType?: 'dentist' | 'clinic';
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
  role: 'hq' | 'clinic' | 'professional';
  accountId?: string;
  professionalId?: string;
  status?: AccountStatus;
  slug?: string;
}
