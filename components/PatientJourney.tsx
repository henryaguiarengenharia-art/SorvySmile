import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  ImageOff,
  LoaderCircle,
  LockKeyhole,
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
  saveLead,
  startTriage,
  validatePhoto,
} from "../services/sorvyApi";
import { preparePhotoFile } from "../services/photoFile";

type Stage =
  | "capture"
  | "validation"
  | "analyzing"
  | "preview"
  | "contact"
  | "report";

interface ImagePayload {
  dataUrl: string;
  base64: string;
  mimeType: "image/jpeg";
}

const formatWhatsApp = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const statusCopy = (status: SmileScores["status"]) => {
  if (status === "Bom") {
    return {
      label: "Boa consistência visual",
      className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };
  }
  if (status === "Atenção") {
    return {
      label: "Oportunidades para avaliar",
      className: "bg-amber-50 text-amber-700 border-amber-100",
    };
  }
  return {
    label: "Mais pontos para conversar",
    className: "bg-violet-50 text-violet-700 border-violet-100",
  };
};

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
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState({ name: "", whatsapp: "" });
  const [contactConsent, setContactConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);

  const selectPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setReadingPhoto(true);
    setError(null);
    try {
      const payload = await preparePhotoFile(file);
      setImage(payload);
      setValidation(null);
      setStage("validation");
    } catch (photoError) {
      setError(
        photoError instanceof Error
          ? photoError.message
          : "Não foi possível preparar a foto.",
      );
    } finally {
      // Limpa somente depois que a foto já foi copiada para a memória.
      input.value = "";
      setReadingPhoto(false);
    }
  };

  const usePhoto = async () => {
    if (!image) return;
    if (!adultConfirmed || !photoConsent) {
      setError("Confirme as duas autorizações para utilizar esta foto.");
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

      const photoValidation = await validatePhoto(
        activeSessionId,
        image.base64,
        image.mimeType,
      );
      setValidation(photoValidation);
      if (!photoValidation.isAdequate) return;

      setStage("analyzing");
      const result = await analyzePhoto(
        activeSessionId,
        image.base64,
        image.mimeType,
      );
      setScores(result);
      // A imagem existia apenas na memória do navegador e sai do estado após a chamada.
      setImage(null);
      setValidation(null);
      setStage("preview");
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : "Não foi possível processar a foto.",
      );
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
      setError("Confirme as duas autorizações para compartilhar o resultado.");
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
      setStage("report");
    } catch (leadError) {
      setError(
        leadError instanceof Error
          ? leadError.message
          : "Não foi possível salvar seu contato.",
      );
    } finally {
      setBusy(false);
    }
  };

  const contactProfessional = () => {
    const number = profile.whatsapp.replace(/\D/g, "");
    if (!number || !scores) return;
    const message = [
      `Olá! Concluí minha triagem visual na Sorvy Smile pelo link de ${profile.name}.`,
      `Meu nome é ${lead.name}.`,
      `Índice visual de harmonia: ${scores.harmonyIndex}/100.`,
      "Gostaria de conversar sobre uma avaliação presencial.",
    ].join("\n");
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-5">
        <button onClick={onExit} className="flex items-center gap-2 text-sm font-black">
          <span className="rounded-xl bg-blue-600 p-2 text-white">
            <Smile className="h-5 w-5" />
          </span>
          Sorvy Smile
        </button>
        <p className="max-w-[45%] truncate text-right text-xs font-bold text-slate-400">
          {profile.name}
        </p>
      </header>

      {error && (
        <div className="mx-auto mt-5 max-w-xl px-5">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        </div>
      )}

      {stage === "capture" && (
        <CaptureStep
          onPhoto={selectPhoto}
          onBack={onExit}
          readingPhoto={readingPhoto}
        />
      )}
      {stage === "validation" && image && (
        <ValidationStep
          image={image.dataUrl}
          validation={validation}
          busy={busy}
          onPhoto={selectPhoto}
          adultConfirmed={adultConfirmed}
          photoConsent={photoConsent}
          onAdultConfirmed={setAdultConfirmed}
          onPhotoConsent={setPhotoConsent}
          onUsePhoto={usePhoto}
        />
      )}
      {stage === "analyzing" && <AnalyzingStep />}
      {stage === "preview" && scores && (
        <PreviewStep
          scores={scores}
          fullReport={profile.plan !== "lite"}
          onContinue={() => setStage("contact")}
        />
      )}
      {stage === "contact" && scores && (
        <ContactStep
          lead={lead}
          setLead={setLead}
          contactConsent={contactConsent}
          setContactConsent={setContactConsent}
          privacyConsent={privacyConsent}
          setPrivacyConsent={setPrivacyConsent}
          busy={busy}
          profile={profile}
          onSubmit={submitLead}
          onBack={() => setStage("preview")}
        />
      )}
      {stage === "report" && scores && (
        <ReportStep
          scores={scores}
          leadName={lead.name}
          profile={profile}
          onContact={contactProfessional}
          onExit={onExit}
        />
      )}
    </div>
  );
};

