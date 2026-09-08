import React, { useMemo, useState } from "react";
import {
  AlignCenter,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Compass,
  Eye,
  LockKeyhole,
  Map,
  MessageCircle,
  ShieldCheck,
  Smile,
  Sparkles,
  Sun,
  Target,
  User,
} from "lucide-react";

type V5Stage = "preview" | "identity" | "map" | "conversation";
type AreaId = "alignment" | "brightness" | "harmony" | "proportion";
type IconType = React.ComponentType<{ className?: string }>;

interface MapArea {
  id: AreaId;
  label: string;
  score: number;
  status: string;
  headline: string;
  finding: string;
  meaning: string;
  question: string;
  icon: IconType;
  accent: string;
  soft: string;
  border: string;
  x: number;
  y: number;
}

const MAP_AREAS: MapArea[] = [
  {
    id: "alignment",
    label: "Alinhamento aparente",
    score: 71,
    status: "Principal ponto para conversar",
    headline: "Vale investigar o posicionamento aparente.",
    finding: "A leitura visual percebeu diferenças de posicionamento que se destacaram mais do que os outros aspectos observados.",
    meaning: "Isso não define necessidade de tratamento. Serve para orientar uma avaliação mais objetiva sobre alinhamento e equilíbrio do conjunto.",
    question: "Esse posicionamento merece uma avaliação ortodôntica ou é apenas uma característica visual do meu sorriso?",
    icon: AlignCenter,
    accent: "text-violet-700",
    soft: "bg-violet-50",
    border: "border-violet-200",
    x: 75,
    y: 24,
  },
  {
    id: "brightness",
    label: "Cor & brilho",
    score: 82,
    status: "Base visual favorável",
    headline: "A luminosidade aparece como um ponto positivo.",
    finding: "Nesta imagem, a percepção de brilho está em uma faixa visual favorável e não aparece como prioridade principal.",
    meaning: "A cor real depende de luz, câmera e avaliação presencial. Aqui ela funciona como referência para organizar a conversa.",
    question: "Se eu quiser melhorar a percepção de cor, quais opções preservam um resultado natural?",
    icon: Sun,
    accent: "text-amber-700",
    soft: "bg-amber-50",
    border: "border-amber-200",
    x: 25,
    y: 24,
  },
  {
    id: "harmony",
    label: "Harmonia",
    score: 78,
    status: "Boa base para preservar",
    headline: "O conjunto mantém uma boa leitura de harmonia.",
    finding: "A relação visual entre os elementos do sorriso mostra uma base equilibrada, com refinamentos possíveis sem perder naturalidade.",
    meaning: "O mapa ajuda a diferenciar o que merece atenção do que já funciona bem e pode simplesmente ser preservado.",
    question: "Quais refinamentos fariam sentido sem descaracterizar o meu sorriso?",
    icon: Target,
    accent: "text-blue-700",
    soft: "bg-blue-50",
    border: "border-blue-200",
    x: 25,
    y: 76,
  },
  {
    id: "proportion",
    label: "Proporção",
    score: 74,
    status: "Aspecto complementar",
    headline: "Há espaço para entender melhor o equilíbrio das proporções.",
    finding: "A proporção do conjunto aparece como um aspecto secundário que pode ser explorado presencialmente se fizer sentido para seu objetivo.",
    meaning: "Não é uma recomendação de procedimento. É uma pauta útil para discutir contorno, proporção e percepção estética com o profissional.",
    question: "Existe algum aspecto de proporção que realmente valha investigar no meu caso?",
    icon: Eye,
    accent: "text-emerald-700",
    soft: "bg-emerald-50",
    border: "border-emerald-200",
    x: 75,
    y: 76,
  },
];

const JOURNEY = [
  ["Sorriso", Smile],
  ["Prévia", Sparkles],
  ["Mapa", Map],
  ["Conversa", MessageCircle],
] as const;

