import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  ImageOff,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
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
  saveLead,
  startTriage,
  validatePhoto,
  recordPatientConversionAction,
} from "../services/sorvyApi";
import { preparePhotoFile } from "../services/photoFile";
import {
  overallVisualIndex,
  reportHeadline,
  visualIndexHeadline,
  visualIndexSummary,
  visualMetricLabel,
  visualMetricLevel,
  vitaToneDescription,
} from "../services/smilePresentation";

const GuidedCamera = React.lazy(() =>
  import("./GuidedCamera").then((module) => ({
    default: module.GuidedCamera,
  })),
);

type Stage =
  | "capture"
  | "camera"
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
  const [imageConsent, setImageConsent] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);

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
      setError(
        photoError instanceof Error
          ? photoError.message
          : "Não foi possível preparar a foto.",
      );
    } finally {
      setReadingPhoto(false);
    }
  }, []);

  const selectPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file) await prepareSelectedPhoto(file);
    // Limpa somente depois que a foto já foi copiada para a memória.
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
    if (!number || !scores || !sessionId) return;
    void recordPatientConversionAction(sessionId, "whatsapp_opened").catch(
      () => undefined,
    );
    const message = [
      `Olá! Concluí minha triagem visual na Sorvy Smile pelo link de ${profile.name}.`,
      `Meu nome é ${lead.name}.`,
      `Índice visual geral: ${overallVisualIndex(scores)}/100.`,
      `Foco sugerido: ${scores.intentCategory || "avaliação integral do sorriso"}.`,
      "Gostaria de agendar uma avaliação presencial para entender as possibilidades de cuidado.",
    ].join("\n");
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const requestProfessionalContact = async () => {
    if (!sessionId) {
      throw new Error("Esta triagem não está mais disponível.");
    }
    await recordPatientConversionAction(sessionId, "contact_requested");
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
          profile={profile}
          onPhoto={selectPhoto}
          onBack={onExit}
          onOpenCamera={() => setStage("camera")}
          readingPhoto={readingPhoto}
        />
      )}
      {stage === "camera" && (
        <React.Suspense
          fallback={(
            <div className="flex min-h-[70vh] items-center justify-center">
              <LoaderCircle className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          )}
        >
          <GuidedCamera
            onCapture={prepareSelectedPhoto}
            onCancel={() => setStage("capture")}
            onChoosePhoto={selectPhoto}
          />
        </React.Suspense>
      )}
      {stage === "validation" && image && (
        <ValidationStep
          image={image.dataUrl}
          validation={validation}
          busy={busy}
          onPhoto={selectPhoto}
          imageConsent={imageConsent}
          onImageConsent={setImageConsent}
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
          scores={scores}
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
    <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-black text-slate-500">
      <ChevronLeft className="h-4 w-4" /> Voltar
    </button>
    <JourneyProgress current={0} />
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
        Sua primeira descoberta
      </p>
      <h1 className="mt-2 text-4xl font-black">Vamos enquadrar seu sorriso</h1>
      <p className="mt-3 font-medium text-slate-500">
        O guia acompanha o enquadramento e avisa quando estiver tudo pronto.
      </p>
    </div>

    <section className="mt-7 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="rounded-2xl bg-blue-50 p-3 text-blue-600">
          <Smile className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-blue-600">
            Experiência oferecida por
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">{profile.name}</p>
          {(profile.specialty || profile.city) && (
            <p className="mt-1 text-xs font-medium text-slate-500">
              {[profile.specialty, profile.city, profile.state]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {profile.bio && (
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              {profile.bio}
            </p>
          )}
        </div>
      </div>
    </section>

    <button
      onClick={onOpenCamera}
      disabled={readingPhoto}
      className="mt-6 flex w-full items-center justify-center gap-3 rounded-3xl bg-slate-900 px-6 py-6 text-sm font-black text-white shadow-xl transition hover:bg-blue-600 disabled:opacity-50"
    >
      <Camera className="h-6 w-6 text-blue-300" /> Usar câmera guiada
      <ArrowRight className="h-5 w-5" />
    </button>

    <label className="relative mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-slate-600">
      {readingPhoto ? (
        <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
      ) : (
        <ImagePlus className="h-5 w-5 text-blue-600" />
      )}
      {readingPhoto ? "Preparando sorriso" : "Escolher uma imagem"}
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
    <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-400">
      <ShieldCheck className="h-4 w-4 text-emerald-500" />
      A câmera é orientada no aparelho. A imagem só é enviada após sua confirmação.
    </p>
  </main>
);

const JOURNEY_STEPS = ["Sorriso", "Descoberta", "Mapa", "Conversa"];

const JourneyProgress = ({ current }: { current: number }) => (
  <div className="mb-8 grid grid-cols-4 gap-2" aria-label="Progresso da experiência">
    {JOURNEY_STEPS.map((label, index) => (
      <div key={label} className="text-center">
        <div
          className={`h-1.5 rounded-full ${
            index <= current ? "bg-blue-600" : "bg-slate-200"
          }`}
        />
        <p
          className={`mt-2 text-[9px] font-black uppercase tracking-wider ${
            index <= current ? "text-blue-600" : "text-slate-300"
          }`}
        >
          {label}
        </p>
      </div>
    ))}
  </div>
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
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
        Você está no controle
      </p>
      <h1 className="mt-2 text-3xl font-black">Este é o sorriso que vamos analisar?</h1>
      <p className="mt-2 text-sm font-medium text-slate-500">
        Confirme a imagem e autorize somente o processamento necessário para sua leitura.
      </p>
    </div>
    <div className="relative overflow-hidden rounded-[3rem] border-8 border-white bg-slate-900 shadow-2xl">
      <img src={image} alt="Prévia do sorriso selecionado" className="aspect-[3/2] w-full object-cover" />
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
              {validation.isAdequate ? "Sorriso pronto" : "Precisamos de outro enquadramento"}
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
            Esta é uma leitura visual aproximada para ajudar na conversa com o
            dentista. Não é diagnóstico e não substitui consulta.
          </p>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <input
          type="checkbox"
          checked={imageConsent}
          onChange={(event) => onImageConsent(event.target.checked)}
          className="mt-0.5 h-5 w-5"
        />
        <span className="text-xs font-bold leading-relaxed text-slate-600">
          Confirmo que tenho 18 anos ou mais, que esta imagem é minha e autorizo
          seu processamento temporário para gerar a leitura do sorriso.
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
          Consentimento {CONSENT_VERSION} · a imagem não ficará no painel e seus
          dados só serão compartilhados após outra autorização.
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
        disabled={busy || !imageConsent}
        onClick={onUsePhoto}
        className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 py-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-30"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Analisar meu sorriso
      </button>
    </div>
  </main>
);

const ANALYSIS_STAGES = [
  "Observando os detalhes do sorriso",
  "Mapeando harmonia e luminosidade",
  "Organizando sua primeira descoberta",
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
    <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col items-center justify-center overflow-hidden px-4 py-4 text-center sm:px-6 sm:py-6">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center sm:h-32 sm:w-32 lg:h-36 lg:w-36">
        <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-blue-50 border-t-blue-600 sm:border-8" />
        <Sparkles className="h-8 w-8 text-blue-600 sm:h-10 sm:w-10" />
      </div>
      <h1 className="mt-6 text-3xl font-black sm:mt-8 sm:text-4xl">Preparando sua descoberta</h1>
      <p className="mt-3 min-h-6 max-w-md text-[10px] font-black uppercase tracking-widest text-blue-600 sm:mt-4 sm:text-xs">
        {ANALYSIS_STAGES[index]}
      </p>
      <p className="mt-5 max-w-sm text-xs font-medium leading-relaxed text-slate-400 sm:mt-6 sm:text-sm">
        A imagem do sorriso é usada somente agora e não é adicionada ao cadastro ou ao painel.
      </p>
    </main>
  );
};

const metricPresentation = (value: number) => {
  const level = visualMetricLevel(value);
  const colors = {
    strength: {
      badgeClass: "bg-emerald-50 text-emerald-700",
      barClass: "bg-emerald-500",
    },
    opportunity: {
      badgeClass: "bg-blue-50 text-blue-700",
      barClass: "bg-blue-600",
    },
    attention: {
      badgeClass: "bg-amber-50 text-amber-800",
      barClass: "bg-amber-500",
    },
    evaluation: {
      badgeClass: "bg-red-50 text-red-700",
      barClass: "bg-red-500",
    },
  }[level];
  return { label: visualMetricLabel(value), ...colors };
};

const vitaClassification = (scores: SmileScores): string =>
  scores.vitaShade.replace(/^Tom visual:\s*/i, "");

const insightPresentation = (visualIndex: number) => {
  const level = visualMetricLevel(visualIndex);
  if (level === "evaluation") {
    return {
      panel: "border border-rose-200 bg-rose-50 text-slate-900 shadow-rose-100",
      icon: "text-rose-600",
      label: "text-rose-700",
    };
  }
  if (level === "attention") {
    return {
      panel: "border border-amber-200 bg-amber-50 text-slate-900 shadow-amber-100",
      icon: "text-amber-600",
      label: "text-amber-700",
    };
  }
  return {
    panel: "bg-blue-600 text-white shadow-blue-100",
    icon: "text-blue-200",
    label: "text-blue-100",
  };
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
  const visualIndex = overallVisualIndex(scores);
  const insight = insightPresentation(visualIndex);
  return (
    <main className="mx-auto max-w-3xl px-6 py-9">
      <JourneyProgress current={1} />
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Primeira descoberta liberada
        </div>
        <p className="mt-7 text-[10px] font-black uppercase tracking-widest text-blue-600">
          Sem dados pessoais
        </p>
        <h1 className="mt-2 text-4xl font-black">O que seu sorriso revela</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
          Veja o principal ponto identificado e chegue à avaliação sabendo o que
          precisa ser compreendido.
        </p>
      </div>
      <section className="mt-8 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:text-left">
          <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full border-[10px] border-white bg-slate-950 text-white shadow-xl">
            <span className="text-4xl font-black">{visualIndex}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-300">de 100</span>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              Índice visual geral
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900">
              {visualIndexHeadline(visualIndex)}
            </h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
              {visualIndexSummary(visualIndex)}
            </p>
          </div>
        </div>
      </section>

      <div className={`mt-5 grid grid-cols-2 gap-3 ${fullReport ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
        <PreviewMetric
          label="Harmonia do sorriso"
          value={`${scores.harmonyIndex}%`}
          score={scores.harmonyIndex}
        />
        {fullReport && (
          <PreviewMetric
            label="Refletividade"
            value={`${scores.technicalInsights.reflectivity}%`}
            score={scores.technicalInsights.reflectivity}
          />
        )}
        {fullReport && (
          <PreviewMetric
            label="Classificação VITA"
            value={vitaClassification(scores)}
            description={vitaToneDescription(vitaClassification(scores))}
          />
        )}
        <PreviewMetric
          label="Brilho geral"
          value={`${scores.brightnessIndex}%`}
          score={scores.brightnessIndex}
        />
      </div>

      <section className={`mt-5 rounded-[2rem] p-7 shadow-xl ${insight.panel}`}>
        <Sparkles className={`h-7 w-7 ${insight.icon}`} />
        <p className={`mt-4 text-[10px] font-black uppercase tracking-widest ${insight.label}`}>
          Principal achado visual
        </p>
        <p className="mt-2 text-lg font-black leading-snug">{scores.benchmarkText}</p>
      </section>

      <p className="mt-4 text-center text-[10px] font-bold leading-relaxed text-slate-400">
        Conteúdo gerado por IA a partir de uma imagem e sujeito a pequenas variações.
        A causa dos achados e a classificação VITA exata precisam ser confirmadas
        em avaliação presencial.
      </p>
      <div className="mt-7 rounded-[2rem] bg-slate-900 p-8 text-center text-white">
        <LockKeyhole className="mx-auto h-8 w-8 text-blue-400" />
        <h2 className="mt-4 text-2xl font-black">Seu Mapa do Sorriso está pronto</h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-medium text-white/50">
          {fullReport
            ? "A leitura encontrou outros pontos que podem fazer diferença no seu sorriso. Desbloqueie para entender o que priorizar e levar à avaliação."
            : "Desbloqueie o principal ponto que merece ser levado à sua avaliação."}
        </p>
        <button
          onClick={onContinue}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-7 py-4 text-xs font-black uppercase tracking-widest"
        >
          Desbloquear meu Mapa do Sorriso
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
};

const PreviewMetric = ({
  label,
  value,
  score,
  note,
  description,
}: {
  label: string;
  value: string;
  score?: number;
  note?: string;
  description?: string;
}) => {
  const presentation = score == null ? null : metricPresentation(score);
  return (
    <div className="flex min-h-36 flex-col rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[9px] font-black uppercase leading-relaxed tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black capitalize text-slate-900">{value}</p>
      {description && (
        <p className="mt-1 text-[10px] font-bold leading-snug text-slate-500">
          {description}
        </p>
      )}
      {(presentation || note) && (
        <span className={`mt-auto inline-flex w-fit rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${
          presentation?.badgeClass ?? "bg-violet-50 text-violet-700"
        }`}>
          {presentation?.label ?? note}
        </span>
      )}
    </div>
  );
};

const ContactStep = ({
  scores,
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
  const visualIndex = overallVisualIndex(scores);
  const consentChecked = contactConsent && privacyConsent;
  const setCombinedConsent = (value: boolean) => {
    setContactConsent(value);
    setPrivacyConsent(value);
  };

  return (
  <main className="mx-auto max-w-xl px-6 py-9">
    <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-black text-slate-500">
      <ChevronLeft className="h-4 w-4" /> Voltar à descoberta
    </button>
    <JourneyProgress current={2} />
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl"
    >
      <div className="text-center">
        <span className="mx-auto inline-flex rounded-2xl bg-blue-50 p-4 text-blue-600">
          <User className="h-7 w-7" />
        </span>
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-blue-600">
          Último passo
        </p>
        <h1 className="mt-2 text-3xl font-black">{reportHeadline(visualIndex)}</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Informe somente seu nome e WhatsApp para liberar o mapa e permitir que{" "}
          {profile.name} ajude você a entender os próximos passos.
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Nome
        </span>
        <input
          required
          autoComplete="name"
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
          autoComplete="tel"
          inputMode="numeric"
          value={lead.whatsapp}
          onChange={(event) =>
            setLead({ ...lead, whatsapp: formatWhatsApp(event.target.value) })
          }
          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 font-bold outline-none focus:border-blue-500"
        />
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(event) => setCombinedConsent(event.target.checked)}
          className="mt-0.5 h-5 w-5"
        />
        <span className="text-xs font-bold leading-relaxed text-slate-600">
          Autorizo o compartilhamento do meu nome, WhatsApp e mapa com {profile.name},
          que poderá falar comigo pelo WhatsApp sobre avaliação e agendamento. Li a{" "}
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
      <button
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <LockKeyhole className="h-5 w-5" />
        )}
        Liberar meu mapa e receber orientação
      </button>
      <p className="text-center text-[10px] font-bold leading-relaxed text-slate-400">
        Na próxima tela você escolhe se prefere iniciar a conversa ou receber o contato.
      </p>
    </form>
  </main>
  );
};

const ReportStep = ({
  scores,
  leadName,
  profile,
  onContact,
  onRequestContact,
  onExit,
}: {
  scores: SmileScores;
  leadName: string;
  profile: PublicProfessionalProfile;
  onContact: () => void;
  onRequestContact: () => Promise<void>;
  onExit: () => void;
}) => {
  const [contactRequested, setContactRequested] = useState(false);
  const [requestingContact, setRequestingContact] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const visualIndex = overallVisualIndex(scores);
  const reportInsight = insightPresentation(visualIndex);
  const reportMetrics = profile.plan === "lite"
    ? [
        ["Harmonia do sorriso", scores.harmonyIndex],
        ["Brilho geral", scores.brightnessIndex],
      ] as const
    : [
        ["Harmonia do sorriso", scores.harmonyIndex],
        ["Alinhamento aparente", scores.technicalInsights.alignment],
        ["Refletividade", scores.technicalInsights.reflectivity],
        ["Brilho geral", scores.brightnessIndex],
      ] as const;

  const requestContact = async () => {
    setRequestingContact(true);
    setActionError(null);
    try {
      await onRequestContact();
      setContactRequested(true);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível registrar o pedido de contato.",
      );
    } finally {
      setRequestingContact(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-9">
      <JourneyProgress current={3} />
      <section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl">
        <header className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-7 text-white sm:p-9">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-blue-100">
              <Sparkles className="h-4 w-4" /> Mapa liberado
            </div>
            <p className="text-right text-[9px] font-black uppercase tracking-widest text-white/50">
              Sorvy Smile
            </p>
          </div>
          <h1 className="mt-7 text-4xl font-black">Seu Mapa do Sorriso</h1>
          <p className="mt-2 text-sm font-medium text-white/70">
            {leadName}, {reportHeadline(visualIndex).toLowerCase()}.
          </p>
          <p className="mt-1 text-xs font-medium text-white/50">
            Oferecido por {profile.name}
          </p>
        </header>
        <div className="space-y-7 p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr_1.1fr]">
            <div className="flex items-center gap-4 rounded-[1.75rem] bg-slate-950 p-5 text-white">
              <div>
                <p className="text-4xl font-black text-blue-400">{visualIndex}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">de 100</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                  Índice geral
                </p>
                <p className="mt-1 text-xs font-bold leading-snug">
                  {metricPresentation(visualIndex).label}
                </p>
              </div>
            </div>
            <div className="rounded-[1.75rem] bg-blue-50 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                Especialidade indicada
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {scores.recommendedSpecialty || "Avaliação odontológica geral"}
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-amber-50 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">
                Foco do cuidado
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {scores.intentCategory || "Avaliação integral do sorriso"}
              </p>
            </div>
          </div>

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">
                  Seu painel visual
                </p>
                <h2 className="mt-1 text-2xl font-black">O que precisa ser compreendido</h2>
              </div>
              <div className="hidden items-center gap-3 text-[8px] font-black uppercase tracking-wider text-slate-400 sm:flex">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Ponto forte</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-600" /> Pode evoluir</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Atenção</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-500" /> Avaliação</span>
              </div>
            </div>
            <div className="mt-5 space-y-5">
              {reportMetrics.map(([label, value]) => (
                <ReportMetric key={label} label={label} value={value} />
              ))}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Classificação VITA estimada
              </p>
              <p className="mt-2 text-2xl font-black">{vitaClassification(scores)}</p>
              <p className="mt-1 text-xs font-bold text-slate-600">
                {vitaToneDescription(vitaClassification(scores))}
              </p>
              <p className="mt-2 text-[10px] font-medium leading-relaxed text-slate-400">
                A faixa exata precisa ser confirmada presencialmente; luz e câmera alteram a percepção.
              </p>
            </div>
            <div className={`rounded-[1.75rem] p-6 ${reportInsight.panel}`}>
              <Sparkles className={`h-6 w-6 ${reportInsight.icon}`} />
              <p className={`mt-4 text-[9px] font-black uppercase tracking-widest ${reportInsight.label}`}>
                Principal achado visual
              </p>
              <p className="mt-2 text-base font-black leading-snug">{scores.benchmarkText}</p>
            </div>
          </div>

          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">
              Entenda antes da consulta
            </p>
            <h2 className="mt-1 text-2xl font-black">Pontos que merecem avaliação</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {scores.observations
                .slice(0, profile.plan === "lite" ? 1 : undefined)
                .map((observation, index) => (
                  <div
                    key={observation}
                    className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600">
                      {index + 1}
                    </span>
                    <p className="text-sm font-bold leading-relaxed text-slate-600">{observation}</p>
                  </div>
                ))}
            </div>
          </section>

          <div className="rounded-[1.75rem] border border-blue-100 bg-blue-50 p-5">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">
              Recomendação da inteligência artificial
            </p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-700">
              {scores.recommendation}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[10px] font-medium leading-relaxed text-slate-500">
            Conteúdo gerado por IA e sujeito a pequenas variações. Esta leitura não
            confirma diagnóstico nem define tratamento. Se houver dor, inchaço,
            sangramento ou trauma, procure atendimento odontológico.
          </div>

          {actionError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              {actionError}
            </div>
          )}

          {profile.whatsapp ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={onContact}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-5 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700"
              >
                Quero avaliar como melhorar meu sorriso
                <ExternalLink className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={requestingContact || contactRequested}
                onClick={() => void requestContact()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-slate-600 hover:border-blue-200 hover:text-blue-600 disabled:opacity-60"
              >
                {requestingContact && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {contactRequested ? "Pedido de contato enviado" : `Prefiro que ${profile.name} fale comigo`}
              </button>
              {contactRequested && (
                <p className="rounded-2xl bg-emerald-50 p-4 text-center text-xs font-bold text-emerald-800">
                  Pronto. Seu pedido ficou destacado no painel de {profile.name}.
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={requestingContact || contactRequested}
              onClick={() => void requestContact()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
            >
              {requestingContact ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {contactRequested ? "Pedido de contato enviado" : "Quero receber o contato"}
            </button>
          )}
          <button
            type="button"
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

const ReportMetric = ({ label, value }: { label: string; value: number }) => {
  const presentation = metricPresentation(value);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-800">{label}</p>
          <p className="mt-0.5 text-[9px] font-bold text-slate-400">
            {presentation.label}
          </p>
        </div>
        <p className="text-lg font-black text-slate-900">{value}%</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${presentation.barClass}`}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </div>
    </div>
  );
};
