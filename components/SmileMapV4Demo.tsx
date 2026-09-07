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
  Radar,
  Route,
  ScanLine,
  ShieldCheck,
  Smile,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";

type DemoStage = "discovery" | "map";
type RouteId = "harmony" | "alignment" | "brightness" | "proportion";

type IconType = React.ComponentType<{ className?: string }>;

interface DiscoveryMetric {
  id: RouteId;
  label: string;
  value: number;
  title: string;
  summary: string;
  microcopy: string;
  icon: IconType;
  accent: string;
  ring: string;
  soft: string;
}

interface MapRoute {
  id: RouteId;
  label: string;
  title: string;
  description: string;
  question: string;
  icon: IconType;
  x: number;
  y: number;
  accent: string;
  soft: string;
  status: string;
}

const DISCOVERY_METRICS: DiscoveryMetric[] = [
  {
    id: "harmony",
    label: "Harmonia",
    value: 78,
    title: "Boa base visual",
    summary: "O conjunto mostra equilíbrio geral, com espaço para refinamentos pontuais.",
    microcopy: "Pista aberta",
    icon: Target,
    accent: "text-blue-600",
    ring: "border-blue-500",
    soft: "bg-blue-50",
  },
  {
    id: "alignment",
    label: "Alinhamento",
    value: 71,
    title: "Vale olhar com atenção",
    summary: "Há diferenças de posicionamento que podem ser úteis na conversa com o dentista.",
    microcopy: "Rota sugerida",
    icon: AlignCenter,
    accent: "text-violet-600",
    ring: "border-violet-500",
    soft: "bg-violet-50",
  },
  {
    id: "brightness",
    label: "Brilho",
    value: 82,
    title: "Luminosidade favorável",
    summary: "A percepção de brilho está em uma faixa visual positiva nesta imagem.",
    microcopy: "Ponto favorável",
    icon: Sun,
    accent: "text-amber-600",
    ring: "border-amber-500",
    soft: "bg-amber-50",
  },
  {
    id: "proportion",
    label: "Proporção",
    value: 74,
    title: "Equilíbrio com oportunidade",
    summary: "A proporção do sorriso sugere pontos que podem ser explorados em avaliação presencial.",
    microcopy: "Vale explorar",
    icon: Eye,
    accent: "text-emerald-600",
    ring: "border-emerald-500",
    soft: "bg-emerald-50",
  },
];

const MAP_ROUTES: MapRoute[] = [
  {
    id: "brightness",
    label: "Cor & brilho",
    title: "Entender luminosidade e tonalidade",
    description: "Leve para a consulta perguntas sobre cor percebida, brilho e possibilidades de cuidado supervisionado.",
    question: "O que pode melhorar a percepção de cor sem perder naturalidade?",
    icon: Sun,
    x: 22,
    y: 25,
    accent: "text-amber-600",
    soft: "bg-amber-50",
    status: "Ponto favorável",
  },
  {
    id: "alignment",
    label: "Alinhamento",
    title: "Investigar posicionamento aparente",
    description: "A leitura visual encontrou diferenças que podem justificar uma avaliação mais detalhada de alinhamento.",
    question: "Esse posicionamento precisa de avaliação ortodôntica?",
    icon: AlignCenter,
    x: 78,
    y: 25,
    accent: "text-violet-600",
    soft: "bg-violet-50",
    status: "Prioridade de conversa",
  },
  {
    id: "harmony",
    label: "Harmonia",
    title: "Preservar o que já funciona",
    description: "A base visual é favorável. O objetivo pode ser entender refinamentos sem transformar cuidado em promessa estética.",
    question: "Quais ajustes fariam sentido sem descaracterizar meu sorriso?",
    icon: Target,
    x: 22,
    y: 74,
    accent: "text-blue-600",
    soft: "bg-blue-50",
    status: "Base favorável",
  },
  {
    id: "proportion",
    label: "Proporção",
    title: "Explorar equilíbrio do conjunto",
    description: "Este ponto organiza a conversa sobre proporção, contorno e relação visual entre dentes e sorriso.",
    question: "Existe algum aspecto de proporção que valha investigar presencialmente?",
    icon: Eye,
    x: 78,
    y: 74,
    accent: "text-emerald-600",
    soft: "bg-emerald-50",
    status: "Rota complementar",
  },
];

