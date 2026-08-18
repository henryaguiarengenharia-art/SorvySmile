import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Copy,
  Eye,
  History,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  AssistantMode,
  AssistantResponse,
  AssistantWorkspace,
  LeadRecord,
  WorkspaceUser,
} from "../types";
import {
  getAssistantWorkspace,
  recordAssistantClientEvent,
  recordAssistantFeedback,
  resolveAssistantAction,
} from "../services/sorvyApi";

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
}

const MANAGEMENT_PROMPTS = [
  "Resumo dos últimos 30 dias",
  "Quais são os principais gargalos?",
  "Quantos leads ainda não receberam retorno?",
  "Quais são as três prioridades desta semana?",
];

const CONVERSION_PROMPTS = [
  "Quem devo contatar hoje?",
  "Criar uma mensagem de follow-up",
  "Mostrar leads sem retorno",
  "Explicar minha conversão",
];

const STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  in_chat: "Em conversa",
  scheduled: "Agendado",
  closed: "Convertido",
  lost: "Perdido",
};

const entitlementMessage = (workspace: AssistantWorkspace | null): string => {
  const reason = workspace?.entitlement.reason;
  if (reason === "plan") return "A Sofia está disponível nos planos Pro e Network.";
  if (reason === "monthly_limit") return "O limite mensal da Sofia foi utilizado.";
  if (reason === "daily_limit") return "O limite diário foi utilizado. Tente novamente amanhã.";
  if (reason === "trial_limit") return "As interações do período de demonstração foram utilizadas.";
  if (reason === "trial_expired") return "O período de demonstração terminou. Ative o Pro ou Network para continuar usando a Sofia.";
  if (reason === "disabled") return "A Sofia está temporariamente desativada para esta conta.";
  return "A conta precisa estar ativa para utilizar a Sofia.";
};

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  leadRecords,
  accountId,
  role = "professional",
  onAsk,
  onLeadActionApplied,
  onViewLead,
}) => {
  const [mode, setMode] = useState<AssistantMode>(role === "clinic" ? "management" : "conversion");
  const [leadId, setLeadId] = useState("");
  const [question, setQuestion] = useState(role === "clinic"
    ? MANAGEMENT_PROMPTS[0]
    : CONVERSION_PROMPTS[0]);
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [workspace, setWorkspace] = useState<AssistantWorkspace | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [feedback, setFeedback] = useState<"positive" | "negative" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectableLeads = useMemo(
    () => [...leadRecords]
      .filter((lead) => !["closed", "lost"].includes(lead.status))
      .sort((a, b) => b.createdAt - a.createdAt),
    [leadRecords],
  );

  const loadWorkspace = async (selectedConversationId?: string): Promise<void> => {
    const data = await getAssistantWorkspace({ accountId, conversationId: selectedConversationId });
    setWorkspace(data);
    if (selectedConversationId) setConversationId(selectedConversationId);
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingWorkspace(true);
    getAssistantWorkspace({ accountId })
      .then((data) => {
        if (!cancelled) {
          setWorkspace(data);
          if (!data.availableModes.includes(mode) && data.availableModes[0]) {
            setMode(data.availableModes[0]);
            setQuestion(data.availableModes[0] === "management" ? MANAGEMENT_PROMPTS[0] : CONVERSION_PROMPTS[0]);
          }
        }
      })
      .catch((workspaceError: Error) => {
        if (!cancelled) setError(workspaceError.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingWorkspace(false);
      });
    return () => { cancelled = true; };
  }, [accountId]);

  const selectMode = (nextMode: AssistantMode) => {
    setMode(nextMode);
    setResult(null);
    setConversationId(undefined);
    setFeedback(null);
    setNotice(null);
    setError(null);
    setLeadId("");
    setQuestion(nextMode === "management" ? MANAGEMENT_PROMPTS[0] : CONVERSION_PROMPTS[0]);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setFeedback(null);
    try {
      const response = await onAsk({
        mode,
        question,
        leadId: leadId || undefined,
        conversationId,
      });
      setResult(response);
      setConversationId(response.conversationId);
      setWorkspace((current) => current ? { ...current, entitlement: response.entitlement } : current);
      await loadWorkspace(response.conversationId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "A Sofia está indisponível.");
    } finally {
      setBusy(false);
    }
  };

  const decideAction = async (decision: "confirm" | "cancel") => {
    if (!result?.proposedAction) return;
    setActionBusy(true);
    setError(null);
    try {
      await resolveAssistantAction(result.proposedAction.id, decision);
      setResult({
        ...result,
        proposedAction: { ...result.proposedAction, status: decision === "confirm" ? "executed" : "cancelled" },
      });
      setNotice(decision === "confirm" ? "Alteração confirmada e aplicada." : "Sugestão cancelada. Nenhum dado foi alterado.");
      if (decision === "confirm") onLeadActionApplied?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível concluir a ação.");
    } finally {
      setActionBusy(false);
    }
  };

  const sendFeedback = async (value: "positive" | "negative") => {
    if (!result) return;
    try {
      await recordAssistantFeedback({
        conversationId: result.conversationId,
        messageId: result.messageId,
        feedback: value,
      });
      setFeedback(value);
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : "Não foi possível registrar o feedback.");
    }
  };

  const copySuggestion = async (): Promise<void> => {
    if (!result?.suggestedMessage) return;
    try {
      await navigator.clipboard.writeText(result.suggestedMessage);
      await recordAssistantClientEvent(result.conversationId, "suggestion_copied").catch(() => undefined);
      setNotice("Rascunho copiado para revisão.");
    } catch {
      setError("Não foi possível copiar o rascunho neste navegador.");
    }
  };

  if (loadingWorkspace) {
    return <div className="flex min-h-72 items-center justify-center rounded-[2rem] bg-white"><LoaderCircle className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (workspace && !workspace.entitlement.enabled && !["daily_limit", "monthly_limit", "trial_limit"].includes(workspace.entitlement.reason)) {
    return (
      <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
        <div className="bg-[#123B5D] p-8 text-white">
          <span className="inline-flex rounded-2xl bg-white/10 p-3"><Bot className="h-7 w-7" /></span>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Sofia · Assistente virtual</p>
          <h2 className="mt-2 text-3xl font-black">Decisões mais claras, próximos passos mais simples.</h2>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-blue-100">{entitlementMessage(workspace)}</p>
        </div>
        <div className="grid gap-4 p-7 sm:grid-cols-2">
          <Benefit icon={<MessageCircle className="h-5 w-5" />} title="Conversão" text="Priorize leads, prepare follow-ups e entenda o funil." />
          <Benefit icon={<BarChart3 className="h-5 w-5" />} title="Gestão" text="Transforme indicadores reais em até três prioridades." />
        </div>
      </section>
    );
  }

  const prompts = mode === "management" ? MANAGEMENT_PROMPTS : CONVERSION_PROMPTS;
  const entitlement = result?.entitlement ?? workspace?.entitlement;
  const isLimitBlocked = Boolean(entitlement && !entitlement.enabled);

  return (
    <section className="space-y-5">
      <header className="overflow-hidden rounded-[2rem] bg-[#123B5D] text-white shadow-xl">
        <div className="grid gap-6 p-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-[#18AFA5] p-3"><Bot className="h-6 w-6" /></span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">Sorvy Intelligence</p>
                <h2 className="text-2xl font-black">Sofia · Assistente virtual</h2>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-relaxed text-blue-100">
              Oi, eu sou a Sofia, assistente virtual da Sorvy. Posso ajudar você a entender seus leads, organizar os próximos passos e aproveitar melhor o SorvySmile.
            </p>
          </div>
          {entitlement && (
            <div className="min-w-56 rounded-2xl bg-white/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">Uso da conta</p>
              <p className="mt-2 text-2xl font-black">{entitlement.usedThisMonth} / {entitlement.monthlyLimit}</p>
              <p className="mt-1 text-xs font-bold text-blue-100">{entitlement.remainingToday} disponíveis hoje</p>
              {entitlement.trialActive && <p className="mt-1 text-xs font-bold text-cyan-300">{entitlement.remainingInTrial} restantes no trial</p>}
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <div className="space-y-5">
          <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <ModeButton active={mode === "conversion"} disabled={workspace ? !workspace.availableModes.includes("conversion") : false} onClick={() => selectMode("conversion")} icon={<MessageCircle className="h-5 w-5" />} label="Conversão" />
              <ModeButton active={mode === "management"} disabled={workspace ? !workspace.availableModes.includes("management") : false} onClick={() => selectMode("management")} icon={<BarChart3 className="h-5 w-5" />} label="Gestão" />
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-800">{mode === "conversion" ? "Organize seus próprios leads" : "Entenda sua operação autorizada"}</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{mode === "conversion" ? "A Sofia prepara prioridades e rascunhos. Nenhuma mensagem é enviada automaticamente." : "A Sofia diferencia dados reais de recomendações e apresenta no máximo três ações."}</p>
            </div>
            {mode === "conversion" && (
              <label className="mt-5 block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Lead específico · opcional</span>
                <select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="input">
                  <option value="">Analisar prioridades do funil</option>
                  {selectableLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.lead.name} · {STATUS_LABELS[lead.status] ?? lead.status}</option>)}
                </select>
              </label>
            )}
            <div className="mt-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Perguntas rápidas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {prompts.map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-black text-blue-700 hover:bg-blue-100">{prompt}</button>)}
              </div>
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">O que você quer entender?</span>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} className="input resize-none" />
            </label>
            <p className="mt-2 flex items-start gap-2 text-[10px] font-medium leading-relaxed text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Não inclua telefone, email, fotografia, diagnóstico ou conversa integral do paciente.</p>
            <button disabled={busy || isLimitBlocked || question.trim().length < 3} onClick={() => void submit()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F80ED] py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40">
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}Perguntar à Sofia
            </button>
            {isLimitBlocked && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{entitlementMessage(workspace)}</p>}
            {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
            {notice && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
          </article>

          {workspace && workspace.conversations.length > 0 && (
            <article className="rounded-[2rem] border border-slate-100 bg-white p-6">
              <div className="flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /><h3 className="font-black">Conversas recentes</h3></div>
              <div className="mt-4 space-y-2">
                {workspace.conversations.slice(0, 6).map((conversation) => (
                  <button key={conversation.id} onClick={() => { setMode(conversation.mode); setQuestion(conversation.mode === "management" ? MANAGEMENT_PROMPTS[0] : CONVERSION_PROMPTS[0]); setResult(null); void loadWorkspace(conversation.id); }} className={`w-full rounded-xl border p-3 text-left ${conversationId === conversation.id ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-slate-50"}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">{conversation.mode === "management" ? "Gestão" : "Conversão"}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-700">{conversation.preview || "Conversa com Sofia"}</p>
                  </button>
                ))}
              </div>
            </article>
          )}
        </div>

        <article className="min-h-[36rem] rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          {!result ? (
            <div className="flex min-h-[31rem] flex-col items-center justify-center text-center">
              <span className="rounded-[2rem] bg-[#DDF4F6] p-5 text-[#123B5D]"><Sparkles className="h-10 w-10" /></span>
              <h3 className="mt-5 text-2xl font-black">Clareza antes da ação</h3>
              <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500">Escolha um atalho ou faça uma pergunta. A Sofia usa apenas os dados autorizados do seu próprio escopo.</p>
              {workspace && workspace.messages.length > 0 && (
                <div className="mt-8 w-full max-w-xl space-y-3 text-left">
                  {workspace.messages.slice(-4).map((message) => (
                    <div key={message.id} className={`rounded-2xl p-4 text-sm font-medium whitespace-pre-line ${message.role === "user" ? "ml-10 bg-blue-50 text-blue-950" : "mr-10 bg-slate-50 text-slate-700"}`}>{message.sanitizedContent}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">Sofia · {result.mode === "management" ? "Gestão" : "Conversão"}</p><h3 className="mt-2 text-3xl font-black text-[#183247]">{result.headline}</h3></div>
                <span className="rounded-full bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase text-emerald-700">Dados autorizados</span>
              </div>
              <p className="mt-5 whitespace-pre-line text-sm font-medium leading-relaxed text-[#607487]">{result.answer}</p>
              <div className="mt-7 space-y-3">
                {result.actions.map((action, index) => <div key={`${action}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2F80ED] text-[10px] text-white">{index + 1}</span>{action}</div>)}
              </div>
              {result.mode === "conversion" && result.leadId && onViewLead && <button onClick={() => onViewLead(result.leadId!)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-black text-blue-700"><Eye className="h-4 w-4" />Ver lead</button>}
              {result.suggestedMessage && (
                <div className="mt-7 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Rascunho para revisão humana</p>
                  <p className="mt-3 whitespace-pre-line text-sm font-medium leading-relaxed text-emerald-950">{result.suggestedMessage}</p>
                  <button onClick={() => void copySuggestion()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white"><Copy className="h-4 w-4" />Copiar mensagem</button>
                </div>
              )}
              {result.proposedAction && (
                <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-700">Alteração sugerida · requer confirmação</p>
                  <p className="mt-2 text-sm font-black text-blue-950">{result.proposedAction.label}</p>
                  <p className="mt-1 text-xs font-medium text-blue-800">{result.proposedAction.rationale || "Revise antes de aplicar."}</p>
                  {result.proposedAction.status === "proposed" ? <div className="mt-4 flex flex-wrap gap-2"><button disabled={actionBusy} onClick={() => void decideAction("confirm")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white"><Check className="h-4 w-4" />Aplicar alteração</button><button disabled={actionBusy} onClick={() => void decideAction("cancel")} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-black text-blue-700"><X className="h-4 w-4" />Cancelar</button></div> : <p className="mt-4 text-xs font-black uppercase text-blue-700">{result.proposedAction.status === "executed" ? "Alteração aplicada" : "Sugestão cancelada"}</p>}
                </div>
              )}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="text-xs font-medium text-slate-400">Revise antes de usar. A Sofia não diagnostica nem executa ações sem confirmação.</p>
                <div className="flex gap-2"><button aria-label="Resposta útil" onClick={() => void sendFeedback("positive")} className={`rounded-xl border p-2 ${feedback === "positive" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"}`}><ThumbsUp className="h-4 w-4" /></button><button aria-label="Resposta não útil" onClick={() => void sendFeedback("negative")} className={`rounded-xl border p-2 ${feedback === "negative" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-400"}`}><ThumbsDown className="h-4 w-4" /></button></div>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
};

const ModeButton = ({ active, disabled, onClick, icon, label }: { active: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button disabled={disabled} onClick={onClick} className={`rounded-2xl border px-3 py-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-[#2F80ED] bg-blue-50 text-blue-700" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50"}`}>{icon}<span className="mt-2 block">{label}</span></button>
);

const Benefit = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <div className="rounded-2xl border border-slate-100 p-5"><span className="text-blue-600">{icon}</span><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm font-medium text-slate-500">{text}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-blue-600">Disponível no Pro e Network <ArrowRight className="h-4 w-4" /></span></div>
);
