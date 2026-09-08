import React, { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ExternalLink,
  Eye,
  ImageOff,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smile,
  Sparkles,
  User,
} from "lucide-react";
import {
  PhotoValidation,
  PublicProfessionalProfile,
  SmileScores,
} from "../types";
import {
  analyzePhoto,
  CONSENT_VERSION,
  recordPatientConversionAction,
  saveLead,
  startTriage,
  validatePhoto,
} from "../services/sorvyApi";
import { preparePhotoFile } from "../services/photoFile";
import {
  smileV6Areas,
  smileV6GapFromOverall,
  smileV6HighestArea,
  smileV6OverallIndex,
  smileV6PrimaryArea,
  SmileV6Area,
  SmileV6AreaId,
} from "../services/smileV6Presentation";

const GuidedCamera = React.lazy(() =>
  import("./GuidedCamera").then((module) => ({ default: module.GuidedCamera })),
);

type Stage =
  | "capture"
  | "camera"
  | "validation"
  | "analyzing"
  | "signal"
  | "contact"
  | "result";

interface ImagePayload {
  dataUrl: string;
  base64: string;
  mimeType: "image/jpeg";
}

const formatWhatsApp = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const JOURNEY = ["Sorriso", "Primeiro sinal", "Resultado completo", "Ação"];

const JourneyProgress = ({ current }: { current: number }) => (
  <div className="mb-8 grid grid-cols-4 gap-2" aria-label="Progresso da experiência">
    {JOURNEY.map((label, index) => (
      <div key={label} className="text-center">
        <div className={`h-1.5 rounded-full ${index <= current ? "bg-blue-600" : "bg-slate-200"}`} />
        <p className={`mt-2 text-[9px] font-black uppercase tracking-wider ${index <= current ? "text-blue-600" : "text-slate-300"}`}>
          {label}
        </p>
      </div>
    ))}
  </div>
);