const CaptureStep = ({
  onPhoto,
  onBack,
  readingPhoto,
}: {
  onPhoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  readingPhoto: boolean;
}) => (
  <main className="mx-auto max-w-xl px-6 py-12">
    <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-black text-slate-500">
      <ChevronLeft className="h-4 w-4" /> Voltar
    </button>
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
        Etapa 1 de 3
      </p>
      <h1 className="mt-2 text-4xl font-black">Foto do sorriso</h1>
      <p className="mt-3 font-medium text-slate-500">
        Use luz frontal, câmera reta e mantenha os dentes visíveis.
      </p>
    </div>
    <label className="relative mt-8 flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[3rem] bg-slate-900 text-white shadow-2xl">
      <div className="absolute inset-10 rounded-[48%] border-2 border-dashed border-blue-400/70" />
      {readingPhoto ? (
        <LoaderCircle className="h-12 w-12 animate-spin text-blue-400" />
      ) : (
        <Camera className="h-12 w-12 text-blue-400" />
      )}
      <p className="mt-5 text-sm font-black uppercase tracking-widest">
        {readingPhoto ? "Preparando foto" : "Fotografar ou escolher foto"}
      </p>
      <p className="mt-2 text-xs font-medium text-white/40">
        Otimização automática · original de até 20 MB
      </p>
      <input
        type="file"
        accept="image/*"
        capture="user"
        onChange={onPhoto}
        disabled={readingPhoto}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
    <div className="mt-6 grid grid-cols-3 gap-3">
      {[
        ["☀️", "Boa luz"],
        ["😁", "Sorriso aberto"],
        ["📱", "Câmera reta"],
      ].map(([icon, label]) => (
        <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center">
          <p className="text-2xl">{icon}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-wider">
            {label}
          </p>
        </div>
      ))}
    </div>
  </main>
);

