import React, { useMemo, useState } from "react";
import { BarChart3, Bot, Copy, LoaderCircle, MessageCircle, Sparkles } from "lucide-react";
import { AssistantMode, AssistantResponse, LeadRecord } from "../types";

interface AIAssistantPanelProps {
  leadRecords: LeadRecord[];
  onAsk: (input: { mode: AssistantMode; question: string; leadId?: string }) => Promise<AssistantResponse>;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ leadRecords, onAsk }) => {
  const [mode, setMode] = useState<AssistantMode>("management");
  const [leadId, setLeadId] = useState("");
  const [question, setQuestion] = useState("Quais são as três prioridades comerciais da minha operação agora?");
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectableLeads = useMemo(
    () => [...leadRecords].filter((lead) => !["closed", "lost"].includes(lead.status)).sort((a, b) => b.createdAt - a.createdAt),
    [leadRecords],
  );

  const selectMode = (nextMode: AssistantMode) => {
    setMode(nextMode);
    setResult(null);
    setError(null);
    setQuestion(nextMode === "management"
      ? "Quais são as três prioridades comerciais da minha operação agora?"
      : "Qual deve ser a próxima ação para aumentar a chance de resposta deste lead?");
  };

  const submit = async () => {
    if (mode === "conversion" && !leadId) {
      setError("Selecione um lead para analisar a próxima ação.");
      return;
    }
    setBusy(true);
    setError(null);
    try { setResult(await onAsk({ mode, question, leadId: leadId || undefined })); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "A assistente está indisponível."); }
    finally { setBusy(false); }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <article className="rounded-[2rem] bg-slate-950 p-7 text-white">
        <div className="flex items-center gap-3"><span className="rounded-2xl bg-blue-600 p-3"><Bot className="h-6 w-6" /></span><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Sorvy Intelligence</p><h2 className="text-2xl font-black">Assistentes de IA</h2></div></div>
        <p className="mt-5 text-sm font-medium leading-relaxed text-slate-300">Apoio operacional baseado nos dados do seu funil. Não substitui avaliação clínica e não define tratamentos.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={() => selectMode("management")} className={`rounded-xl px-3 py-3 text-xs font-black ${mode === "management" ? "bg-white text-slate-950" : "bg-white/10 text-white"}`}><BarChart3 className="mx-auto mb-2 h-5 w-5" />Gestão</button>
          <button onClick={() => selectMode("conversion")} className={`rounded-xl px-3 py-3 text-xs font-black ${mode === "conversion" ? "bg-white text-slate-950" : "bg-white/10 text-white"}`}><MessageCircle className="mx-auto mb-2 h-5 w-5" />Conversão</button>
        </div>
        {mode === "conversion" && <label className="mt-5 block"><span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Lead</span><select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900"><option value="">Selecione</option>{selectableLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.lead.name} · {lead.status}</option>)}</select></label>}
        <label className="mt-5 block"><span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Pergunta</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} className="w-full resize-none rounded-xl bg-white p-4 text-sm font-bold text-slate-900 outline-none" /></label>
        <p className="mt-2 text-[10px] font-medium leading-relaxed text-slate-400">Não inclua nome, telefone, email ou outra informação que identifique o paciente.</p>
        <button disabled={busy || question.trim().length < 3} onClick={() => void submit()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}Analisar operação</button>
        {error && <p className="mt-4 rounded-xl bg-rose-500/15 p-3 text-xs font-bold text-rose-200">{error}</p>}
      </article>

      <article className="rounded-[2rem] border border-slate-100 bg-white p-7">
        {!result ? <div className="flex min-h-80 flex-col items-center justify-center text-center"><Sparkles className="h-10 w-10 text-blue-200" /><h3 className="mt-4 text-xl font-black">Pronta para analisar</h3><p className="mt-2 max-w-sm text-sm font-medium text-slate-500">Escolha a assistente e faça uma pergunta objetiva sobre sua operação.</p></div> : <div><p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Análise gerada por IA</p><h3 className="mt-2 text-2xl font-black">{result.headline}</h3><p className="mt-4 text-sm font-medium leading-relaxed text-slate-600">{result.answer}</p><div className="mt-6 space-y-3">{result.actions.map((action, index) => <div key={action} className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">{index + 1}</span>{action}</div>)}</div>{result.suggestedMessage && <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Mensagem sugerida</p><p className="mt-3 text-sm font-medium leading-relaxed text-emerald-950">{result.suggestedMessage}</p><button onClick={() => void navigator.clipboard.writeText(result.suggestedMessage ?? "")} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white"><Copy className="h-4 w-4" />Copiar mensagem</button></div>}<p className="mt-5 text-xs font-medium text-slate-400">Conteúdo gerado por IA. Revise antes de usar e preserve a autonomia do paciente.</p></div>}
      </article>
    </section>
  );
};