export const PatientJourney = ({
  profile,
  onExit,
}: {
  profile: PublicProfessionalProfile;
  onExit: () => void;
}) => {
  const [stage, setStage] = useState<Stage>("capture");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [validation, setValidation] = useState<PhotoValidation | null>(null);
  const [scores, setScores] = useState<SmileScores | null>(null);
  const [busy, setBusy] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageConsent, setImageConsent] = useState(false);
  const [lead, setLead] = useState({ name: "", whatsapp: "" });
  const [contactConsent, setContactConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const prepareSelectedPhoto = useCallback(async (file: File) => {
    if (!file) return;
    setReadingPhoto(true);
    setError(null);
    try {
      const payload = await preparePhotoFile(file);
      setImage(payload);
      setValidation(null);
      setStage("validation");
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Não foi possível preparar a foto.");
    } finally {
      setReadingPhoto(false);
    }
  }, []);

  const selectPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file) await prepareSelectedPhoto(file);
    input.value = "";
  };

  const usePhoto = async () => {
    if (!image) return;
    if (!imageConsent) {
      setError("Confirme a autorização para analisar seu sorriso.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const activeSessionId = sessionId ?? await startTriage(profile.slug, {
        photoConsent: true,
        adultAndOwnershipConfirmed: true,
      });
      setSessionId(activeSessionId);
      const photoValidation = await validatePhoto(activeSessionId, image.base64, image.mimeType);
      setValidation(photoValidation);
      if (!photoValidation.isAdequate) return;
      setStage("analyzing");
      const result = await analyzePhoto(activeSessionId, image.base64, image.mimeType);
      setScores(result);
      setImage(null);
      setValidation(null);
      setStage("signal");
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : "Não foi possível processar a foto.");
      setStage("validation");
    } finally {
      setBusy(false);
    }
  };

  const submitLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionId || !scores) return;
    const digits = lead.whatsapp.replace(/\D/g, "");
    if (lead.name.trim().length < 2 || digits.length < 10) {
      setError("Informe seu nome e um WhatsApp válido com DDD.");
      return;
    }
    if (!contactConsent || !privacyConsent) {
      setError("Confirme a autorização para liberar e compartilhar o resultado.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveLead({
        sessionId,
        name: lead.name.trim(),
        whatsapp: digits,
        contactConsent: true,
        privacyConsent: true,
      });
      setStage("result");
    } catch (leadError) {
      setError(leadError instanceof Error ? leadError.message : "Não foi possível salvar seu contato.");
    } finally {
      setBusy(false);
    }
  };

  const contactProfessional = () => {
    const number = profile.whatsapp.replace(/\D/g, "");
    if (!number || !scores || !sessionId) return;
    void recordPatientConversionAction(sessionId, "whatsapp_opened").catch(() => undefined);
    const fullReport = profile.plan !== "lite";
    const overall = smileV6OverallIndex(scores, fullReport);
    const primary = smileV6PrimaryArea(scores, fullReport);
    const message = [
      `Olá! Concluí minha triagem visual na Sorvy Smile pelo link de ${profile.name}.`,
      `Meu nome é ${lead.name}.`,
      `Índice visual geral: ${overall}/100.`,
      `Principal contraste: ${primary.label} (${primary.score}/100).`,
      "Gostaria de agendar uma avaliação para entender o que realmente faz sentido no meu caso.",
    ].join("\n");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const requestProfessionalContact = async () => {
    if (!sessionId) throw new Error("Esta triagem não está mais disponível.");
    await recordPatientConversionAction(sessionId, "contact_requested");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff_0%,#f8fafc_42%,#ffffff_82%)] text-slate-950">
      <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur-xl">
        <button onClick={onExit} className="flex items-center gap-2 text-sm font-black">
          <span className="rounded-xl bg-blue-600 p-2 text-white"><Smile className="h-5 w-5" /></span>
          Sorvy Smile
        </button>
        <p className="max-w-[45%] truncate text-right text-xs font-bold text-slate-400">{profile.name}</p>
      </header>

      {error && (
        <div className="mx-auto mt-5 max-w-xl px-5">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
        </div>
      )}

      {stage === "capture" && (
        <CaptureStep profile={profile} onPhoto={selectPhoto} onBack={onExit} onOpenCamera={() => setStage("camera")} readingPhoto={readingPhoto} />
      )}
      {stage === "camera" && (
        <React.Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><LoaderCircle className="h-10 w-10 animate-spin text-blue-600" /></div>}>
          <GuidedCamera onCapture={prepareSelectedPhoto} onCancel={() => setStage("capture")} onChoosePhoto={selectPhoto} />
        </React.Suspense>
      )}
      {stage === "validation" && image && (
        <ValidationStep image={image.dataUrl} validation={validation} busy={busy} onPhoto={selectPhoto} imageConsent={imageConsent} onImageConsent={setImageConsent} onUsePhoto={usePhoto} />
      )}
      {stage === "analyzing" && <AnalyzingStep />}
      {stage === "signal" && scores && (
        <FirstSignalStep scores={scores} fullReport={profile.plan !== "lite"} onContinue={() => setStage("contact")} />
      )}
      {stage === "contact" && scores && (
        <ContactStep
          scores={scores}
          fullReport={profile.plan !== "lite"}
          lead={lead}
          setLead={setLead}
          contactConsent={contactConsent}
          setContactConsent={setContactConsent}
          privacyConsent={privacyConsent}
          setPrivacyConsent={setPrivacyConsent}
          busy={busy}
          profile={profile}
          onSubmit={submitLead}
          onBack={() => setStage("signal")}
        />
      )}
      {stage === "result" && scores && (
        <ResultStep
          scores={scores}
          fullReport={profile.plan !== "lite"}
          leadName={lead.name}
          profile={profile}
          onContact={contactProfessional}
          onRequestContact={requestProfessionalContact}
          onExit={onExit}
        />
      )}
    </div>
  );
};