const ValidationStep = ({
  image,
  validation,
  busy,
  onPhoto,
  adultConfirmed,
  photoConsent,
  onAdultConfirmed,
  onPhotoConsent,
  onUsePhoto,
}: {
  image: string;
  validation: PhotoValidation | null;
  busy: boolean;
  onPhoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
  adultConfirmed: boolean;
  photoConsent: boolean;
  onAdultConfirmed: (value: boolean) => void;
  onPhotoConsent: (value: boolean) => void;
  onUsePhoto: () => void;
}) => (
  <main className="mx-auto max-w-xl px-6 py-12">
    <div className="mb-6 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
        Confirme sua foto
      </p>
      <h1 className="mt-2 text-3xl font-black">Deseja utilizar esta foto?</h1>
      <p className="mt-2 text-sm font-medium text-slate-500">
        Ela será processada temporariamente e não ficará salva no painel.
      </p>
    </div>
    <div className="relative overflow-hidden rounded-[3rem] border-8 border-white bg-slate-900 shadow-2xl">
      <img src={image} alt="Prévia da foto selecionada" className="aspect-square w-full object-cover" />
      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 text-white">
          <LoaderCircle className="h-12 w-12 animate-spin text-blue-400" />
          <p className="mt-4 text-xs font-black uppercase tracking-widest">
            Verificando qualidade
          </p>
        </div>
      )}
    </div>
    {validation && !busy && (
      <div
        className={`mt-5 rounded-2xl border p-5 ${
          validation.isAdequate
            ? "border-emerald-100 bg-emerald-50 text-emerald-800"
            : "border-amber-100 bg-amber-50 text-amber-800"
        }`}
      >
        <div className="flex items-start gap-3">
          {validation.isAdequate ? (
            <CheckCircle2 className="h-6 w-6 shrink-0" />
          ) : (
            <ImageOff className="h-6 w-6 shrink-0" />
          )}
          <div>
            <p className="font-black">
              {validation.isAdequate ? "Foto pronta" : "Refaça a foto"}
            </p>
            <p className="mt-1 text-sm font-medium">{validation.feedback}</p>
          </div>
        </div>
      </div>
    )}
    <section className="mt-6 space-y-3 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-black text-slate-900">Triagem informativa e consentida</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
            A leitura é visual e aproximada. Não diagnostica, não define urgência
            e não substitui consulta com cirurgião-dentista.
          </p>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <input
          type="checkbox"
          checked={adultConfirmed}
          onChange={(event) => onAdultConfirmed(event.target.checked)}
          className="mt-0.5 h-5 w-5"
        />
        <span className="text-xs font-bold leading-relaxed text-slate-600">
          Confirmo que tenho 18 anos ou mais e que a foto é minha.
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <input
          type="checkbox"
          checked={photoConsent}
          onChange={(event) => onPhotoConsent(event.target.checked)}
          className="mt-0.5 h-5 w-5"
        />
        <span className="text-xs font-bold leading-relaxed text-slate-600">
          Autorizo o processamento temporário desta foto para gerar minha triagem.
          Li a{" "}
          <a
            href="/privacidade"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            Política de Privacidade
          </a>
          .
        </span>
      </label>
      <p className="text-center text-[10px] font-bold text-slate-400">
        Consentimento {CONSENT_VERSION} · seus dados só serão enviados ao dono
        deste link após uma autorização separada.
      </p>
    </section>
    <div className="mt-6 grid grid-cols-2 gap-4">
      <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-5 text-xs font-black uppercase tracking-widest">
        <RefreshCw className="h-4 w-4" /> Repetir
        <input
          type="file"
          accept="image/*"
          capture="user"
          onChange={onPhoto}
          className="absolute inset-0 h-full w-full opacity-0"
        />
      </label>
      <button
        disabled={busy || !adultConfirmed || !photoConsent}
        onClick={onUsePhoto}
        className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 py-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-30"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Utilizar esta foto
      </button>
    </div>
  </main>
);

const ANALYSIS_STAGES = [
  "Mapeando harmonia visual",
  "Observando brilho aparente",
  "Comparando simetria",
  "Preparando seu preview",
];

const AnalyzingStep = () => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % ANALYSIS_STAGES.length),
      1800,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <main className="flex min-h-[75vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-8 border-blue-50 border-t-blue-600" />
        <Sparkles className="h-10 w-10 text-blue-600" />
      </div>
      <h1 className="mt-9 text-4xl font-black">Preparando sua triagem</h1>
      <p className="mt-4 min-h-6 text-xs font-black uppercase tracking-widest text-blue-600">
        {ANALYSIS_STAGES[index]}
      </p>
      <p className="mt-7 max-w-sm text-sm font-medium text-slate-400">
        A foto não é adicionada ao cadastro ou ao painel do profissional.
      </p>
    </main>
  );
};

