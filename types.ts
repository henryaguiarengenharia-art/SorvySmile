
export type AppView = 'landing' | 'consent' | 'capture' | 'validation' | 'analyzing' | 'results' | 'dispatch' | 'network-list' | 'clinic-portal' | 'strategy' | 'partner-clinics' | 'admin-dashboard' | 'dentist-portal' | 'pricing' | 'hq-dashboard' | 'checkout-pix' | 'checkout-confirm' | 'checkout-done' | 'login';

export type PlanTier = 'lite' | 'pro' | 'network';
export type AddOnLeads = number;

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
    leadHistoryWithPhoto: boolean;
    gamification: boolean;
    adminDashboard: boolean;
    leadAssignment: boolean;
    teamManagement: boolean;
    bioLink: boolean;
  };
}

export interface ClinicSettings {
  slaMinutes: number;
  clinicName?: string;
  receptionistWhatsapp?: string;
  publicSlug?: string;
}

export interface ClinicRecord {
  id: string;
  name: string;
  isActive: boolean;
}

export type AccountStatus = 'active' | 'pending' | 'overdue' | 'paused';
export type AccountRisk = 'ok' | 'attention' | 'critical';

export interface BillingAccount {
  id: string;
  ownerType: 'dentist' | 'clinic';
  ownerId: string;
  tier: PlanTier;
  addOnLeads: AddOnLeads;
  seatsTotal: number;
  seatsUsed: number;
  isActive: boolean;
  startAt: number;
  renewAt: number;
  status?: AccountStatus;
  riskLevel?: AccountRisk;
  accountName?: string;
  requestedPlan?: PlanTier;
  requestedAccountType?: 'dentist' | 'clinic';
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
  status: 'Bom' | 'Atenção' | 'Prioridade';
  benchmarkText: string;
  technicalInsights: {
    symmetry: number;
    alignment: number;
    reflectivity: number;
  };
  observations: string[];
  recommendation: string;
  intentCategory?: string;
  ticketLikely?: 'Baixo' | 'Médio' | 'Alto';
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
export type RiskLevel = 'ok' | 'attention' | 'critical';

export interface ChatMessage {
  id: string;
  from: 'dentist' | 'lead';
  text: string;
  ts: number;
}

export interface AuditEntry {
  ts: number;
  action: string;
  by: string;
  fromDentistId?: string;
  toDentistId?: string;
}

export interface LeadRecord {
  id: string;
  createdAt: number;
  visitTimestamp?: number;
  lead: UserLead;
  scores: SmileScores | null;
  photoAdequate: boolean | null;
  matchStatus: 'idle' | 'searching' | 'matched';
  status: LeadStatus;
  clinicAssigned?: string;
  dentistId?: string | null;
  scheduledAt?: number | null;
  firstContactAt?: number | null;
  dentistPoints?: number;
  chat?: ChatMessage[];
  isQueued?: boolean; 
  urgent?: boolean;
  auditLog?: AuditEntry[];
  intentCategory?: string;
  ticketLikely?: 'Baixo' | 'Médio' | 'Alto';
  recommendedSpecialty?: string;
  source?: 'direct' | 'bio';
  ownerType?: 'dentist' | 'clinic';
  ownerId?: string;
  consentTimestamp: number;
  consentVersion: string;
  consentPatient: boolean;
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
  clinicId?: string;
  isActive: boolean;
  createdAt: number;
  teamTag?: string;
  isOnDuty?: boolean;
  specialty?: string;
  city?: string;
  state?: string;
  publicSlug?: string;
  profileImage?: string;
  bioLink?: string;
  standardMessage?: string;
  templates?: string[];
}
