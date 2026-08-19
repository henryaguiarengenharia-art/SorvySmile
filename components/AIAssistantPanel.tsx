import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import {
  AssistantMode,
  AssistantResponse,
  LeadRecord,
  ProfessionalAssistantSettings,
  WorkspaceUser,
} from "../types";
import {
  recordAssistantFeedback,
  resolveAssistantAction,
} from "../services/sorvyApi";
import {
  ASSISTANT_SHORTCUTS,
  AssistantShortcutId,
  routeAssistantQuestion,
} from "../services/assistantRouting";

interface AIAssistantPanelProps {
  leadRecords: LeadRecord[];
  accountId?: string;
  role?: WorkspaceUser["role"];
  onAsk: (input: {
    mode: AssistantMode;
    question: string;
    leadId?: string;
    conversationId?: string;
  }) => Promise<AssistantResponse>;
  onLeadActionApplied?: () => void;
  onViewLead?: (leadId: string) => void;
  onShortcut?: (shortcut: "dashboard" | "leads" | "post" | "assistant") => void;
  assistantSettings?: ProfessionalAssistantSettings;
}

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestedMessage?: string;
  leadId?: string;
  actionKeys?: string[];
  remote?: AssistantResponse;
  feedback?: "positive" | "negative";
}

const modeForRole = (role: WorkspaceUser["role"]): AssistantMode => (
  role === "clinic" ? "management" : "conversion"
);