const PreviewStep = ({
  scores,
  fullReport,
  onContinue,
}: {
  scores: SmileScores;
  fullReport: boolean;
  onContinue: () => void;
}) => {
  const status = statusCopy(scores.status);
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Foto removida da sessão do navegador
        </div>
        <p className="mt-7 text-[10px] font-black uppercase tracking-widest text-blue-600">
          Preview sem dados pessoais
        </p>
        <h1 className="mt-2 text-4xl font-black">Seu panorama visual</h1>
      </div>
      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        <MetricCard label="Harmonia visual" value={scores.harmonyIndex} color="text-blue-600" />
        <MetricCard label="Brilho aparente" value={scores.brightnessIndex} color="text-emerald-600" />
      </div>
      <div className={`mt-5 rounded-[2rem] border p-6 ${status.className}`}>
        <p className="text-[10px] font-black uppercase tracking-widest">Leitura informativa</p>
        <p className="mt-2 text-2xl font-black">{status.label}</p>
        <p className="mt-2 text-sm font-medium opacity-80">{scores.benchmarkText}</p>
      </div>
      <div className="mt-7 rounded-[2rem] bg-slate-900 p-8 text-center text-white">
        <LockKeyhole className="mx-auto h-8 w-8 text-blue-400" />
        <h2 className="mt-4 text-2xl font-black">
          {fullReport ? "Veja o relatório completo" : "Salve seu resultado"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-medium text-white/50">
          Informe somente nome e WhatsApp. Você decide se autoriza o contato de
          {` ${scores.recommendedSpecialty ?? "um profissional"}`}.
        </p>
        <button
          onClick={onContinue}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-7 py-4 text-xs font-black uppercase tracking-widest"
        >
          {fullReport ? "Ver meu relatório completo" : "Salvar meu resultado"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
};

const MetricCard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <div className="rounded-[2rem] border border-slate-100 bg-white p-7 text-center shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`mt-3 text-5xl font-black ${color}`}>{value}</p>
    <p className="mt-1 text-[9px] font-black text-slate-300">/ 100</p>
  </div>
);

const ContactStep = ({
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
}) => (
  <main className="mx-auto max-w-xl px-6 py-12">
    <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-black text-slate-500">
      <ChevronLeft className="h-4 w-4" /> Voltar ao preview
    </button>
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl"
    >
      <div className="text-center">
        <span className="mx-auto inline-flex rounded-2xl bg-blue-50 p-4 text-blue-600">
          <User className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-black">
          {profile.plan === "lite" ? "Seu resultado" : "Seu relatório completo"}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Sem CPF, email ou endereço. Só o necessário para o contato.
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Nome
        </span>
        <input
          required
          value={lead.name}
          onChange={(event) => setLead({ ...lead, name: event.target.value })}
          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 font-bold outline-none focus:border-blue-500"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          WhatsApp com DDD
        </span>
        <input
          required
          inputMode="numeric"
          value={lead.whatsapp}
          onChange={(event) =>
            setLead({ ...lead, whatsapp: formatWhatsApp(event.target.value) })
          }
          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 font-bold outline-none focus:border-blue-500"
        />
      </label>
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
            className="mt-0.5 h-5 w-5"
          />
          <span className="text-xs font-bold leading-relaxed text-slate-600">
            Autorizo o compartilhamento do meu nome, WhatsApp e resultado desta
            triagem com {profile.name}.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={contactConsent}
            onChange={(event) => setContactConsent(event.target.checked)}
            className="mt-0.5 h-5 w-5"
          />
          <span className="text-xs font-bold leading-relaxed text-slate-600">
            Autorizo {profile.name} a entrar em contato comigo pelo WhatsApp para
            conversar sobre avaliação e agendamento.
          </span>
        </label>
      </div>
      <button
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <LockKeyhole className="h-5 w-5" />
        )}
        {profile.plan === "lite"
          ? "Salvar e abrir resultado"
          : "Salvar e abrir relatório"}
      </button>
    </form>
  </main>
);