const CaptureStep = ({
  profile,
  onPhoto,
  onBack,
  onOpenCamera,
  readingPhoto,
}: {
  profile: PublicProfessionalProfile;
  onPhoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onOpenCamera: () => void;
  readingPhoto: boolean;
}) => (
  <main className="mx-auto max-w-xl px-6 py-9">
    <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-black text-slate-500"><ChevronLeft className="h-4 w-4" /> Voltar</button>
    <JourneyProgress current={0} />
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Sua experiência começa aqui</p>
      <h1 className="mt-2 text-4xl font-black">Vamos enquadrar seu sorriso</h1>
      <p className="mt-3 font-medium text-slate-500">O guia acompanha o enquadramento e avisa quando estiver tudo pronto.</p>
    </div>
    <section className="mt-7 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="rounded-2xl bg-blue-50 p-3 text-blue-600"><Smile className="h-6 w-6" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-blue-600">Experiência oferecida por</p>
          <p className="mt-1 text-lg font-black text-slate-900">{profile.name}</p>
          {(profile.specialty || profile.city) && <p className="mt-1 text-xs font-medium text-slate-500">{[profile.specialty, profile.city, profile.state].filter(Boolean).join(" · ")}</p>}
          {profile.bio && <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{profile.bio}</p>}
        </div>
      </div>
    </section>
    <button onClick={onOpenCamera} disabled={readingPhoto} className="mt-6 flex w-full items-center justify-center gap-3 rounded-3xl bg-slate-950 px-6 py-6 text-sm font-black text-white shadow-xl transition hover:bg-blue-700 disabled:opacity-50">
      <Camera className="h-6 w-6 text-blue-300" /> Usar câmera guiada <ArrowRight className="h-5 w-5" />
    </button>
    <label className="relative mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-slate-600">
      {readingPhoto ? <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /> : <ImagePlus className="h-5 w-5 text-blue-600" />}
      {readingPhoto ? "Preparando sorriso" : "Escolher uma imagem"}
      <input type="file" accept="image/*" capture="user" onChange={onPhoto} disabled={readingPhoto} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
    <div className="mt-6 grid grid-cols-3 gap-3">
      {[["☀️", "Boa luz"], ["😁", "Sorriso aberto"], ["📱", "Câmera reta"]].map(([icon, label]) => (
        <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center"><p className="text-2xl">{icon}</p><p className="mt-2 text-[10px] font-black uppercase tracking-wider">{label}</p></div>
      ))}
    </div>
  </main>
);