const newId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const welcomeMessage = (role: WorkspaceUser["role"], assistantName: string): ChatEntry => ({
  id: "sofia-welcome",
  role: "assistant",
  text: role === "clinic"
    ? `Olá! Sou ${assistantName}, sua assistente virtual no SorvySmile.\n\nPosso ajudar você a priorizar a operação, acompanhar a agenda, organizar os leads, usar o Post do Dia e entender o funil.\n\nVocê também pode perguntar: Quem devo contatar hoje? ou pedir um Resumo dos últimos 30 dias.\n\nPor onde começamos?`
    : `Olá! Sou ${assistantName}, sua assistente virtual no SorvySmile.\n\nPosso ajudar você a priorizar seus leads, preparar o próximo contato, acompanhar a agenda, usar o Post do Dia e entender o funil.\n\nVocê também pode perguntar: Quem devo contatar hoje? ou pedir um Resumo dos últimos 30 dias.\n\nPor onde começamos?`,
  actionKeys: [],
});

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  leadRecords,
  role = "professional",
  onAsk,
  onLeadActionApplied,
  onViewLead,
  onShortcut,
  assistantSettings,
}) => {
  const assistantName = assistantSettings?.name.trim() || "Sofia";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([welcomeMessage(role, assistantName)]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    setMessages((current) => current.length === 1 && current[0]?.id === "sofia-welcome"
      ? [welcomeMessage(role, assistantName)]
      : current);
  }, [assistantName, role]);

  const copyText = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setError(null);
    } catch {
      setError("Não foi possível copiar neste navegador.");
    }
  };

  const addUserMessage = (text: string): void => {
    setMessages((current) => [...current, { id: newId("user"), role: "user", text }]);
  };

  const addDeterministicMessage = (reply: ReturnType<typeof routeAssistantQuestion>): void => {
    if (!reply) return;
    setMessages((current) => [...current, {
      id: newId("local"),
      role: "assistant",
      text: `${reply.headline}\n\n${reply.answer}`,
      suggestedMessage: reply.suggestedMessage,
      leadId: reply.leadId,
      actionKeys: reply.actionKeys,
    }]);
  };

  const submit = async (value = input): Promise<void> => {
    const question = value.trim();
    if (!question || busy) return;
    setInput("");
    setError(null);
    addUserMessage(question);

    const deterministic = routeAssistantQuestion({
      question,
      leads: leadRecords,
      role,
      assistantSettings,
    });
    if (deterministic) {
      addDeterministicMessage(deterministic);
      return;
    }

    setBusy(true);
    try {
      const response = await onAsk({
        mode: modeForRole(role),
        question,
        conversationId,
      });
      setConversationId(response.conversationId);
      setMessages((current) => [...current, {
        id: newId("remote"),
        role: "assistant",
        text: `${response.headline}\n\n${response.answer}`,
        suggestedMessage: response.suggestedMessage,
        leadId: response.leadId,
        actionKeys: response.leadId ? ["open-lead"] : [],
        remote: response,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `${assistantName} está indisponível.`);
    } finally {
      setBusy(false);
    }
  };

  const runShortcut = (shortcut: AssistantShortcutId): void => {
    const item = ASSISTANT_SHORTCUTS.find((candidate) => candidate.id === shortcut);
    if (item) void submit(item.question);
  };

  const runAction = async (entry: ChatEntry, actionKey: string): Promise<void> => {
    if (actionKey === "open-lead" && entry.leadId) {
      onViewLead?.(entry.leadId);
      return;
    }
    if (actionKey === "open-leads") {
      onShortcut?.("leads");
      return;
    }
    if (actionKey === "open-post") {
      onShortcut?.("post");
      return;
    }
    if (actionKey === "open-dashboard") {
      onShortcut?.("dashboard");
      return;
    }
    if (actionKey === "open-assistant") {
      onShortcut?.("assistant");
      return;
    }
    if (actionKey === "copy-message" && entry.suggestedMessage) {
      await copyText(entry.suggestedMessage);
    }
  };

  const decideAction = async (entry: ChatEntry, decision: "confirm" | "cancel"): Promise<void> => {
    if (!entry.remote?.proposedAction) return;
    setActionBusy(true);
    setError(null);
    try {
      await resolveAssistantAction(entry.remote.proposedAction.id, decision);
      const nextStatus = decision === "confirm" ? "executed" : "cancelled";
      setMessages((current) => current.map((item) => item.id === entry.id && item.remote
        ? { ...item, remote: { ...item.remote, proposedAction: { ...item.remote.proposedAction!, status: nextStatus } } }
        : item));
      if (decision === "confirm") onLeadActionApplied?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível concluir a ação.");
    } finally {
      setActionBusy(false);
    }
  };

  const sendFeedback = async (entry: ChatEntry, value: "positive" | "negative"): Promise<void> => {
    if (!entry.remote?.conversationId) return;
    try {
      await recordAssistantFeedback({
        conversationId: entry.remote.conversationId,
        messageId: entry.remote.messageId,
        feedback: value,
      });
      setMessages((current) => current.map((item) => item.id === entry.id ? { ...item, feedback: value } : item));
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : "Não foi possível registrar o feedback.");
    }
  };

  const openAssistant = (): void => {
    setOpen(true);
    setError(null);
  };

  if (assistantSettings?.enabled === false) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label={`Abrir ${assistantName}`}
          onClick={openAssistant}
          className="fixed bottom-5 right-5 z-[90] flex items-center gap-3 rounded-full bg-black px-4 py-3 text-left text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#18AFA5] text-white shadow-inner"><Sparkles className="h-5 w-5" /></span>
          <span><span className="block text-sm font-black">{assistantName}</span><span className="block text-[9px] font-black uppercase tracking-[.18em] text-slate-300">Assistente IA</span></span>
        </button>
      )}

      {open && (
        <section className="fixed inset-x-3 bottom-3 z-[90] flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl sm:left-auto sm:w-[min(430px,calc(100vw-1.5rem))]">
          <header className="flex items-center justify-between bg-black px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#151515] text-[#18AFA5] ring-1 ring-white/10"><Sparkles className="h-6 w-6" /></span>
              <div aria-label={`${assistantName} · Assistente virtual`}><p className="text-lg font-black leading-none">{assistantName}</p><p className="mt-1 text-xs font-medium text-slate-300">IA para apoiar sua rotina</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label={`Minimizar ${assistantName}`} onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white"><ChevronDown className="h-6 w-6" /></button>
              <button type="button" aria-label={`Fechar ${assistantName}`} onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-6 w-6" /></button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4">
            <div className="space-y-3">
              {messages.map((entry) => (
                <ChatBubble
                  key={entry.id}
                  entry={entry}
                  assistantName={assistantName}
                  busy={actionBusy}
                  onAction={(action) => void runAction(entry, action)}
                  onConfirm={(decision) => void decideAction(entry, decision)}
                  onFeedback={(value) => void sendFeedback(entry, value)}
                  onCopy={(value) => void copyText(value)}
                />
              ))}
              {busy && <div className="mr-8 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin text-[#18AFA5]" />Consultando {assistantName}...</div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Atalhos da sua rotina</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ASSISTANT_SHORTCUTS.map((shortcut) => (
                  <button key={shortcut.id} type="button" disabled={busy} onClick={() => runShortcut(shortcut.id)} className="min-h-12 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black leading-tight text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50">{shortcut.label}</button>
                ))}
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-100 bg-white p-3">
            {error && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
            <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-1 focus-within:border-[#18AFA5]">
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte sobre sua rotina ou seus leads..." className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" disabled={busy} />
              <button type="submit" disabled={busy || input.trim().length < 3} aria-label="Enviar pergunta" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-500 text-white transition hover:bg-slate-700 disabled:opacity-40"><Send className="h-5 w-5" /></button>
            </form>
            <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-widest text-slate-400">Respostas operacionais primeiro · IA avançada somente quando necessário</p>
          </footer>
        </section>
      )}
    </>
  );
};

