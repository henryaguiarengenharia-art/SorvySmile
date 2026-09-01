
export type AppView =
  | "landing"
  | "patient"
  | "dentist-portal"
  | "admin-dashboard"
  | "pricing"
  | "hq-dashboard"
  | "checkout-pix"
  | "checkout-confirm"
  | "checkout-return"
  | "checkout-done"
  | "login"
  | "privacy"
  | "subscriber-terms";

export type PlanTier = 'lite' | 'pro' | 'network';
export type AcquisitionSource = 'bio' | 'organic' | 'paid' | 'partner' | 'prospecting';
export type FunnelEventType = 'account_signup' | 'trial_prepared' | 'lead_captured' | 'trial_activated' | 'whatsapp_opened' | 'contact_requested' | 'subscription_cta_clicked' | 'subscription_activated' | 'trial_converted' | 'trial_expired';
export interface FunnelEvent {
  id: string;
  eventType: FunnelEventType;
  accountId: string;
  professionalId?: string | null;
  leadId?: string | null;
  source: AcquisitionSource;
  attribution?: Record<string, string>;
  metadata?: Record<string, unknown>;
  occurredAtMs: number;
}
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
export type PaymentStatus =
  | 'awaiting_first_payment'
  | 'confirmed'
  | 'overdue'
  | 'paused'
  | 'awaiting_receipt'
  | 'trial';
export type ProfessionalStatus =
  | 'active'
  | 'trial'
  | 'subscriber'
  | 'inactive'
  | 'archived';
export type AccountRisk = 'ok' | 'attention' | 'critical';

export interface BillingAccount {
  id: string;
  ownerProfessionalId?: string;
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
  trialStatus?: 'not_started' | 'ready' | 'active' | 'expired' | 'converted';
  trialStartedAt?: number;
  trialUntil?: number;
  subscriptionStatus?: 'pending' | 'trial_ready' | 'trial' | 'trial_expired' | 'active' | 'overdue' | 'paused';
  archivedAt?: number;
  archivedBy?: string;
  overrideUntil?: number;
  checkoutName?: string;
  checkoutEmail?: string;
  checkoutWhatsapp?: string;
  seatsTotal?: number;
  seatsUsed?: number;
  paymentProvider?: 'infinitepay' | 'infinitepay_link';
  paymentStatus?: PaymentStatus;
  billingMode?: 'recurring_link' | 'checkout_integrated';
  billingInterval?: 'monthly';
  acquisitionSource?: AcquisitionSource;
  attributionFirstTouch?: Record<string, string>;
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
  source?: AcquisitionSource;
  attribution?: Record<string, string>;
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
  status?: ProfessionalStatus;
  createdAt: number;
  specialty?: string;
  registrationNumber?: string;
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
  coverImage?: string;
  instagramHandle?: string;
  trialStartedAt?: number;
  trialEndsAt?: number;
  archivedAt?: number;
  archivedBy?: string;
  isDemo?: boolean;
  isProtected?: boolean;
}

export interface PublicProfessionalProfile {
  slug: string;
  accountId: string;
  professionalId?: string | null;
  ownerType?: 'dentist' | 'clinic';
  name: string;
  whatsapp: string;
  specialty?: string;
  registrationNumber?: string;
  city?: string;
  state?: string;
  bio?: string;
  plan: PlanTier;
  active: boolean;
  status?: ProfessionalStatus;
  profileImage?: string;
  coverImage?: string;
  instagramHandle?: string;
  bioLink?: string;
  patientAssistant?: PublicPatientAssistant;
}

export interface PublicPatientAssistant {
  id: string;
  name: string;
  roleName: string;
  description: string;
  greeting: string;
  avatarUrl?: string;
  fullImageUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  ctaText: string;
  ctaLink: string;
  isCustom: boolean;
  tone?: ProfessionalAssistantTone;
  serviceContext?: string;
}

export type DailyPostStatus = 'draft' | 'scheduled' | 'published' | 'inactive' | 'archived';
export type DailyPostCategory = 'prevention' | 'aesthetics' | 'orthodontics' | 'implants' | 'pediatric' | 'periodontics' | 'urgent_care';
export type DailyPostFormat = 'single_card' | 'carousel' | 'qa' | 'myth_truth' | 'checklist';

export interface DailyPost {
  id: string;
  title: string;
  caption: string;
  cta: string;
  imageUrl?: string;
  status: DailyPostStatus;
  publishAt?: number;
  expiresAt?: number;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
  hook?: string;
  shortText?: string;
  ctaType?: 'schedule' | 'contact' | 'learn' | 'save' | 'share';
  hashtags?: string[];
  seoKeywords?: string[];
  category?: DailyPostCategory;
  communicationGoal?: 'education' | 'problem_awareness' | 'authority' | 'conversion';
  targetAudienceTags?: string[];
  specialtyTags?: string[];
  editorialFormat?: DailyPostFormat;
  feedLayoutKey?: string;
  storyLayoutKey?: string;
  paletteKey?: string;
  imageStrategy?: 'library' | 'professional_photo' | 'clinic_photo' | 'uploaded_by_professional' | 'illustration' | 'no_photo';
  carouselSlides?: Array<{ title: string; text: string }>;
  isEvergreen?: boolean;
  priority?: number;
  version?: number;
}

export interface DailyPostVariant {
  title: string;
  caption: string;
  ctaText: string;
  imageUrl: string;
  includeLogo: boolean;
  displayName: string;
  instagramHandle: string;
  paletteKey: string;
}

