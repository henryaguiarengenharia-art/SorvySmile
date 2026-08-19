import React, { useEffect, useState } from "react";
import { LoaderCircle, Save, ShieldCheck, Sparkles } from "lucide-react";
import { ProfessionalAssistantSettings } from "../types";
import { updateProfessionalAssistantSettings } from "../services/sorvyApi";
import { PROFESSIONAL_ASSISTANT_TONES } from "../services/professionalAssistantProfile";

interface ProfessionalAssistantSettingsCardProps {
  settings: ProfessionalAssistantSettings;
  loading?: boolean;
  loadError?: string | null;
  readOnly?: boolean;
  onSaved: (settings: ProfessionalAssistantSettings) => void;
}

export const ProfessionalAssistantSettingsCard: React.FC<ProfessionalAssistantSettingsCardProps> = ({
  settings,
  loading = false,
  loadError,
  readOnly = false,
  onSaved,
}) => {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(settings), [settings]);

  const save = async (): Promise<void> => {
    if (readOnly || loading) return;
    if (draft.name.trim().length < 2) {
      setError("Informe um nome com pelo menos dois caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await updateProfessionalAssistantSettings({
        ...draft,
        name: draft.name.trim(),
        serviceContext: draft.serviceContext.trim(),
      });
      setDraft(saved);
      onSaved(saved);
      setNotice("Configurações da assistente atualizadas com sucesso.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a assistente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
      <header className="flex flex-col gap-5 border-b border-slate-100 p-7 sm:flex-row sm:items-center sm:justify-between md:p-9">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><Sparkles className="h-6 w-6" /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Propriedade e identidade</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Configurações da Assistente IA</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">Personalize a assistente que apoia sua rotina dentro do SorvySmile.</p>
          </div>
        </div>
        <label className="inline-flex items-center gap-3 text-sm font-black text-slate-700">
          <button
            type="button"
            role="switch"
            aria-checked={draft.enabled}
            disabled={readOnly || loading}
            onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
            className={`relative h-7 w-12 rounded-full transition ${draft.enabled ? "bg-emerald-500" : "bg-slate-300"} disabled:opacity-50`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${draft.enabled ? "left-6" : "left-1"}`} />
          </button>
          {draft.enabled ? "Ativa" : "Inativa"}
        </label>
      </header>

      <div className="space-y-6 p-7 md:p-9">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-bold text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-emerald-500" />Carregando configurações...</div>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">Nome da assistente</span>
                <input disabled={readOnly} maxLength={40} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="input" placeholder="Ex.: Sofia" />
              </label>
              <label>
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">Personalidade / tom de voz</span>
                <select disabled={readOnly} value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value as ProfessionalAssistantSettings["tone"] })} className="input">
                  {PROFESSIONAL_ASSISTANT_TONES.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}
                </select>
              </label>
            </div>

            <label>
              <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">Informações de atendimento para a IA</span>
              <textarea
                disabled={readOnly}
                maxLength={2000}
                rows={9}
                value={draft.serviceContext}
                onChange={(event) => setDraft({ ...draft, serviceContext: event.target.value })}
                className="input resize-y leading-relaxed"
                placeholder="Inclua informações reais sobre sua rotina: especialidades, serviços, horários, convênios, valores de referência, público atendido e regras de contato."
              />
              <div className="mt-2 flex items-start justify-between gap-4">
                <p className="max-w-2xl text-[10px] font-medium leading-relaxed text-slate-500">Quando uma informação não estiver cadastrada, a assistente informará que ela precisa ser confirmada. Não inclua dados pessoais de pacientes.</p>
                <span className="shrink-0 text-[10px] font-bold text-slate-400">{draft.serviceContext.length}/2000</span>
              </div>
            </label>

            <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-xs font-medium leading-relaxed text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />A assistente usa primeiro os atalhos e dados do seu funil. A IA avançada só é acionada quando a resposta local não atende à pergunta.</p>

            {!readOnly && <button disabled={saving || Boolean(loadError)} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-slate-900 disabled:opacity-40">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar configurações da IA</button>}
          </>
        )}
        {(loadError || error) && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error ?? loadError}</p>}
        {notice && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
      </div>
    </section>
  );
};
