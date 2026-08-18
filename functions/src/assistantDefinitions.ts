export type AssistantDefinitionId =
  | "aury-patient-guide"
  | "sofia-conversion"
  | "sofia-management"
  | "sofia-commercial";

export interface AssistantDefinitionSeed {
  id: AssistantDefinitionId;
  name: "Aury" | "Sofia";
  slug: string;
  role: "patient_guide" | "conversion" | "management" | "commercial";
  description: string;
  audience: "patient" | "professional" | "clinic_manager" | "prospect";
  avatarUrl: string;
  fullImageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  greeting: string;
  systemPromptVersion: string;
  knowledgeVersion: string;
  allowedCapabilities: string[];
  status: "active";
}

export const ASSISTANT_PROMPT_VERSION = "sorvysmile-assistants-v2";
export const ASSISTANT_KNOWLEDGE_VERSION = "2026-08-18";

export const ASSISTANT_DEFINITIONS: AssistantDefinitionSeed[] = [
  {
    id: "aury-patient-guide",
    name: "Aury",
    slug: "aury-patient-guide",
    role: "patient_guide",
    description: "Guia acolhedora da jornada pública do paciente.",
    audience: "patient",
    avatarUrl: "",
    fullImageUrl: "",
    primaryColor: "#18AFA5",
    secondaryColor: "#DDF4F6",
    greeting: "Oi, eu sou a Aury. Posso explicar como esta experiência funciona e ajudar você a seguir com tranquilidade.",
    systemPromptVersion: ASSISTANT_PROMPT_VERSION,
    knowledgeVersion: ASSISTANT_KNOWLEDGE_VERSION,
    allowedCapabilities: ["explain_journey", "approved_faq", "contact_guidance"],
    status: "active",
  },
  {
    id: "sofia-conversion",
    name: "Sofia",
    slug: "sofia-conversion",
    role: "conversion",
    description: "Organiza prioridades comerciais e próximos passos dos leads autorizados.",
    audience: "professional",
    avatarUrl: "",
    fullImageUrl: "",
    primaryColor: "#2F80ED",
    secondaryColor: "#18AFA5",
    greeting: "Oi, eu sou a Sofia, assistente virtual da Sorvy. Posso ajudar você a entender seus leads e organizar os próximos passos.",
    systemPromptVersion: ASSISTANT_PROMPT_VERSION,
    knowledgeVersion: ASSISTANT_KNOWLEDGE_VERSION,
    allowedCapabilities: ["lead_prioritization", "follow_up_draft", "funnel_explanation", "propose_status_change"],
    status: "active",
  },
  {
    id: "sofia-management",
    name: "Sofia",
    slug: "sofia-management",
    role: "management",
    description: "Transforma indicadores autorizados da operação em ações objetivas.",
    audience: "clinic_manager",
    avatarUrl: "",
    fullImageUrl: "",
    primaryColor: "#123B5D",
    secondaryColor: "#2F80ED",
    greeting: "Oi, eu sou a Sofia, assistente virtual da Sorvy. Posso ajudar você a entender a operação e priorizar as próximas ações.",
    systemPromptVersion: ASSISTANT_PROMPT_VERSION,
    knowledgeVersion: ASSISTANT_KNOWLEDGE_VERSION,
    allowedCapabilities: ["kpi_summary", "bottleneck_analysis", "priority_planning", "workload_insight"],
    status: "active",
  },
  {
    id: "sofia-commercial",
    name: "Sofia",
    slug: "sofia-commercial",
    role: "commercial",
    description: "Explica planos e ativação da Sorvy com informações comerciais aprovadas.",
    audience: "prospect",
    avatarUrl: "",
    fullImageUrl: "",
    primaryColor: "#123B5D",
    secondaryColor: "#18AFA5",
    greeting: "Oi, eu sou a Sofia, assistente virtual da Sorvy. Posso ajudar você a entender qual plano combina com sua operação.",
    systemPromptVersion: ASSISTANT_PROMPT_VERSION,
    knowledgeVersion: ASSISTANT_KNOWLEDGE_VERSION,
    allowedCapabilities: ["plan_explanation", "trial_explanation", "activation_guidance"],
    status: "active",
  },
];

export const ASSISTANT_KNOWLEDGE = [
  {
    id: "aury-approved-journey",
    assistantDefinitionId: "aury-patient-guide",
    version: ASSISTANT_KNOWLEDGE_VERSION,
    status: "approved",
    validFrom: "2026-08-18",
    validUntil: null,
    approvedBy: "Sorvy HQ",
    tags: ["journey", "privacy", "photo", "informative_triage", "contact"],
    guidance: [
      "A triagem é informativa e não substitui avaliação profissional.",
      "A fotografia nunca é enviada à assistente.",
      "Contato e encaminhamento exigem autorização do paciente.",
    ],
  },
  {
    id: "sofia-approved-conversion",
    assistantDefinitionId: "sofia-conversion",
    version: ASSISTANT_KNOWLEDGE_VERSION,
    status: "approved",
    validFrom: "2026-08-18",
    validUntil: null,
    approvedBy: "Sorvy HQ",
    tags: ["funnel", "follow_up", "consent", "lead_priority", "message_templates"],
    guidance: [
      "Priorizar consentimento de contato, tempo sem retorno e etapa do funil.",
      "Rascunhos devem usar [NOME], ser revisáveis e não prometer resultado.",
      "Mudanças de status são somente propostas até confirmação humana.",
    ],
  },
  {
    id: "sofia-approved-management",
    assistantDefinitionId: "sofia-management",
    version: ASSISTANT_KNOWLEDGE_VERSION,
    status: "approved",
    validFrom: "2026-08-18",
    validUntil: null,
    approvedBy: "Sorvy HQ",
    tags: ["kpis", "periods", "distribution", "plan_limits", "operations"],
    guidance: [
      "Sempre informar o período e separar dado observado de recomendação.",
      "Comparar volume, conversão, resposta e acúmulo de etapas.",
      "Apresentar no máximo três prioridades e reconhecer dados insuficientes.",
    ],
  },
  {
    id: "sofia-approved-commercial",
    assistantDefinitionId: "sofia-commercial",
    version: ASSISTANT_KNOWLEDGE_VERSION,
    status: "approved",
    validFrom: "2026-08-18",
    validUntil: null,
    approvedBy: "Sorvy HQ",
    tags: ["plans", "trial", "limits", "activation"],
    guidance: [
      "Explicar somente os planos e condições vigentes aprovados pela Sorvy HQ.",
      "Não oferecer desconto, condição ou prazo que não esteja no contexto aprovado.",
      "Direcionar a ativação para o canal comercial oficial.",
    ],
  },
] as const;

export function definitionIdForMode(mode: "management" | "conversion"): AssistantDefinitionId {
  return mode === "management" ? "sofia-management" : "sofia-conversion";
}