export interface DailyPostAssignment {
  id: string;
  professionalId: string;
  accountId: string;
  assignmentDate: string;
  templateId: string;
  templateVersion: number;
  libraryRevision?: number;
  category: DailyPostCategory;
  selectionReason: string;
  status: 'assigned' | 'opened' | 'customized' | 'copied' | 'downloaded' | 'used' | 'skipped';
  contentSnapshot: {
    title: string;
    hook: string;
    shortText: string;
    caption: string;
    ctaText: string;
    ctaType: string;
    hashtags: string[];
    seoKeywords?: string[];
    category: DailyPostCategory;
    communicationGoal: string;
    editorialFormat: DailyPostFormat;
    feedLayoutKey: string;
    storyLayoutKey: string;
    paletteKey: string;
    imageStrategy: string;
    defaultImageUrl: string;
    carouselSlides: Array<{ title: string; text: string }>;
  };
  brandSnapshot?: {
    displayName: string;
    instagramHandle: string;
    logoUrl: string;
  };
  customizedVariant?: DailyPostVariant | null;
  alternativeCount: number;
  generatedAtMs: number;
}

export interface DailyPostEventRecord {
  id: string;
  professionalId: string;
  assignmentId: string;
  templateId: string;
  eventType: 'view' | 'customize' | 'copy_caption' | 'download_feed' | 'download_story' | 'mark_as_used' | 'request_alternative';
  format: string;
  createdAtMs: number;
}

export interface AdminAuditLog {
  id: string;
  actorUid: string;
  action: string;
  accountId: string;
  professionalId?: string | null;
  details: Record<string, unknown>;
  createdAt: number;
}

export interface SubscriptionHistoryEvent {
  id: string;
  actorUid: string;
  accountId: string;
  professionalId?: string | null;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string;
  createdAt: number;
}

export type AssistantMode = 'management' | 'conversion';

export type ProfessionalAssistantTone =
  | 'professional_warm'
  | 'direct_clinical'
  | 'empathetic_educational'
  | 'casual_friendly';

export interface ProfessionalAssistantSettings {
  accountId: string;
  professionalId: string;
  enabled: boolean;
  name: string;
  tone: ProfessionalAssistantTone;
  serviceContext: string;
  updatedAt?: number;
}

export type AssistantDefinitionId =
  | 'aury-patient-guide'
  | 'sofia-conversion'
  | 'sofia-management'
  | 'sofia-commercial';

export interface AssistantDefinition {
  id: AssistantDefinitionId;
  name: string;
  role: string;
  description: string;
  greeting: string;
  primaryColor: string;
  secondaryColor: string;
  systemPromptVersion: string;
}

export interface AssistantEntitlement {
  enabled: boolean;
  reason: 'available' | 'plan' | 'account' | 'disabled' | 'monthly_limit' | 'daily_limit' | 'trial_limit' | 'trial_expired';
  plan: PlanTier;
  trialActive: boolean;
  trialExpired: boolean;
  monthlyLimit: number;
  dailyLimit: number;
  trialLimit: number;
  usedThisMonth: number;
  usedToday: number;
  usedInTrial: number;
  remainingThisMonth: number;
  remainingToday: number;
  remainingInTrial: number;
  period: string;
}

export interface AssistantConversationSummary {
  id: string;
  mode: AssistantMode;
  assistantDefinitionId: AssistantDefinitionId;
  status: 'active' | 'closed';
  startedAt: number;
  lastInteractionAt: number;
  preview: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  sanitizedContent: string;
  createdAt: number;
  actionType?: string;
  feedback?: 'positive' | 'negative';
}

export interface AssistantActionProposal {
  id: string;
  actionType: 'update_lead_status';
  label: string;
  rationale: string;
  targetStatus: LeadStatus;
  status: 'proposed' | 'confirmed' | 'cancelled' | 'executed' | 'failed';
}

export interface AssistantWorkspace {
  entitlement: AssistantEntitlement;
  definitions: AssistantDefinition[];
  availableModes: AssistantMode[];
  conversations: AssistantConversationSummary[];
  messages: AssistantMessage[];
  activeConversationId?: string;
}

export interface AssistantResponse {
  headline: string;
  answer: string;
  actions: string[];
  suggestedMessage?: string;
  assistantName: string;
  mode: AssistantMode;
  leadId?: string;
  conversationId: string;
  messageId: string;
  promptVersion: string;
  knowledgeVersion: string;
  model: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  entitlement: AssistantEntitlement;
  proposedAction?: AssistantActionProposal;
  generatedAt: number;
}

export interface AssistantAdminSettings {
  accountId: string;
  enabled: boolean;
  enabledAssistants: Array<'sofia-conversion' | 'sofia-management'>;
  monthlyLimit: number;
  dailyLimit: number;
  trialLimit: number;
  inputTokenCostPerMillion: number;
  outputTokenCostPerMillion: number;
  customAssistant?: PublicPatientAssistant | null;
}

export interface AssistantAdminOverview {
  period: string;
  accountsUsed: number;
  interactions: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  actionsProposed: number;
  actionsConfirmed: number;
  positiveFeedback: number;
  negativeFeedback: number;
  blocked: number;
  errors: number;
}

export interface WorkspaceUser {
  uid: string;
  email: string;
  role: 'hq' | 'clinic' | 'professional';
  accountId?: string;
  professionalId?: string;
  status?: AccountStatus | 'trial_expired';
  slug?: string;
}