const ReportStep = ({
  scores,
  leadName,
  profile,
  onContact,
  onExit,
}: {
  scores: SmileScores;
  leadName: string;
  profile: PublicProfessionalProfile;
  onContact: () => void;
  onExit: () => void;
}) => {
  const status = statusCopy(scores.status);
  const [contactRequested, setContactRequested] = useState(false);
  const metrics: Array<readonly [string, number]> = [
    ["Harmonia visual", scores.harmonyIndex],
    ["Brilho aparente", scores.brightnessIndex],
    ...(profile.plan === "lite"
      ? []
      : [
          ["Simetria aparente", scores.technicalInsights.symmetry] as const,
          ["Alinhamento aparente", scores.technicalInsights.alignment] as const,
          ["Refletividade", scores.technicalInsights.reflectivity] as const,
        ]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl">
        <header className="bg-slate-900 p-8 text-white">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/40">
            Sorvy Smile · Triagem visual informativa
          </p>
          <h1 className="mt-2 text-3xl font-black">{leadName}</h1>
          <p className="mt-2 text-sm font-medium text-white/50">
            Experiência oferecida por {profile.name}
          </p>
        </header>
        <div className="space-y-8 p-8">
          <div className={`rounded-2xl border p-5 ${status.className}`}>
            <p className="text-[9px] font-black uppercase tracking-widest">
              Panorama visual
            </p>
            <p className="mt-2 text-xl font-black">{status.label}</p>
            <p className="mt-2 text-sm font-medium">{scores.benchmarkText}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Métricas aproximadas da foto
            </p>
            <div className="mt-4 space-y-4">
              {metrics.map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>{label}</span>
                    <span>{value}/100</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Percepção de cor na foto
              </p>
              <p className="mt-2 text-lg font-black">{scores.vitaShade}</p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                Não equivale a medição clínica com escala calibrada.
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                Próximo passo
              </p>
              <p className="mt-2 text-sm font-bold text-slate-700">
                {scores.recommendation}
              </p>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Pontos para conversar na avaliação
            </p>
            <div className="mt-3 space-y-2">
              {scores.observations
                .slice(0, profile.plan === "lite" ? 1 : undefined)
                .map((observation) => (
                <div
                  key={observation}
                  className="flex items-start gap-3 rounded-xl bg-slate-50 p-4"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="text-sm font-bold text-slate-600">{observation}</p>
                </div>
                ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-medium leading-relaxed text-amber-900">
            Este relatório descreve somente aspectos visuais aparentes. Não
            detecta doença, não indica urgência e não define tratamento ou custo.
            A avaliação presencial é indispensável para decisões clínicas.
          </div>
          {profile.whatsapp ? (
            <div className="space-y-3">
              <button
                onClick={onContact}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-5 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700"
              >
                Agendar consulta agora <ExternalLink className="h-5 w-5" />
              </button>
              <button
                onClick={() => setContactRequested(true)}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-slate-600 hover:border-blue-200 hover:text-blue-600"
              >
                {contactRequested
                  ? "Pedido enviado — aguarde o contato"
                  : `Prefiro que ${profile.name} entre em contato`}
              </button>
              {contactRequested && (
                <p className="text-center text-xs font-medium text-slate-500">
                  Seu nome, WhatsApp e resumo já estão disponíveis no painel do
                  profissional responsável por este link.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-600">
              Seus dados foram encaminhados. O profissional poderá entrar em
              contato pelo WhatsApp autorizado.
            </p>
          )}
          <button
            onClick={onExit}
            className="w-full text-xs font-black uppercase tracking-widest text-slate-400"
          >
            Voltar ao início
          </button>
        </div>
      </section>
    </main>
  );
};