const ChatBubble = ({
  entry,
  assistantName,
  busy,
  onAction,
  onConfirm,
  onFeedback,
  onCopy,
}: {
  entry: ChatEntry;
  assistantName: string;
  busy: boolean;
  onAction: (action: string) => void;
  onConfirm: (decision: "confirm" | "cancel") => void;
  onFeedback: (value: "positive" | "negative") => void;
  onCopy: (value: string) => void;
}) => {
  const isUser = entry.role === "user";
  return (
    <div className={isUser ? "ml-10" : "mr-5"}>
      <div className={`whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? "rounded-br-md bg-black text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm"}`}>
        {!isUser && <div className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#18AFA5]"><Bot className="h-3.5 w-3.5" /> {assistantName}</div>}
        {entry.text}
      </div>

      {!isUser && entry.suggestedMessage && (
        <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Rascunho para revisão humana</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-950">{entry.suggestedMessage}</p>
          <button type="button" onClick={() => onCopy(entry.suggestedMessage!)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><Copy className="h-3.5 w-3.5" />Copiar mensagem</button>
        </div>
      )}

      {!isUser && entry.actionKeys && entry.actionKeys.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.actionKeys.map((action) => (
            <button key={action} type="button" onClick={() => onAction(action)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100">
              {action === "open-lead" ? <Users className="h-3.5 w-3.5" /> : action === "copy-message" ? <Copy className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
              {action === "open-lead" ? "Abrir lead" : action === "open-leads" ? "Abrir leads prioritários" : action === "open-post" ? "Abrir Post do Dia" : action === "open-assistant" ? "Configurar assistente" : action === "open-dashboard" ? "Ver visão geral" : "Copiar mensagem"}
            </button>
          ))}
        </div>
      )}

      {!isUser && entry.remote?.proposedAction && (
        <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-700">Alteração sugerida · confirme antes de aplicar</p>
          <p className="mt-2 text-sm font-black text-blue-950">{entry.remote.proposedAction.label}</p>
          <p className="mt-1 text-xs text-blue-800">{entry.remote.proposedAction.rationale}</p>
          {entry.remote.proposedAction.status === "proposed" ? (
            <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => onConfirm("confirm")} className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"><Check className="h-3.5 w-3.5" />Aplicar alteração</button><button type="button" disabled={busy} onClick={() => onConfirm("cancel")} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700">Cancelar</button></div>
          ) : <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-700">{entry.remote.proposedAction.status === "executed" ? "Alteração aplicada" : "Sugestão cancelada"}</p>}
        </div>
      )}

      {!isUser && entry.remote && (
        <div className="mt-2 flex items-center gap-2"><span className="text-[9px] font-medium text-slate-400">Resposta de fallback IA</span><button type="button" aria-label="Resposta útil" onClick={() => onFeedback("positive")} className={`rounded-lg p-1 ${entry.feedback === "positive" ? "text-emerald-600" : "text-slate-300"}`}><ThumbsUp className="h-3.5 w-3.5" /></button><button type="button" aria-label="Resposta não útil" onClick={() => onFeedback("negative")} className={`rounded-lg p-1 ${entry.feedback === "negative" ? "text-rose-600" : "text-slate-300"}`}><ThumbsDown className="h-3.5 w-3.5" /></button></div>
      )}
    </div>
  );
};