const ValidationStep = ({
  image,
  validation,
  busy,
  onPhoto,
  imageConsent,
  onImageConsent,
  onUsePhoto,
}: {
  image: string;
  validation: PhotoValidation | null;
  busy: boolean;
  onPhoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
  imageConsent: boolean;
  onImageConsent: (value: boolean) => void;
  onUsePhoto: () => void;
}) => (
  <main className="mx-auto max-w-xl px-6 py-9">
    <JourneyProgress current={0} />
    <div className="mb-6 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Você está no controle</p>
      <h1 className="mt-2 text-3xl font-black">Este é o sorriso que vamos analisar?</h1>
      <p className="mt-2 text-sm font-medium text-slate-500">Confirme a imagem e autorize somente o processamento necessário para sua leitura.</p>
    </div>
    <div className="relative overflow-hidden rounded-[3rem] border-8 border-white bg-slate-900 shadow-2xl">
      <img src={image} alt="Prévia do sorriso selecionado" className="aspect-[3/2] w-full object-cover" />
      {busy && <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 text-white"><LoaderCircle className="h-12 w-12 animate-spin text-blue-400" /><p className="mt-4 text-xs font-black uppercase tracking-widest">Verificando qualidade</p></div>}
    </div>
    {validation && !busy && (
      <div className={`mt-5 rounded-2xl border p-5 ${validation.isAdequate ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
        <div className="flex items-start gap-3">{validation.isAdequate ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <ImageOff className="h-6 w-6 shrink-0" />}<div><p className="font-black">{validation.isAdequate ? "Sorriso pronto" : "Precisamos de outro enquadramento"}</p><p className="mt-1 text-sm font-medium">{validation.feedback}</p></div></div>
      </div>
    )}
    <section className="mt-6 space-y-3 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><div><p className="text-sm font-black text-slate-900">Triagem informativa e consentida</p><p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">Esta é uma leitura visual aproximada para ajudar na conversa com o dentista. Não é diagnóstico e não substitui consulta.</p></div></div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <input type="checkbox" checked={imageConsent} onChange={(event) => onImageConsent(event.target.checked)} className="mt-0.5 h-5 w-5" />
        <span className="text-xs font-bold leading-relaxed text-slate-600">Confirmo que tenho 18 anos ou mais, que esta imagem é minha e autorizo seu processamento temporário para gerar a leitura do sorriso. Li a <a href="/privacidade" target="_blank" rel="noreferrer" className="text-blue-600 underline">Política de Privacidade</a>.</span>
      </label>
      <p className="text-center text-[10px] font-bold text-slate-400">Consentimento {CONSENT_VERSION} · a imagem não ficará no painel.</p>
    </section>
    <div className="mt-6 grid grid-cols-2 gap-4">
      <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-5 text-xs font-black uppercase tracking-widest"><RefreshCw className="h-4 w-4" /> Repetir<input type="file" accept="image/*" capture="user" onChange={onPhoto} className="absolute inset-0 h-full w-full opacity-0" /></label>
      <button disabled={busy || !imageConsent} onClick={onUsePhoto} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 py-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-30">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Analisar meu sorriso</button>
    </div>
  </main>
);

const AnalyzingStep = () => (
  <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
    <div className="relative flex h-28 w-28 items-center justify-center"><div className="absolute inset-0 animate-spin rounded-full border-8 border-blue-50 border-t-blue-600" /><Sparkles className="h-9 w-9 text-blue-600" /></div>
    <h1 className="mt-8 text-4xl font-black">Preparando sua leitura</h1>
    <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-slate-500">Estamos comparando os sinais visuais do seu sorriso para mostrar primeiro o que mais se destaca.</p>
  </main>
);

const FirstSignalStep = ({ scores, fullReport, onContinue }: { scores: SmileScores; fullReport: boolean; onContinue: () => void }) => {
  const primary = smileV6PrimaryArea(scores, fullReport);
  const hiddenCount = Math.max(0, smileV6Areas(scores, fullReport).length - 1);
  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-6">
      <JourneyProgress current={1} />
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-violet-700"><CheckCircle2 className="h-4 w-4" /> primeiro sinal encontrado</div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Primeiro sinal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{primary.label} foi o ponto que mais chamou atenção.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">Entre os sinais visuais analisados, este foi o contraste mais evidente. <span className="font-black text-slate-800">E ele não apareceu sozinho.</span></p>
      </div>

      <section className="mx-auto mt-10 grid max-w-4xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[2.75rem] bg-slate-950 p-7 text-white shadow-2xl sm:p-9">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-300">Sinal principal</p>
          <p className="mt-6 text-5xl font-black">{primary.score}<span className="text-xl text-white/30">/100</span></p>
          <p className="mt-2 text-xs font-black uppercase tracking-wider text-white/45">índice visual</p>
          <div className="mt-7 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400" style={{ width: `${primary.score}%` }} /></div>
          <h2 className="mt-7 text-3xl font-black leading-tight">Há algo para entender melhor antes de concluir que está tudo bem.</h2>
          <p className="mt-4 text-sm font-medium leading-relaxed text-white/60">{primary.summary}</p>
        </article>

        <article className="rounded-[2.75rem] border border-amber-200 bg-white p-7 shadow-xl sm:p-9">
          <ShieldCheck className="h-8 w-8 text-amber-700" />
          <p className="mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Um fato que muita gente ignora</p>
          <h2 className="mt-2 text-2xl font-black">Você não precisa estar com dor para existir algo que merece avaliação.</h2>
          <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500">Na saúde bucal, alterações podem começar sem dor ou sinais óbvios. Ausência de sintomas não significa que tudo possa ser confirmado apenas pela aparência.</p>
          <p className="mt-4 text-[9px] font-black uppercase tracking-wider text-slate-300">Informação educacional · não significa que uma doença foi identificada na foto</p>
        </article>
      </section>

      <section className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-[2.75rem] bg-slate-950 p-6 text-white sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-blue-200">1 de {hiddenCount + 1} sinais liberado</div>
            <h2 className="mt-5 text-3xl font-black">Você viu o primeiro. {hiddenCount > 0 ? `Ainda faltam ${hiddenCount}.` : "Agora falta entender o conjunto."}</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-white/55">A leitura completa compara os sinais entre si, mostra onde existe mais contraste e ajuda a entender o que merece prioridade.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].slice(0, Math.max(1, hiddenCount)).map((index) => (
              <div key={index} className="relative min-h-36 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4">
                <div className="select-none blur-[3px]"><div className="h-11 w-11 rounded-2xl bg-white/10" /><div className="mt-5 h-2 w-12 rounded-full bg-white/25" /><div className="mt-3 h-5 w-16 rounded-lg bg-white/15" /><div className="mt-3 h-2 rounded-full bg-white/10" /></div>
                <p className="absolute bottom-4 left-4 text-[8px] font-black uppercase tracking-wider text-white/25">sinal {index + 2}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-4xl rounded-[2.5rem] border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-white p-6 sm:p-8">
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">A leitura ainda não acabou</p><h2 className="mt-2 text-2xl font-black">Agora falta entender como este sinal se compara aos demais — e o que merece prioridade.</h2></div>
          <button type="button" onClick={onContinue} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-xl">Ver meu resultado completo <ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>
    </main>
  );
};

const ContactStep = ({
  scores,
  fullReport,
  lead,
  setLead,
  contactConsent,
  setContactConsent,
  privacyConsent,
  setPrivacyConsent,
  busy,
  profile,
  onSubmit,
  onBack,
}: {
  scores: SmileScores;
  fullReport: boolean;
  lead: { name: string; whatsapp: string };
  setLead: (lead: { name: string; whatsapp: string }) => void;
  contactConsent: boolean;
  setContactConsent: (value: boolean) => void;
  privacyConsent: boolean;
  setPrivacyConsent: (value: boolean) => void;
  busy: boolean;
  profile: PublicProfessionalProfile;
  onSubmit: (event: React.FormEvent) => void;
  onBack: () => void;
}) => {
  const primary = smileV6PrimaryArea(scores, fullReport);
  const consentChecked = contactConsent && privacyConsent;
  const setCombinedConsent = (value: boolean) => {
    setContactConsent(value);
    setPrivacyConsent(value);
  };
  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-6">
      <JourneyProgress current={1} />
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-black text-slate-500"><ChevronLeft className="h-4 w-4" /> Voltar ao primeiro sinal</button>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2.5rem] bg-slate-950 p-7 text-white sm:p-8">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">O que você libera</p>
          <h1 className="mt-2 text-3xl font-black">Seu resultado completo + horizonte de mudança.</h1>
          <div className="mt-6 space-y-3">{["Índice Visual Geral", `${smileV6Areas(scores, fullReport).length} sinais comparados`, `Prioridade atual: ${primary.label}`, "Tempo relacionado a cada sinal", `Contexto compartilhado com ${profile.name}`].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><Check className="h-4 w-4 text-emerald-300" /><p className="text-xs font-bold text-white/75">{item}</p></div>)}</div>
        </section>
        <form onSubmit={onSubmit} className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-xl sm:p-8">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><User className="h-6 w-6" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Troca transparente</p><h2 className="mt-1 text-2xl font-black">Seu resultado completo está pronto.</h2></div></div>
          <input required autoComplete="name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Seu nome" className="mt-7 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500" />
          <input required autoComplete="tel" inputMode="numeric" value={lead.whatsapp} onChange={(e) => setLead({ ...lead, whatsapp: formatWhatsApp(e.target.value) })} placeholder="WhatsApp com DDD" className="mt-3 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500" />
          <label className="mt-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4"><input type="checkbox" checked={consentChecked} onChange={(e) => setCombinedConsent(e.target.checked)} className="mt-0.5 h-5 w-5" /><span className="text-[11px] font-bold leading-relaxed text-slate-600">Autorizo o compartilhamento do meu nome, WhatsApp e contexto da triagem com {profile.name}, que poderá falar comigo sobre avaliação e agendamento. Li a <a href="/privacidade" target="_blank" rel="noreferrer" className="text-blue-600 underline">Política de Privacidade</a>.</span></label>
          <button disabled={busy} type="submit" className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Liberar resultado completo</button>
        </form>
      </div>
    </main>
  );
};

const AreaDetail = ({ area }: { area: SmileV6Area }) => (
  <div className="mt-3 rounded-[1.75rem] border border-blue-100 bg-white p-5 text-slate-950 shadow-xl">
    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-600">Aprofundando · {area.label}</p>
    <h3 className="mt-2 text-xl font-black leading-tight">{area.headline}</h3>
    <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500">{area.summary}</p>
    <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">O que vale conversar</p><p className="mt-2 text-sm font-black leading-relaxed text-slate-700">{area.action}</p></div>
    <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-600">Pergunta para levar</p><p className="mt-2 text-sm font-black leading-relaxed text-slate-800">“{area.question}”</p></div>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><Clock3 className="h-5 w-5" /></span><div><p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Tempo relacionado a este sinal</p><p className="mt-1 text-xs font-black text-slate-700">{area.time.eyebrow}</p></div></div><p className="mt-4 text-3xl font-black tracking-tight">{area.time.range}</p><p className="mt-2 text-sm font-black leading-tight text-slate-800">{area.time.headline}</p><p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{area.time.body}</p><p className="mt-3 text-[9px] font-medium leading-relaxed text-slate-400">{area.time.source}</p></div>
  </div>
);

const ResultStep = ({
  scores,
  fullReport,
  leadName,
  profile,
  onContact,
  onRequestContact,
  onExit,
}: {
  scores: SmileScores;
  fullReport: boolean;
  leadName: string;
  profile: PublicProfessionalProfile;
  onContact: () => void;
  onRequestContact: () => Promise<void>;
  onExit: () => void;
}) => {
  const areas = useMemo(() => smileV6Areas(scores, fullReport), [scores, fullReport]);
  const overall = smileV6OverallIndex(scores, fullReport);
  const primary = smileV6PrimaryArea(scores, fullReport);
  const highest = smileV6HighestArea(scores, fullReport);
  const gap = smileV6GapFromOverall(scores, fullReport);
  const [selectedId, setSelectedId] = useState<SmileV6AreaId | null>(primary.id);
  const [contactRequested, setContactRequested] = useState(false);
  const [requestingContact, setRequestingContact] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestContact = async () => {
    setRequestingContact(true);
    setActionError(null);
    try {
      await onRequestContact();
      setContactRequested(true);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Não foi possível registrar o pedido de contato.");
    } finally {
      setRequestingContact(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-9 sm:px-6">
      <JourneyProgress current={2} />
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Seu resultado completo</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">{leadName || "Agora"}, veja o que os sinais dizem quando aparecem juntos.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">O índice geral resume a leitura. A comparação mostra onde existe mais contraste — e onde vale aprofundar primeiro.</p>
      </div>

      <section className="mx-auto mt-9 max-w-5xl overflow-hidden rounded-[2.75rem] bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="rounded-[2.25rem] border border-white/10 bg-white/[0.045] p-6 sm:p-7">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Índice Visual Geral</p>
            <div className="mt-5 flex items-end gap-2"><p className="text-7xl font-black tracking-tight">{overall}</p><p className="pb-2 text-xl font-black text-white/25">/100</p></div>
            <p className="mt-4 text-sm font-bold leading-relaxed text-white/70">Uma visão do conjunto antes de entrar nos detalhes.</p>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-400" style={{ width: `${overall}%` }} /></div>
            <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[8px] font-black uppercase tracking-wider text-white/30">Maior índice</p><p className="mt-2 text-2xl font-black">{highest.score}</p><p className="mt-1 text-[9px] font-bold text-white/45">{highest.label}</p></div><div className="rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4"><p className="text-[8px] font-black uppercase tracking-wider text-violet-200">Principal contraste</p><p className="mt-2 text-2xl font-black">{primary.score}</p><p className="mt-1 text-[9px] font-bold text-white/45">{primary.label}</p></div></div>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-300">O que a média revela</p>
            <h2 className="mt-2 text-3xl font-black">{gap > 0 ? `${primary.label} está ${gap} pontos abaixo da sua média geral.` : `${primary.label} é o principal contraste desta leitura.`}</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-white/55">O resultado geral não encerra a leitura. Ele cria referência. Toque em cada sinal para entender o que ele pode significar e qual horizonte costuma estar associado a esse tipo de cuidado.</p>
            <div className="mt-6 space-y-3">
              {areas.map((area) => {
                const expanded = selectedId === area.id;
                return (
                  <div key={area.id}>
                    <button type="button" onClick={() => setSelectedId(expanded ? null : area.id)} aria-expanded={expanded} className={`w-full rounded-2xl border p-4 text-left transition ${expanded ? "border-blue-300 bg-white/10" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black">{area.label}</p><p className="mt-1 text-[10px] font-medium leading-relaxed text-white/45">{area.summary}</p></div><span className="text-xl font-black">{area.score}</span></div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${expanded ? "bg-blue-400" : "bg-white/35"}`} style={{ width: `${area.score}%` }} /></div>
                      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">índice visual</span><span className={`text-[9px] font-black ${expanded ? "text-blue-200" : "text-white/50"}`}>{expanded ? "Fechar detalhes ↑" : "Entender este sinal ↓"}</span></div>
                    </button>
                    {expanded && <AreaDetail area={area} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-5xl rounded-[2.5rem] border border-amber-200 bg-amber-50 p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-700">Por que agir mesmo sem dor?</p><h2 className="mt-2 text-2xl font-black">Dor não é um bom marcador para decidir quando cuidar.</h2><p className="mt-2 max-w-2xl text-xs font-medium leading-relaxed text-slate-600">Cárie em estágio inicial normalmente não causa sintomas e alterações gengivais podem evoluir antes de sinais claros. Isso é informação educacional — não significa que essas condições foram identificadas na sua foto.</p><p className="mt-5 max-w-2xl text-sm font-black leading-relaxed text-slate-800">Você já sabe o que mais chamou atenção e quanto alguns caminhos podem levar. O próximo passo é descobrir o que realmente faz sentido para você.</p></div>
          {profile.whatsapp ? <button type="button" onClick={onContact} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-xl">Quero avaliar isso agora <ExternalLink className="h-4 w-4" /></button> : <button type="button" disabled={requestingContact || contactRequested} onClick={() => void requestContact()} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-xl disabled:opacity-60">{requestingContact ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} {contactRequested ? "Pedido enviado" : "Quero receber o contato"}</button>}
        </div>
      </section>

      {profile.whatsapp && (
        <section className="mx-auto mt-4 max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-5 text-center">
          <button type="button" disabled={requestingContact || contactRequested} onClick={() => void requestContact()} className="text-xs font-black text-slate-600 disabled:opacity-60">{requestingContact ? "Registrando pedido..." : contactRequested ? `Pedido de contato enviado para ${profile.name}` : `Prefiro que ${profile.name} fale comigo`}</button>
        </section>
      )}

      {actionError && <div className="mx-auto mt-4 max-w-5xl rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{actionError}</div>}
      <p className="mx-auto mt-6 max-w-2xl text-center text-[10px] font-medium leading-relaxed text-slate-400"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-500" /> Índices e horizontes são informativos. Diagnóstico, indicação clínica e tratamento permanecem com o dentista.</p>
      <button type="button" onClick={onExit} className="mx-auto mt-6 block text-xs font-black uppercase tracking-widest text-slate-400">Voltar ao início</button>
    </main>
  );
};
