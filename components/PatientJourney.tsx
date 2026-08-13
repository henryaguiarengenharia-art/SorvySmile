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
    if (!number || !scores || !sessionId) return;
    void recordPatientConversionAction(sessionId, "whatsapp_opened").catch(
      () => undefined,
    );
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
    <main className="flex min-h-[75vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-8 border-blue-50 border-t-blue-600" />
        <Sparkles className="h-10 w-10 text-blue-600" />
      </div>
      <h1 className="mt-9 text-4xl font-black">Preparando sua descoberta</h1>
      <p className="mt-4 min-h-6 text-xs font-black uppercase tracking-widest text-blue-600">
        {ANALYSIS_STAGES[index]}
      </p>
      <p className="mt-7 max-w-sm text-sm font-medium text-slate-400">
        A imagem do sorriso é usada somente agora e não é adicionada ao cadastro ou ao painel.
      </p>
    </main>
  );
};

const metricPresentation = (value: number) => {
  if (value >= 72) {
    return {
      label: "Em destaque",
      badgeClass: "bg-emerald-50 text-emerald-700",
      barClass: "bg-emerald-500",
    };
  }
  if (value >= 48) {
    return {
      label: "Equilíbrio visual",
      badgeClass: "bg-blue-50 text-blue-700",
      barClass: "bg-blue-600",
    };
  }
  return {
    label: "Vale explorar",
    badgeClass: "bg-amber-50 text-amber-700",
    barClass: "bg-amber-500",
  };
};

const overallVisualIndex = (scores: SmileScores): number => Math.round(
  (
    scores.harmonyIndex
    + scores.brightnessIndex
    + scores.technicalInsights.symmetry
    + scores.technicalInsights.alignment
    + scores.technicalInsights.reflectivity
  ) / 5,
);

const visualIndexHeadline = (value: number): string => {
  if (value >= 72) return "Seu sorriso apresenta equilíbrio visual em destaque";
  if (value >= 48) return "Seu sorriso tem uma boa base visual para explorar";
  return "Seu sorriso revela pontos interessantes para explorar";
};

const visualTone = (scores: SmileScores): string =>
  scores.vitaShade.replace(/^Tom visual:\s*/i, "");

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
        <h1 className="mt-2 text-4xl font-black">Seus primeiros destaques</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
          Uma leitura visual rápida para você chegar à conversa com o dentista
          sabendo o que deseja explorar.
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
              Combina características aparentes de harmonia, organização,
              luminosidade e resposta à luz.
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
            label="Tom visual"
            value={visualTone(scores)}
            note="Estimativa"
          />
        )}
        <PreviewMetric
          label="Brilho geral"
          value={`${scores.brightnessIndex}%`}
          score={scores.brightnessIndex}
        />
      </div>

      <section className="mt-5 rounded-[2rem] bg-blue-600 p-7 text-white shadow-xl shadow-blue-100">
        <Sparkles className="h-7 w-7 text-blue-200" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-blue-100">
          Insight visual detectado
        </p>
        <p className="mt-2 text-lg font-black leading-snug">{scores.benchmarkText}</p>
      </section>

      <p className="mt-4 text-center text-[10px] font-bold leading-relaxed text-slate-400">
        Indicadores aproximados de percepção visual. Não representam diagnóstico
        nem medição clínica de cor.
      </p>
      <div className="mt-7 rounded-[2rem] bg-slate-900 p-8 text-center text-white">
        <LockKeyhole className="mx-auto h-8 w-8 text-blue-400" />
        <h2 className="mt-4 text-2xl font-black">Seu Mapa do Sorriso está pronto</h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-medium text-white/50">
          {fullReport
            ? "Receba seus destaques, pontos para conversar e um próximo passo claro para sua avaliação."
            : "Salve sua descoberta e receba o principal ponto para conversar em uma avaliação."}
        </p>
        <div className="mx-auto mt-5 max-w-sm space-y-2 text-left text-xs font-bold text-white/75">
          <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Leitura visual detalhada</p>
          <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Perguntas para levar ao dentista</p>
          <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Próximo passo recomendado</p>
        </div>
        <button
          onClick={onContinue}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-7 py-4 text-xs font-black uppercase tracking-widest"
        >
          Receber meu Mapa do Sorriso
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
}: {
  label: string;
  value: string;
  score?: number;
  note?: string;
}) => {
  const presentation = score == null ? null : metricPresentation(score);
  return (
    <div className="flex min-h-36 flex-col rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[9px] font-black uppercase leading-relaxed tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black capitalize text-slate-900">{value}</p>
      <span className={`mt-auto inline-flex w-fit rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${
        presentation?.badgeClass ?? "bg-violet-50 text-violet-700"
      }`}>
        {presentation?.label ?? note}
      </span>
    </div>
  );
};

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
        <h1 className="mt-2 text-3xl font-black">Receba seu Mapa do Sorriso</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Precisamos somente do seu nome e WhatsApp. Sem CPF, email ou endereço.
        </p>
      </div>
      <div className="space-y-2 rounded-2xl bg-blue-50 p-5 text-xs font-bold text-blue-900">
        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Seus destaques visuais</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Pontos para conversar na avaliação</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Acesso direto a {profile.name}</p>
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
        Receber meu Mapa do Sorriso
      </button>
      <p className="text-center text-[10px] font-bold leading-relaxed text-slate-400">
        Você escolhe na próxima tela se quer iniciar a conversa ou receber o contato.
      </p>
    </form>
  </main>
);

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
            {leadName}, agora você já sabe quais pontos deseja explorar.
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
                Experiência principal
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">Estética do sorriso</p>
            </div>
            <div className="rounded-[1.75rem] bg-amber-50 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">
                Foco da conversa
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">
                Explorar possibilidades
              </p>
            </div>
          </div>

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">
                  Seu painel visual
                </p>
                <h2 className="mt-1 text-2xl font-black">O que se destacou no sorriso</h2>
              </div>
              <div className="hidden items-center gap-3 text-[8px] font-black uppercase tracking-wider text-slate-400 sm:flex">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Destaque</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-600" /> Equilíbrio</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Explorar</span>
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
                Tom visual estimado
              </p>
              <p className="mt-2 text-2xl font-black capitalize">{visualTone(scores)}</p>
              <p className="mt-2 text-[10px] font-medium leading-relaxed text-slate-400">
                Não equivale à escala clínica VITA; luz e câmera alteram a percepção.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-blue-600 p-6 text-white">
              <Sparkles className="h-6 w-6 text-blue-200" />
              <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-blue-100">
                Insight visual detectado
              </p>
              <p className="mt-2 text-base font-black leading-snug">{scores.benchmarkText}</p>
            </div>
          </div>

          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">
              Leve para a conversa
            </p>
            <h2 className="mt-1 text-2xl font-black">Pontos que merecem ser explorados</h2>
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
              Próximo passo sugerido
            </p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-700">
              {scores.recommendation}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[10px] font-medium leading-relaxed text-slate-500">
            Leitura visual informativa: não diagnostica, não indica urgência e
            não define tratamento. Decisões clínicas exigem avaliação presencial.
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
                Conversar com {profile.name} no WhatsApp
                <ExternalLink className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={requestingContact || contactRequested}
                onClick={() => void requestContact()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-slate-600 hover:border-blue-200 hover:text-blue-600 disabled:opacity-60"
              >
                {requestingContact && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {contactRequested ? "Pedido de contato enviado" : "Prefiro receber o contato"}
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