const JourneyRail = ({ current }: { current: number }) => (
  <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-2" aria-label="Progresso da experiência">
    {JOURNEY.map(([label, Icon], index) => {
      const active = index <= current;
      return (
        <div key={label} className="relative text-center">
          <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border transition ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-300"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className={`mt-2 text-[9px] font-black uppercase tracking-[0.16em] ${active ? "text-slate-800" : "text-slate-300"}`}>
            {label}
          </p>
          {index < JOURNEY.length - 1 && (
            <div className={`absolute left-[63%] top-[18px] h-px w-[74%] ${index < current ? "bg-slate-900" : "bg-slate-200"}`} />
          )}
        </div>
      );
    })}
  </div>
);

const BrandHeader = () => (
  <header className="border-b border-slate-100 bg-white/90 px-5 py-3 backdrop-blur-xl">
    <div className="mx-auto flex max-w-6xl items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
          <Smile className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-black tracking-tight text-slate-950">Sorvy Smile</p>
          <p className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-400">V5 · Experience Lab</p>
        </div>
      </div>
      <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-blue-700">
        protótipo isolado
      </div>
    </div>
  </header>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff_0%,#f8fafc_38%,#ffffff_78%)] text-slate-950">
    <BrandHeader />
    {children}
  </div>
);

