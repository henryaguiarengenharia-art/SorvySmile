import React, { useEffect, useState } from "react";
import { Bot, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { AssistantAdminSettings, PlanTier } from "../types";
import {
  getAssistantAdminSettings,
  updateAssistantSettings,
  updateCustomAssistantProfile,
} from "../services/sorvyApi";
import { AssistantAssetKind, uploadApprovedAssistantAsset } from "../services/assistantAssets";

interface AssistantAdminCardProps {
  accountId: string;
  professionalId?: string;
  plan: PlanTier;
}

const DEFAULT_SETTINGS: Omit<AssistantAdminSettings, "accountId"> = {
  enabled: true,
  enabledAssistants: ["sofia-conversion", "sofia-management"],
  monthlyLimit: 100,
  dailyLimit: 20,
  trialLimit: 10,
  inputTokenCostPerMillion: 0,
  outputTokenCostPerMillion: 0,
  customAssistant: null,
};

export const AssistantAdminCard: React.FC<AssistantAdminCardProps> = ({ accountId, professionalId, plan }) => {
  const [settings, setSettings] = useState<AssistantAdminSettings>({ accountId, ...DEFAULT_SETTINGS });
  const [customEnabled, setCustomEnabled] = useState(false);
  const [name, setName] = useState("Aury");
  const [roleName, setRoleName] = useState("Guia virtual");
  const [description, setDescription] = useState("Orientações simples e seguras durante a jornada.");
  const [greeting, setGreeting] = useState("Oi! Posso explicar como esta experiência funciona e ajudar você a seguir com tranquilidade.");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fullImageUrl, setFullImageUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#18AFA5");
  const [secondaryColor, setSecondaryColor] = useState("#DDF4F6");
  const [tone, setTone] = useState("Humano, acolhedor, simples e sem pressão comercial.");
  const [vocabulary, setVocabulary] = useState("acolhedor, claro, sem jargão");
  const [institutionalContext, setInstitutionalContext] = useState("");
  const [knowledgeTags, setKnowledgeTags] = useState("journey, privacy, informative_triage, contact");
  const [ctaText, setCtaText] = useState("Falar com a clínica");
  const [ctaLink, setCtaLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<AssistantAssetKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAssistantAdminSettings(accountId, professionalId)
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        const custom = data.customAssistant as (typeof data.customAssistant & { status?: string; tone?: string; vocabulary?: string; institutionalContext?: string; approvedKnowledgeTags?: string[] }) | null | undefined;
        if (custom) {
          setCustomEnabled(plan !== "lite" && (custom.status === "active" || Boolean(custom.isCustom)));
          setName(custom.name || "Aury");
          setRoleName(custom.roleName || "Guia virtual");
          setDescription(custom.description || "Orientações simples e seguras durante a jornada.");
          setGreeting(custom.greeting || "Oi! Posso ajudar você durante esta experiência.");
          setAvatarUrl(custom.avatarUrl || "");
          setFullImageUrl(custom.fullImageUrl || "");
          setPrimaryColor(custom.primaryColor || "#18AFA5");
          setSecondaryColor(custom.secondaryColor || "#DDF4F6");
          setTone(custom.tone || "Humano, acolhedor, simples e sem pressão comercial.");
          setVocabulary(custom.vocabulary || "acolhedor, claro, sem jargão");
          setInstitutionalContext(custom.institutionalContext || "");
          setKnowledgeTags(custom.approvedKnowledgeTags?.join(", ") || "journey, privacy, informative_triage, contact");
          setCtaText(custom.ctaText || "Falar com a clínica");
          setCtaLink(custom.ctaLink || "");
        }
      })
      .catch((loadError: Error) => { if (!cancelled) setError(loadError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountId, professionalId, plan]);

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateAssistantSettings(settings);
      if (plan !== "lite") {
        await updateCustomAssistantProfile({
          accountId,
          professionalId,
          enabled: customEnabled,
          name,
          roleName,
          description,
          greeting,
          avatarUrl,
          fullImageUrl,
          primaryColor,
          secondaryColor,
          tone,
          vocabulary,
          institutionalContext,
          approvedKnowledgeTags: knowledgeTags.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20),
          ctaText,
          ctaLink,
        });
      }
      setNotice("Configuração das assistentes salva para esta conta.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const uploadAsset = async (kind: AssistantAssetKind, file?: File): Promise<void> => {
    if (!file) return;
    setUploadingAsset(kind);
    setError(null);
    try {
      const url = await uploadApprovedAssistantAsset({ file, accountId, professionalId, kind });
      if (kind === "avatar") setAvatarUrl(url);
      else setFullImageUrl(url);
      setNotice("Imagem aprovada enviada. Salve a configuração para publicá-la.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploadingAsset(null);
    }
  };

  if (loading) return <div className="mt-7 flex items-center gap-2 rounded-2xl border border-slate-100 p-5 text-sm font-bold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Carregando assistentes...</div>;

  return (
    <section className="mt-7 rounded-2xl border border-slate-100 p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-2 text-blue-600"><Bot className="h-5 w-5" /></span>
        <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Assistentes da conta</p><h3 className="mt-1 font-black">Sofia e identidade pública</h3></div>
      </div>
      {plan === "lite" && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">O plano Lite permanece sem acesso à Sofia. A configuração fica preservada para um futuro upgrade.</p>}
      <label className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-black"><span>Habilitar Sofia nesta conta</span><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /></label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {(["sofia-conversion", "sofia-management"] as const).map((assistantId) => {
          const checked = settings.enabledAssistants.includes(assistantId);
          return <label key={assistantId} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-xs font-black"><input type="checkbox" checked={checked} onChange={(event) => {
            const next = event.target.checked
              ? [...new Set([...settings.enabledAssistants, assistantId])]
              : settings.enabledAssistants.filter((item) => item !== assistantId);
            if (next.length > 0) setSettings({ ...settings, enabledAssistants: next });
          }} />{assistantId === "sofia-conversion" ? "Conversão" : "Gestão"}</label>;
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <NumberField label="Mensal" value={settings.monthlyLimit} onChange={(monthlyLimit) => setSettings({ ...settings, monthlyLimit })} />
        <NumberField label="Diário" value={settings.dailyLimit} onChange={(dailyLimit) => setSettings({ ...settings, dailyLimit })} />
        <NumberField label="Trial" value={settings.trialLimit} onChange={(trialLimit) => setSettings({ ...settings, trialLimit })} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <DecimalField label="USD / 1M tokens de entrada" value={settings.inputTokenCostPerMillion} onChange={(inputTokenCostPerMillion) => setSettings({ ...settings, inputTokenCostPerMillion })} />
        <DecimalField label="USD / 1M tokens de saída" value={settings.outputTokenCostPerMillion} onChange={(outputTokenCostPerMillion) => setSettings({ ...settings, outputTokenCostPerMillion })} />
      </div>
      <label className="mt-5 flex items-center justify-between rounded-xl bg-cyan-50 p-4 text-sm font-black text-cyan-900"><span>Identidade pública personalizada</span><input type="checkbox" disabled={plan === "lite"} checked={customEnabled} onChange={(event) => setCustomEnabled(event.target.checked)} /></label>
      {customEnabled && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" /><input className="input" value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Função" /></div>
          <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição" />
          <textarea className="input resize-none" rows={3} value={greeting} onChange={(event) => setGreeting(event.target.value)} placeholder="Saudação" />
          <input className="input" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="URL https do avatar aprovado" />
          <AssetUpload label="Enviar avatar PNG/WebP · mínimo 512 × 512" busy={uploadingAsset === "avatar"} onFile={(file) => void uploadAsset("avatar", file)} />
          <input className="input" value={fullImageUrl} onChange={(event) => setFullImageUrl(event.target.value)} placeholder="URL https da imagem completa aprovada" />
          <AssetUpload label="Enviar imagem completa PNG/WebP · mínimo 800 × 800" busy={uploadingAsset === "full"} onFile={(file) => void uploadAsset("full", file)} />
          {(avatarUrl || fullImageUrl) && <div className="flex min-h-24 items-end gap-4 rounded-xl bg-slate-50 p-4">{avatarUrl && <img src={avatarUrl} alt="Prévia do avatar" className="h-20 w-20 rounded-2xl object-contain" />}{fullImageUrl && <img src={fullImageUrl} alt="Prévia da imagem completa" className="h-28 max-w-32 object-contain" />}</div>}
          <div className="grid gap-3 sm:grid-cols-2"><label className="rounded-xl border border-slate-200 p-3 text-xs font-bold">Cor principal<input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="ml-3 align-middle" /></label><label className="rounded-xl border border-slate-200 p-3 text-xs font-bold">Cor secundária<input type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} className="ml-3 align-middle" /></label></div>
          <input className="input" value={tone} onChange={(event) => setTone(event.target.value)} placeholder="Tom de voz aprovado" />
          <input className="input" value={vocabulary} onChange={(event) => setVocabulary(event.target.value)} placeholder="Vocabulário aprovado" />
          <textarea className="input resize-none" rows={3} value={institutionalContext} onChange={(event) => setInstitutionalContext(event.target.value)} placeholder="Contexto institucional aprovado" />
          <input className="input" value={knowledgeTags} onChange={(event) => setKnowledgeTags(event.target.value)} placeholder="Tags de conhecimento, separadas por vírgula" />
          <div className="grid gap-3 sm:grid-cols-2"><input className="input" value={ctaText} onChange={(event) => setCtaText(event.target.value)} placeholder="CTA" /><input className="input" value={ctaLink} onChange={(event) => setCtaLink(event.target.value)} placeholder="Link https" /></div>
          <p className="flex items-start gap-2 text-[10px] font-medium text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />A personalização usa accountId/professionalId e não altera as regras globais de segurança.</p>
        </div>
      )}
      <button disabled={busy} onClick={() => void save()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar assistentes</button>
      {notice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
    </section>
  );
};

const NumberField = ({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) => <label><span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span><input type="number" min={1} value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} className="input" /></label>;

const DecimalField = ({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) => <label><span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span><input type="number" min={0} step="0.01" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="input" /></label>;

const AssetUpload = ({ label, busy, onFile }: { label: string; busy: boolean; onFile: (file?: File) => void }) => <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-cyan-200 bg-cyan-50 px-4 py-3 text-center text-[10px] font-black text-cyan-800"><input type="file" accept="image/png,image/webp" disabled={busy} onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" />{busy ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Enviando imagem...</span> : label}</label>;