const JourneyRail = ({ current }: { current: number }) => {
  const steps = [
    ["Sorriso", Smile],
    ["Descoberta", ScanLine],
    ["Mapa", Map],
    ["Conversa", MessageCircle],
  ] as const;

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-2" aria-label="Progresso da experiência">
      {steps.map(([label, Icon], index) => {
        const active = index <= current;
        return (
          <div key={label} className="relative text-center">
            <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border transition-all ${active ? "border-blue-200 bg-blue-600 text-white shadow-lg shadow-blue-100" : "border-slate-200 bg-white text-slate-300"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className={`mt-2 text-[9px] font-black uppercase tracking-wider ${active ? "text-blue-700" : "text-slate-300"}`}>
              {label}
            </p>
            {index < steps.length - 1 && (
              <div className={`absolute left-[64%] top-[17px] h-px w-[72%] ${index < current ? "bg-blue-300" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const DemoShell = ({ children, stage, onStage }: { children: React.ReactNode; stage: DemoStage; onStage: (stage: DemoStage) => void }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf3ff_0%,#f8fbff_34%,#f8fafc_72%)] text-slate-950">
    <header className="sticky top-0 z-50 border-b border-white/80 bg-white/85 px-5 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
            <Smile className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black tracking-tight">Sorvy Smile</p>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-600">V4 · Creative Lab</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => onStage("discovery")}
            className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${stage === "discovery" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400"}`}
          >
            Descoberta
          </button>
          <button
            type="button"
            onClick={() => onStage("map")}
            className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${stage === "map" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400"}`}
          >
            Mapa
          </button>
        </div>
      </div>
    </header>
    {children}
  </div>
);

const MetricCard = ({ metric, index }: { metric: DiscoveryMetric; index: number }) => {
  const Icon = metric.icon;
  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-white bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_-35px_rgba(37,99,235,0.35)]">
      <div className="absolute right-4 top-4 text-[10px] font-black text-slate-200">0{index + 1}</div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${metric.soft} ${metric.accent}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{metric.label}</p>
          <h3 className="mt-1 text-base font-black leading-tight text-slate-900">{metric.title}</h3>
        </div>
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[6px] bg-white ${metric.ring}`}>
          <span className="text-lg font-black">{metric.value}</span>
        </div>
      </div>
      <p className="mt-4 text-xs font-medium leading-relaxed text-slate-500">{metric.summary}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className={`inline-flex rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-wider ${metric.soft} ${metric.accent}`}>
          {metric.microcopy}
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-300 transition group-hover:text-blue-600">
          ver pista <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </article>
  );
};

const DiscoveryView = ({ onUnlock }: { onUnlock: () => void }) => (
  <main className="overflow-hidden">
    <section className="relative px-5 pb-12 pt-8 sm:pt-12">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-200/25 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <JourneyRail current={1} />
        <div className="mx-auto mt-10 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> leitura concluída
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Sua descoberta</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">Seu sorriso começa a formar um mapa.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
            Em vez de entregar um laudo, a Sorvy organiza sinais visuais em pistas simples para você chegar à avaliação com mais clareza e perguntas melhores.
          </p>
        </div>

        <section className="relative mx-auto mt-10 max-w-4xl overflow-hidden rounded-[2.75rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl shadow-blue-200/40 sm:p-8">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative grid items-center gap-8 sm:grid-cols-[0.9fr_1.1fr]">
            <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
              <div className="absolute inset-0 rounded-full border border-blue-400/20" />
              <div className="absolute inset-6 animate-pulse rounded-full border border-blue-300/25" />
              <div className="absolute inset-12 rounded-full border border-blue-300/30" />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-blue-400/40 to-transparent" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
              <div className="absolute inset-[30%] flex items-center justify-center rounded-full bg-blue-600 shadow-[0_0_70px_rgba(37,99,235,0.55)]">
                <Smile className="h-12 w-12" />
              </div>
              <span className="absolute left-[15%] top-[25%] h-3 w-3 animate-pulse rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.8)]" />
              <span className="absolute right-[14%] top-[38%] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.8)]" />
              <span className="absolute bottom-[18%] left-[28%] h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.8)]" />
              <Radar className="absolute h-[82%] w-[82%] text-blue-400/15" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-blue-200">
                <ScanLine className="h-4 w-4" /> sinais organizados
              </div>
              <h2 className="mt-5 text-3xl font-black leading-tight">Quatro pistas foram abertas.</h2>
              <p className="mt-3 text-sm font-medium leading-relaxed text-white/60">
                O objetivo não é rotular seu sorriso. É transformar a leitura em um caminho visual, compreensível e útil para a conversa presencial.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {DISCOVERY_METRICS.map((metric) => (
                  <div key={metric.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[8px] font-black uppercase tracking-wider text-white/40">{metric.label}</p>
                    <p className="mt-1 text-xl font-black text-white">{metric.value}<span className="text-xs text-white/30">/100</span></p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DISCOVERY_METRICS.map((metric, index) => (
            <MetricCard key={metric.id} metric={metric} index={index} />
          ))}
        </div>

        <section className="relative mx-auto mt-8 max-w-4xl overflow-hidden rounded-[2.5rem] border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-white p-6 shadow-sm sm:p-8">
          <div className="absolute left-10 right-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
          <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Compass className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Próxima descoberta</p>
                <h2 className="mt-1 text-2xl font-black">Transformar pistas em rotas.</h2>
                <p className="mt-2 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
                  O mapa conecta o que foi percebido a perguntas e possibilidades para levar à avaliação — sem substituir o dentista e sem prometer resultado.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onUnlock}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              Desbloquear mapa <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <p className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-2 text-center text-[10px] font-medium leading-relaxed text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          Experiência informativa. Não é diagnóstico, prescrição ou garantia de tratamento.
        </p>
      </div>
    </section>
  </main>
);

const MapView = ({ onBack }: { onBack: () => void }) => {
  const [selectedId, setSelectedId] = useState<RouteId>("alignment");
  const selected = useMemo(
    () => MAP_ROUTES.find((route) => route.id === selectedId) ?? MAP_ROUTES[0],
    [selectedId],
  );
  const SelectedIcon = selected.icon;

  return (
    <main className="overflow-hidden px-5 pb-16 pt-8 sm:pt-12">
      <div className="mx-auto max-w-6xl">
        <JourneyRail current={2} />
        <button
          type="button"
          onClick={onBack}
          className="mt-8 inline-flex items-center gap-2 text-xs font-black text-slate-500 transition hover:text-blue-600"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar à descoberta
        </button>

        <div className="mx-auto mt-6 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-200">
            <Check className="h-4 w-4" /> mapa desbloqueado
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Seu Mapa do Sorriso</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Agora as pistas têm direção.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
            Toque em uma rota para entender por que ela apareceu e qual pergunta pode tornar sua avaliação mais objetiva.
          </p>
        </div>

        <section className="relative mx-auto mt-10 min-h-[570px] max-w-5xl overflow-hidden rounded-[3rem] border border-slate-200 bg-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#eff6ff_0%,#ffffff_42%,#f8fafc_100%)]" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-blue-50/80 to-transparent" />

          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="mapLine" x1="0" x2="1">
                <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.25" />
                <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            {MAP_ROUTES.map((route) => (
              <line
                key={route.id}
                x1="50"
                y1="50"
                x2={route.x}
                y2={route.y}
                stroke="url(#mapLine)"
                strokeWidth={selectedId === route.id ? "1.1" : "0.55"}
                strokeDasharray={selectedId === route.id ? "0" : "2 2"}
              />
            ))}
            <circle cx="50" cy="50" r="22" fill="none" stroke="#dbeafe" strokeWidth="0.35" strokeDasharray="2 2" />
            <circle cx="50" cy="50" r="34" fill="none" stroke="#e2e8f0" strokeWidth="0.25" strokeDasharray="1 3" />
          </svg>

          <div className="absolute left-1/2 top-1/2 z-10 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[8px] border-white bg-slate-950 text-center text-white shadow-2xl shadow-blue-200 sm:h-40 sm:w-40">
            <Smile className="h-8 w-8 text-blue-300" />
            <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-white/40">centro</p>
            <p className="mt-1 text-sm font-black">Seu sorriso</p>
          </div>

          {MAP_ROUTES.map((route, index) => {
            const Icon = route.icon;
            const active = selectedId === route.id;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => setSelectedId(route.id)}
                className={`absolute z-20 w-28 -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border p-3 text-left transition duration-300 sm:w-36 ${active ? "scale-105 border-blue-300 bg-white shadow-xl shadow-blue-100" : "border-slate-200 bg-white/95 shadow-sm hover:-translate-y-[54%] hover:border-blue-200"}`}
                style={{ left: `${route.x}%`, top: `${route.y}%` }}
                aria-pressed={active}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${route.soft} ${route.accent}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[8px] font-black text-slate-300">0{index + 1}</span>
                </div>
                <p className="mt-3 text-[8px] font-black uppercase tracking-wider text-slate-400">{route.label}</p>
                <p className="mt-1 text-[11px] font-black leading-tight text-slate-800">{route.status}</p>
                {active && <span className="mt-2 inline-flex h-1.5 w-full rounded-full bg-blue-500" />}
              </button>
            );
          })}

          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white bg-white/90 px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-400 shadow-sm backdrop-blur">
            <Route className="h-3.5 w-3.5 text-blue-500" /> toque nas rotas
          </div>
        </section>

        <section className="mx-auto mt-6 grid max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2.5rem] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${selected.soft} ${selected.accent}`}>
              <SelectedIcon className="h-6 w-6" />
            </div>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Rota selecionada · {selected.label}</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">{selected.title}</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-white/55">{selected.description}</p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Pergunta para levar</p>
              <p className="mt-2 text-sm font-black leading-relaxed text-white">“{selected.question}”</p>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Compass className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Mapa → conversa</p>
                <h2 className="mt-1 text-2xl font-black">Você não precisa chegar à consulta do zero.</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[
                "Você já sabe quais pontos chamaram atenção na leitura visual.",
                "Você leva perguntas, não conclusões clínicas.",
                "O dentista continua sendo quem avalia causas, prioridades e possibilidades.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs font-bold leading-relaxed text-slate-600">{item}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
            >
              Levar meu mapa para a conversa <MessageCircle className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-[9px] font-medium leading-relaxed text-slate-400">
              CTA demonstrativo da V4. Nenhum contato é enviado nesta rota de demo.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-6 max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Limite clínico preservado</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                Este mapa organiza percepções visuais e perguntas. Não diagnostica, não prescreve tratamento e não substitui avaliação odontológica.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export const SmileMapV4Demo = () => {
  const [stage, setStage] = useState<DemoStage>("discovery");

  return (
    <DemoShell stage={stage} onStage={setStage}>
      {stage === "discovery" ? (
        <DiscoveryView onUnlock={() => setStage("map")} />
      ) : (
        <MapView onBack={() => setStage("discovery")} />
      )}
    </DemoShell>
  );
};