const PreviewStage = ({ onContinue }: { onContinue: () => void }) => (
  <main className="overflow-hidden px-5 pb-16 pt-8 sm:pt-12">
    <div className="mx-auto max-w-5xl">
      <JourneyRail current={1} />

      <div className="mx-auto mt-10 max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> leitura concluída
        </div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Sua prévia</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Uma coisa chamou mais atenção.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
          A Sorvy encontrou sinais suficientes para montar seu mapa. Antes de mostrar tudo, veja o ponto que mais se destacou nesta imagem.
        </p>
      </div>

      <section className="relative mx-auto mt-10 max-w-4xl overflow-hidden rounded-[2.75rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl shadow-blue-200/40 sm:p-9">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[0.78fr_1.22fr]">
          <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-5 rounded-full border border-white/10" />
            <div className="absolute inset-10 rounded-full border border-violet-400/25" />
            <div className="absolute inset-[28%] flex items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_0_60px_rgba(255,255,255,0.15)]">
              <AlignCenter className="h-10 w-10" />
            </div>
            <span className="absolute right-[13%] top-[18%] h-3 w-3 rounded-full bg-violet-300 shadow-[0_0_22px_rgba(196,181,253,0.8)]" />
            <span className="absolute bottom-[20%] left-[16%] h-2 w-2 rounded-full bg-blue-300/70" />
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-300">Principal sinal percebido</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Alinhamento aparente merece uma conversa mais de perto.</h2>
            <p className="mt-4 text-sm font-medium leading-relaxed text-white/60">
              Nesta imagem, diferenças de posicionamento se destacaram mais do que os outros aspectos observados. Isso não é diagnóstico — é uma pista para orientar sua avaliação.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-white/70">
              <Compass className="h-4 w-4 text-blue-300" /> ponto principal identificado
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Também percebemos</p>
            <h3 className="mt-1 text-lg font-black">Mais 3 aspectos completam seu mapa.</h3>
          </div>
          <LockKeyhole className="h-5 w-5 shrink-0 text-slate-300" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {["Cor & brilho", "Harmonia", "Proporção"].map((label) => (
            <div key={label} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="absolute inset-0 bg-white/35 backdrop-blur-[2px]" />
              <div className="relative">
                <div className="h-2 w-10 rounded-full bg-slate-200" />
                <p className="mt-4 select-none text-xs font-black text-slate-300 blur-[3px]">{label}</p>
                <p className="mt-2 select-none text-[9px] font-bold text-slate-200 blur-[3px]">detalhes disponíveis no mapa</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-4xl rounded-[2.5rem] border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-white p-6 sm:p-8">
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Seu mapa já está pronto</p>
            <h2 className="mt-2 text-2xl font-black">Veja o conjunto antes de decidir o próximo passo.</h2>
            <p className="mt-2 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
              O mapa completo mostra o que merece prioridade, o que já funciona bem e quais perguntas podem tornar sua conversa com o dentista mais útil.
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-700"
          >
            Ver meu Mapa do Sorriso <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <p className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-2 text-center text-[10px] font-medium leading-relaxed text-slate-400">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
        Prévia informativa. A leitura não substitui avaliação odontológica presencial.
      </p>
    </div>
  </main>
);

const IdentityStage = ({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: (name: string) => void;
}) => {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const digits = whatsapp.replace(/\D/g, "");
    if (name.trim().length < 2 || digits.length < 10 || !consent) {
      setError("Preencha nome, WhatsApp com DDD e confirme a autorização para continuar.");
      return;
    }
    setError(null);
    onContinue(name.trim());
  };

  return (
    <main className="px-5 pb-16 pt-8 sm:pt-12">
      <div className="mx-auto max-w-4xl">
        <JourneyRail current={1} />
        <button type="button" onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" /> Voltar à prévia
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2.5rem] bg-slate-950 p-7 text-white shadow-2xl shadow-blue-200/30 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
              <Map className="h-6 w-6" />
            </div>
            <p className="mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Mapa preparado</p>
            <h1 className="mt-2 text-3xl font-black leading-tight">Agora vale a troca: contexto por contexto.</h1>
            <p className="mt-4 text-sm font-medium leading-relaxed text-white/55">
              Você informa somente nome e WhatsApp. Em troca, recebe o mapa completo e autoriza que a clínica receba o contexto da sua triagem para não começar a conversa do zero.
            </p>
            <div className="mt-6 space-y-3">
              {["4 aspectos organizados", "1 prioridade clara", "Perguntas para levar à consulta"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Check className="h-4 w-4 text-emerald-300" />
                  <p className="text-xs font-bold text-white/75">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={submit} className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <User className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Último passo antes do mapa</p>
                <h2 className="mt-1 text-2xl font-black">Para quem devemos liberar este resultado?</h2>
              </div>
            </div>

            <label className="mt-7 block">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Nome</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                className="mt-2 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">WhatsApp com DDD</span>
              <input
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                inputMode="numeric"
                placeholder="(31) 99999-9999"
                className="mt-2 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-5 w-5" />
              <span className="text-[11px] font-bold leading-relaxed text-slate-600">
                Autorizo o compartilhamento do meu nome, WhatsApp e contexto da triagem com a Clínica Saúde Integrada BH, que poderá falar comigo sobre avaliação e agendamento.
              </span>
            </label>

            {error && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

            <button type="submit" className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">
              Liberar meu mapa completo <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-[9px] font-medium leading-relaxed text-slate-400">
              Protótipo V5: nenhum dado digitado nesta tela é enviado ou armazenado.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
};

const MapStage = ({
  leadName,
  onContinue,
  onBack,
}: {
  leadName: string;
  onContinue: () => void;
  onBack: () => void;
}) => {
  const [selectedId, setSelectedId] = useState<AreaId>("alignment");
  const selected = useMemo(() => MAP_AREAS.find((area) => area.id === selectedId) ?? MAP_AREAS[0], [selectedId]);
  const SelectedIcon = selected.icon;

  return (
    <main className="overflow-hidden px-5 pb-16 pt-8 sm:pt-12">
      <div className="mx-auto max-w-6xl">
        <JourneyRail current={2} />
        <button type="button" onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="mx-auto mt-6 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">
            <Map className="h-4 w-4" /> leitura completa liberada
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Seu Mapa do Sorriso</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{leadName || "Agora"}, veja o conjunto.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
            O mapa separa prioridade, pontos favoráveis e aspectos complementares. Toque em cada área apenas se quiser aprofundar — o valor principal já está visível.
          </p>
        </div>

        <section className="mx-auto mt-9 grid max-w-5xl gap-3 sm:grid-cols-3">
          <div className="rounded-[1.75rem] bg-slate-950 p-5 text-white">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-300">Prioridade</p>
            <p className="mt-2 text-lg font-black">Alinhamento aparente</p>
            <p className="mt-1 text-[10px] font-medium text-white/45">Principal pauta para avaliação</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">Leitura</p>
            <p className="mt-2 text-lg font-black">4 áreas organizadas</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">Sem transformar sinal em diagnóstico</p>
          </div>
          <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-700">Base favorável</p>
            <p className="mt-2 text-lg font-black">Brilho + harmonia</p>
            <p className="mt-1 text-[10px] font-medium text-emerald-700/60">Aspectos que não precisam virar problema</p>
          </div>
        </section>

        <section className="relative mx-auto mt-6 min-h-[600px] max-w-5xl overflow-hidden rounded-[3rem] border border-slate-200 bg-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.4)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#eff6ff_0%,#ffffff_45%,#f8fafc_100%)]" />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {MAP_AREAS.map((area) => (
              <line
                key={area.id}
                x1="50"
                y1="50"
                x2={area.x}
                y2={area.y}
                stroke={selectedId === area.id ? "#2563eb" : "#cbd5e1"}
                strokeWidth={selectedId === area.id ? "0.8" : "0.35"}
                strokeOpacity={selectedId === area.id ? "0.9" : "0.65"}
              />
            ))}
            <circle cx="50" cy="50" r="25" fill="none" stroke="#dbeafe" strokeWidth="0.25" strokeDasharray="1.5 2.5" />
          </svg>

          <div className="absolute left-1/2 top-1/2 z-10 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[8px] border-white bg-slate-950 text-center text-white shadow-2xl sm:h-44 sm:w-44">
            <Smile className="h-9 w-9 text-blue-300" />
            <p className="mt-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Seu mapa</p>
            <p className="mt-1 text-sm font-black">4 aspectos</p>
          </div>

          {MAP_AREAS.map((area) => {
            const Icon = area.icon;
            const active = selectedId === area.id;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => setSelectedId(area.id)}
                className={`absolute z-20 w-36 -translate-x-1/2 -translate-y-1/2 rounded-[1.6rem] border p-4 text-left transition duration-300 sm:w-44 ${active ? `${area.border} bg-white shadow-2xl shadow-blue-100/70` : "border-slate-200 bg-white/95 shadow-sm hover:border-blue-200 hover:shadow-lg"}`}
                style={{ left: `${area.x}%`, top: `${area.y}%` }}
                aria-pressed={active}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${area.soft} ${area.accent}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900">{area.score}</p>
                    <p className="text-[7px] font-black uppercase tracking-wider text-slate-300">índice visual</p>
                  </div>
                </div>
                <p className="mt-3 text-[8px] font-black uppercase tracking-wider text-slate-400">{area.label}</p>
                <p className="mt-1 text-[11px] font-black leading-tight text-slate-800">{area.status}</p>
              </button>
            );
          })}
        </section>

        <section className="mx-auto mt-6 grid max-w-5xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2.5rem] bg-slate-950 p-7 text-white shadow-xl sm:p-8">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selected.soft} ${selected.accent}`}>
              <SelectedIcon className="h-6 w-6" />
            </div>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">{selected.label}</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">{selected.headline}</h2>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/30">O que percebemos</p>
                <p className="mt-2 text-xs font-medium leading-relaxed text-white/65">{selected.finding}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/30">Por que isso é útil</p>
                <p className="mt-2 text-xs font-medium leading-relaxed text-white/65">{selected.meaning}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[2.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-7 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Compass className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Pergunta para levar</p>
                <h2 className="mt-1 text-2xl font-black">Chegue à consulta com uma pergunta melhor.</h2>
              </div>
            </div>
            <blockquote className="mt-6 rounded-2xl border border-white bg-white p-5 text-base font-black leading-relaxed text-slate-800 shadow-sm">
              “{selected.question}”
            </blockquote>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Resumo do mapa</p>
              <p className="mt-2 text-xs font-bold leading-relaxed text-slate-600">
                Priorize entender alinhamento. Preserve a boa base de brilho e harmonia. Use proporção como pauta complementar, se fizer sentido para seu objetivo.
              </p>
            </div>
          </article>
        </section>

        <section className="mx-auto mt-6 max-w-5xl rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Mapa → conversa</p>
              <h2 className="mt-2 text-2xl font-black">Agora você já sabe o que perguntar.</h2>
              <p className="mt-2 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
                O próximo valor não é outra tela. É levar este contexto para um profissional que possa avaliar causas, prioridades e possibilidades de forma presencial.
              </p>
            </div>
            <button type="button" onClick={onContinue} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">
              Levar meu mapa para a conversa <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};

const ConversationStage = ({
  leadName,
  onBack,
}: {
  leadName: string;
  onBack: () => void;
}) => {
  const [result, setResult] = useState<"whatsapp" | "contact" | null>(null);

  return (
    <main className="px-5 pb-16 pt-8 sm:pt-12">
      <div className="mx-auto max-w-5xl">
        <JourneyRail current={3} />
        <button type="button" onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" /> Voltar ao mapa
        </button>

        <div className="mx-auto mt-6 max-w-3xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Seu próximo passo</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Clareza primeiro. Conversa depois.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
            {leadName || "Você"} já chega com contexto. A clínica recebe o resumo da triagem e pode conduzir a avaliação sem começar do zero.
          </p>
        </div>

        <section className="mx-auto mt-10 grid max-w-4xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/30 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Smile className="h-7 w-7" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Profissional que receberá o contexto</p>
                <h2 className="mt-1 text-2xl font-black">Clínica Saúde Integrada BH</h2>
                <p className="mt-1 text-xs font-medium text-slate-400">Experiência Sorvy Smile · Plano Pro</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-slate-50 p-5">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Contexto que acompanha você</p>
              <div className="mt-4 space-y-3">
                {["Prioridade percebida: alinhamento aparente", "Base favorável: brilho e harmonia", "Pergunta principal pronta para a consulta"].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <p className="text-xs font-bold leading-relaxed text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-[2.5rem] bg-slate-950 p-7 text-white shadow-2xl shadow-blue-200/30 sm:p-8">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Escolha simples</p>
            <h2 className="mt-2 text-3xl font-black leading-tight">Como você prefere seguir?</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-white/55">
              Sem outra etapa de formulário. Você pode iniciar a conversa agora ou pedir que a clínica faça o primeiro contato.
            </p>

            <button type="button" onClick={() => setResult("whatsapp")} className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-emerald-400">
              Quero conversar agora <MessageCircle className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setResult("contact")} className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/10">
              Prefiro receber o contato <ArrowRight className="h-4 w-4" />
            </button>

            {result && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="flex items-center gap-2 text-xs font-black text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {result === "whatsapp" ? "CTA de WhatsApp acionado na demo." : "Pedido de contato registrado na demo."}
                </p>
                <p className="mt-2 text-[10px] font-medium leading-relaxed text-white/45">Nenhuma mensagem ou dado real foi enviado neste protótipo.</p>
              </div>
            )}
          </article>
        </section>

        <p className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-2 text-center text-[10px] font-medium leading-relaxed text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          A Sorvy organiza contexto. Diagnóstico, indicação clínica e tratamento permanecem com o profissional.
        </p>
      </div>
    </main>
  );
};

export const SmileMapV5Demo = () => {
  const [stage, setStage] = useState<V5Stage>("preview");
  const [leadName, setLeadName] = useState("");

  return (
    <Shell>
      {stage === "preview" && <PreviewStage onContinue={() => setStage("identity")} />}
      {stage === "identity" && (
        <IdentityStage
          onBack={() => setStage("preview")}
          onContinue={(name) => {
            setLeadName(name);
            setStage("map");
          }}
        />
      )}
      {stage === "map" && (
        <MapStage
          leadName={leadName}
          onBack={() => setStage("identity")}
          onContinue={() => setStage("conversation")}
        />
      )}
      {stage === "conversation" && (
        <ConversationStage leadName={leadName} onBack={() => setStage("map")} />
      )}
    </Shell>
  );
};
