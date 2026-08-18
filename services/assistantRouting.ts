import { LeadRecord, WorkspaceUser } from "../types";

export type AssistantShortcutId =
  | "priorities"
  | "agenda"
  | "post"
  | "attention"
  | "new_lead_message"
  | "funnel";

export interface AssistantShortcut {
  id: AssistantShortcutId;
  label: string;
  question: string;
}

export interface DeterministicAssistantReply {
  headline: string;
  answer: string;
  suggestedMessage?: string;
  leadId?: string;
  actionKeys?: string[];
  shortcut?: AssistantShortcutId;
}

export const ASSISTANT_SHORTCUTS: AssistantShortcut[] = [
  { id: "priorities", label: "Prioridades de hoje", question: "O que devo priorizar hoje?" },
  { id: "agenda", label: "Minha agenda", question: "Minha agenda" },
  { id: "post", label: "Post do dia", question: "Post do dia" },
  { id: "attention", label: "Leads que precisam de atenção", question: "Leads que precisam de atenção" },
  { id: "new_lead_message", label: "Mensagem para novos leads", question: "Mensagem para novos leads" },
  { id: "funnel", label: "Análise do funil", question: "Análise do funil" },
];

const STATUS_LABELS: Record<LeadRecord["status"], string> = {
  new: "NOVO",
  in_chat: "EM CONVERSA",
  scheduled: "AGENDADO",
  closed: "CONVERTIDO",
  lost: "NÃO CONVERTIDO",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ageHours(lead: LeadRecord, now: number): number {
  return Math.max(0, Math.round((now - lead.createdAt) / 3_600_000));
}

export function leadPriorityScore(lead: LeadRecord, now = Date.now()): number {
  if (lead.status === "closed") return 0;
  if (lead.status === "lost") return 0;
  const statusWeight = lead.status === "new" ? 18 : lead.status === "in_chat" ? 12 : 7;
  const requestWeight = lead.contactRequestedAtMs ? 38 : 0;
  const noContactWeight = lead.firstContactAt ? 0 : 24;
  const ageWeight = Math.min(16, Math.floor(ageHours(lead, now) / 12) * 2);
  return Math.min(99, statusWeight + requestWeight + noContactWeight + ageWeight);
}

function nextAction(lead: LeadRecord): string {
  if (lead.status === "new") return "fazer o primeiro contato";
  if (lead.status === "in_chat") return "realizar follow-up";
  if (lead.status === "scheduled") return "confirmar o agendamento";
  if (lead.status === "closed") return "acompanhar o relacionamento";
  return "revisar o motivo da perda";
}

function sortPriorityLeads(leads: LeadRecord[], now: number): LeadRecord[] {
  return [...leads]
    .filter((lead) => !["closed", "lost"].includes(lead.status))
    .sort((a, b) => leadPriorityScore(b, now) - leadPriorityScore(a, now) || a.createdAt - b.createdAt);
}

function displayName(lead: LeadRecord): string {
  return lead.lead.name.trim() || "Lead sem nome";
}

function prioritiesReply(leads: LeadRecord[], now: number): DeterministicAssistantReply {
  const priorityLeads = sortPriorityLeads(leads, now).slice(0, 5);
  if (priorityLeads.length === 0) {
    return {
      headline: "Prioridades de hoje",
      answer: "Não há leads abertos para priorizar agora. O funil está sem pendências imediatas.",
      actionKeys: ["open-dashboard", "open-leads"],
      shortcut: "priorities",
    };
  }
  const lines = priorityLeads.map((lead) => (
    `${displayName(lead)} — ${STATUS_LABELS[lead.status]} — score ${leadPriorityScore(lead, now)}.\nPróxima ação: ${nextAction(lead)}.`
  ));
  return {
    headline: "Prioridades de hoje",
    answer: `${lines.join("\n\n")}\n\nComece pelo primeiro lead: ele combina maior urgência operacional e maior tempo sem avanço.`,
    leadId: priorityLeads[0].id,
    actionKeys: ["open-lead", "open-leads"],
    shortcut: "priorities",
  };
}

function agendaReply(leads: LeadRecord[]): DeterministicAssistantReply {
  const scheduled = [...leads]
    .filter((lead) => lead.status === "scheduled" || Boolean(lead.scheduledAt))
    .sort((a, b) => Number(a.scheduledAt ?? 0) - Number(b.scheduledAt ?? 0));
  if (scheduled.length === 0) {
    return {
      headline: "Minha agenda",
      answer: "Não há agendamentos registrados no funil neste momento.",
      actionKeys: ["open-leads"],
      shortcut: "agenda",
    };
  }
  const lines = scheduled.slice(0, 6).map((lead) => {
    const date = lead.scheduledAt
      ? new Date(lead.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "horário não informado";
    return `${displayName(lead)} — ${date}`;
  });
  return {
    headline: "Minha agenda",
    answer: `${lines.join("\n")}\n\nConfirme os próximos horários antes do atendimento e mantenha o status atualizado.`,
    actionKeys: ["open-leads"],
    shortcut: "agenda",
  };
}

function attentionReply(leads: LeadRecord[], now: number): DeterministicAssistantReply {
  const attention = [...leads]
    .filter((lead) => !["closed", "lost"].includes(lead.status))
    .filter((lead) => Boolean(lead.contactRequestedAtMs) || !lead.firstContactAt || ageHours(lead, now) >= 24)
    .sort((a, b) => leadPriorityScore(b, now) - leadPriorityScore(a, now) || a.createdAt - b.createdAt);
  if (attention.length === 0) {
    return {
      headline: "Leads que precisam de atenção",
      answer: "Não encontrei leads parados ou com pedido de contato pendente. Continue acompanhando o funil diariamente.",
      actionKeys: ["open-dashboard"],
      shortcut: "attention",
    };
  }
  const lines = attention.slice(0, 6).map((lead) => {
    const reason = lead.contactRequestedAtMs
      ? "pediu contato"
      : !lead.firstContactAt
        ? "sem primeiro contato"
        : "sem avanço há mais de 24h";
    return `${displayName(lead)} — ${reason}. Próxima ação: ${nextAction(lead)}.`;
  });
  return {
    headline: "Leads que precisam de atenção",
    answer: lines.join("\n"),
    leadId: attention[0].id,
    actionKeys: ["open-lead", "open-leads"],
    shortcut: "attention",
  };
}

function newLeadMessageReply(leads: LeadRecord[], now: number): DeterministicAssistantReply {
  const lead = sortPriorityLeads(leads, now)[0];
  if (!lead) {
    return {
      headline: "Mensagem para novos leads",
      answer: "Não há novos leads aguardando uma primeira mensagem. Quando entrar um novo contato, a Sofia prepara o rascunho aqui.",
      actionKeys: ["open-leads"],
      shortcut: "new_lead_message",
    };
  }
  const suggestedMessage = "Olá [NOME]! Vi que você fez sua triagem de sorriso pela SorvySmile. Posso entender melhor o que você busca e explicar os próximos passos para uma avaliação?";
  return {
    headline: `Mensagem para ${displayName(lead)}`,
    answer: "Este é um rascunho para você revisar. A Sofia não envia mensagens automaticamente.",
    suggestedMessage,
    leadId: lead.id,
    actionKeys: ["copy-message", "open-lead"],
    shortcut: "new_lead_message",
  };
}

function funnelReply(leads: LeadRecord[], role: WorkspaceUser["role"]): DeterministicAssistantReply {
  const total = leads.length;
  const open = leads.filter((lead) => !["closed", "lost"].includes(lead.status)).length;
  const newLeads = leads.filter((lead) => lead.status === "new").length;
  const inChat = leads.filter((lead) => lead.status === "in_chat").length;
  const scheduled = leads.filter((lead) => lead.status === "scheduled").length;
  const closed = leads.filter((lead) => lead.status === "closed").length;
  const lost = leads.filter((lead) => lead.status === "lost").length;
  const terminal = closed + lost;
  const conversion = terminal ? Math.round((closed / terminal) * 100) : 0;
  const withoutContact = leads.filter((lead) => !lead.firstContactAt && !["closed", "lost"].includes(lead.status)).length;
  const scope = role === "clinic" ? "da clínica" : "do seu funil";
  return {
    headline: "Análise do funil",
    answer: `Visão ${scope}:\n\nLeads totais: ${total}\nEm aberto: ${open}\nNovos: ${newLeads}\nEm conversa: ${inChat}\nAgendados: ${scheduled}\nConvertidos: ${closed}\nSem conversão: ${lost}\nConversão entre encerrados: ${conversion}%\nSem primeiro contato: ${withoutContact}.\n\nPróximo foco: reduzir os leads sem primeiro contato antes de buscar novas oportunidades.`,
    actionKeys: ["open-leads", "open-dashboard"],
    shortcut: "funnel",
  };
}

function directLeadReply(question: string, leads: LeadRecord[], now: number): DeterministicAssistantReply | null {
  const normalizedQuestion = normalize(question);
  const lead = leads.find((candidate) => {
    const name = normalize(candidate.lead.name);
    if (name.length < 3) return false;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escapedName}\\b`).test(normalizedQuestion);
  });
  if (!lead) return null;
  return {
    headline: displayName(lead),
    answer: `Status atual: ${STATUS_LABELS[lead.status]}.\nPróxima ação: ${nextAction(lead)}.\nPrioridade operacional: ${leadPriorityScore(lead, now)}.`,
    leadId: lead.id,
    actionKeys: ["open-lead"],
  };
}

export function routeAssistantQuestion(input: {
  question: string;
  leads: LeadRecord[];
  role: WorkspaceUser["role"];
  now?: number;
}): DeterministicAssistantReply | null {
  const question = input.question.trim();
  if (!question) return null;
  const normalized = normalize(question);
  const now = input.now ?? Date.now();
  const direct = directLeadReply(question, input.leads, now);
  if (direct) return direct;
  if (/(prioriz|quem devo contatar|prioridade|o que devo fazer hoje|leads priorit)/.test(normalized)) {
    return prioritiesReply(input.leads, now);
  }
  if (/(minha agenda|agenda|agendament|consultas marcadas)/.test(normalized)) {
    return agendaReply(input.leads);
  }
  if (/(post do dia|post de hoje|conteudo do dia|publicar hoje)/.test(normalized)) {
    return {
      headline: "Post do dia",
      answer: "Seu Post do Dia está disponível no painel. Abra a área para revisar a arte, copiar a legenda e baixar o formato Feed ou Story.",
      actionKeys: ["open-post"],
      shortcut: "post",
    };
  }
  if (/(precisam de atencao|sem retorno|sem contato|aguardando contato|leads parados|backlog)/.test(normalized)) {
    return attentionReply(input.leads, now);
  }
  if (/(mensagem para novos|mensagem para lead|primeiro contato|rascunho|follow[- ]?up)/.test(normalized)) {
    return newLeadMessageReply(input.leads, now);
  }
  if (/(analise do funil|funil|conversao|gargalo|resumo|ultimos 30 dias|indicadores|metricas)/.test(normalized)) {
    return funnelReply(input.leads, input.role);
  }
  return null;
}
