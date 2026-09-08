import React, { useMemo, useState } from "react";
import {
  AlignCenter,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Eye,
  MessageCircle,
  ShieldCheck,
  Smile,
  Sparkles,
  Sun,
  Target,
  User,
} from "lucide-react";

type Stage = "signal" | "identity" | "focus" | "action";
type FocusId = "alignment" | "brightness" | "harmony" | "proportion";
type IconType = React.ComponentType<{ className?: string }>;

interface FocusArea {
  id: FocusId;
  label: string;
  score: number;
  signal: "principal" | "oportunidade" | "manutencao";
  headline: string;
  summary: string;
  action: string;
  question: string;
  icon: IconType;
  accent: string;
  soft: string;
}

const AREAS: FocusArea[] = [
  {
    id: "alignment",
    label: "Alinhamento aparente",
    score: 71,
    signal: "principal",
    headline: "É o ponto que mais merece ser entendido presencialmente.",
    summary: "Diferenças de posicionamento foram o sinal visual que mais se destacou nesta imagem.",
    action: "Validar se é apenas uma característica visual ou se existe oportunidade ortodôntica.",
    question: "Esse alinhamento merece avaliação ortodôntica no meu caso?",
    icon: AlignCenter,
    accent: "text-violet-700",
    soft: "bg-violet-50",
  },
  {
    id: "brightness",
    label: "Cor & brilho",
    score: 82,
    signal: "oportunidade",
    headline: "Boa leitura visual não significa que não exista algo a melhorar.",
    summary: "A luminosidade aparece melhor posicionada que o alinhamento, mas ainda pode ser discutida se seu objetivo for refinar cor e acabamento.",
    action: "Entender se manutenção, limpeza profissional ou clareamento supervisionado fazem sentido.",
    question: "O que eu poderia melhorar sem perder naturalidade?",
    icon: Sun,
    accent: "text-amber-700",
    soft: "bg-amber-50",
  },
  {
    id: "harmony",
    label: "Harmonia",
    score: 78,
    signal: "manutencao",
    headline: "O que está bem também precisa ser protegido.",
    summary: "A harmonia geral é melhor que o principal sinal identificado, mas isso não substitui revisão ou manutenção preventiva.",
    action: "Confirmar se a boa base visual corresponde a uma condição bucal saudável e bem mantida.",
    question: "O que preciso fazer para preservar esta boa base ao longo do tempo?",
    icon: Target,
    accent: "text-blue-700",
    soft: "bg-blue-50",
  },
  {
    id: "proportion",
    label: "Proporção",
    score: 74,
    signal: "oportunidade",
    headline: "Pode existir espaço para refinamento, mas a foto não define a causa.",
    summary: "A proporção aparece em uma faixa intermediária e merece ser interpretada junto com seu objetivo e avaliação presencial.",
    action: "Levar este ponto para uma conversa estética mais objetiva.",
    question: "Há algo de proporção que realmente valha tratar no meu sorriso?",
    icon: Eye,
    accent: "text-emerald-700",
    soft: "bg-emerald-50",
  },
];

const JOURNEY = [["Sorriso", Smile], ["Primeiro sinal", Sparkles], ["Em foco", Eye], ["Ação", MessageCircle]] as const;

const JourneyRail = ({ current }: { current: number }) => (
  <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-2">
    {JOURNEY.map(([label, Icon], index) => {
      const active = index <= current;
      return (
        <div key={label} className="relative text-center">
          <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-300"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className={`mt-2 text-[9px] font-black uppercase tracking-[0.14em] ${active ? "text-slate-800" : "text-slate-300"}`}>{label}</p>
          {index < JOURNEY.length - 1 && <div className={`absolute left-[64%] top-[18px] h-px w-[72%] ${index < current ? "bg-slate-900" : "bg-slate-200"}`} />}
        </div>
      );
    })}
  </div>
);

const Header = () => (
  <header className="border-b border-slate-100 bg-white/90 px-5 py-3 backdrop-blur-xl">
    <div className="mx-auto flex max-w-6xl items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100"><Smile className="h-5 w-5" /></span>
        <div>
          <p className="text-sm font-black">Sorvy Smile</p>
          <p className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-400">V6 · Focus Lab</p>
        </div>
      </div>
      <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-blue-700">demo isolada</span>
    </div>
  </header>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff_0%,#f8fafc_42%,#ffffff_82%)] text-slate-950"><Header />{children}</div>
);

const SignalStage = ({ onContinue }: { onContinue: () => void }) => (
  <main className="px-5 pb-16 pt-8 sm:pt-12">
    <div className="mx-auto max-w-5xl">
      <JourneyRail current={1} />
      <div className="mx-auto mt-10 max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700"><CheckCircle2 className="h-4 w-4" /> leitura concluída</div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Primeiro sinal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Seu alinhamento foi o ponto que mais chamou atenção.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">Isso não fecha um diagnóstico. Mas já cria uma pergunta concreta que vale levar para uma avaliação.</p>
      </div>

      <section className="mx-auto mt-10 grid max-w-4xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[2.75rem] bg-slate-950 p-7 text-white shadow-2xl shadow-blue-200/40 sm:p-9">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-300">Sinal principal</p>
          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-black">71<span className="text-xl text-white/30">/100</span></p>
              <p className="mt-2 text-xs font-black uppercase tracking-wider text-white/45">índice visual de alinhamento</p>
            </div>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><AlignCenter className="h-7 w-7" /></span>
          </div>
          <div className="mt-7 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[71%] rounded-full bg-violet-400" /></div>
          <h2 className="mt-7 text-3xl font-black leading-tight">Há algo para entender melhor antes de concluir que está tudo bem.</h2>
          <p className="mt-4 text-sm font-medium leading-relaxed text-white/60">A leitura encontrou diferenças visuais de posicionamento. A causa e a relevância clínica só podem ser definidas presencialmente.</p>
        </article>

        <article className="rounded-[2.75rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40 sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><ShieldCheck className="h-6 w-6" /></div>
          <p className="mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Curiosidade baseada em evidência</p>
          <h2 className="mt-2 text-2xl font-black">Você não precisa estar com dor para existir algo a avaliar.</h2>
          <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500">Cárie inicial normalmente não apresenta sintomas, e doença gengival pode se tornar séria antes de a pessoa perceber sinais claros. Por isso revisão e prevenção continuam relevantes mesmo sem dor.</p>
          <p className="mt-4 text-[9px] font-black uppercase tracking-wider text-slate-300">Fontes educacionais: NIDCR + CDC</p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Ainda não mostramos</p>
            <p className="mt-2 text-sm font-black text-slate-800">Como brilho, harmonia e proporção se comparam ao seu principal sinal — e o que isso pode significar em tempo de evolução.</p>
          </div>
        </article>
      </section>

      <section className="mx-auto mt-6 max-w-4xl rounded-[2.5rem] border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-white p-6 sm:p-8">
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Próxima revelação</p>
            <h2 className="mt-2 text-2xl font-black">Veja seu sorriso em foco — com comparação, prioridade e horizonte de mudança.</h2>
          </div>
          <button type="button" onClick={onContinue} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-xl hover:bg-blue-700">Ver meu sorriso em foco <ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>
    </div>
  </main>
);

const IdentityStage = ({ onBack, onContinue }: { onBack: () => void; onContinue: (name: string) => void }) => {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2 || whatsapp.replace(/\D/g, "").length < 10 || !consent) {
      setError("Preencha nome, WhatsApp com DDD e confirme a autorização.");
      return;
    }
    setError(null);
    onContinue(name.trim());
  };
  return (
    <main className="px-5 pb-16 pt-8 sm:pt-12"><div className="mx-auto max-w-4xl"><JourneyRail current={1} />
      <button type="button" onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-xs font-black text-slate-500"><ChevronLeft className="h-4 w-4" /> Voltar</button>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2.5rem] bg-slate-950 p-7 text-white sm:p-8">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">O que você libera</p>
          <h1 className="mt-2 text-3xl font-black">Comparação completa + horizonte de mudança.</h1>
          <div className="mt-6 space-y-3">{["4 índices visuais comparados", "Prioridade clara para conversar", "Tempo de referência: rápido, semanas ou meses", "Contexto enviado para a clínica"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><Check className="h-4 w-4 text-emerald-300" /><p className="text-xs font-bold text-white/75">{item}</p></div>)}</div>
        </section>
        <form onSubmit={submit} className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-xl sm:p-8">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><User className="h-6 w-6" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Troca transparente</p><h2 className="mt-1 text-2xl font-black">Seu mapa de ação está pronto.</h2></div></div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="mt-7 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500" />
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp com DDD" inputMode="numeric" className="mt-3 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500" />
          <label className="mt-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5" /><span className="text-[11px] font-bold leading-relaxed text-slate-600">Autorizo o compartilhamento do meu nome, WhatsApp e contexto da triagem com a Clínica Saúde Integrada BH.</span></label>
          {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
          <button type="submit" className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white">Liberar análise completa <ArrowRight className="h-4 w-4" /></button>
          <p className="mt-3 text-center text-[9px] text-slate-400">Demo: nada digitado aqui é enviado ou armazenado.</p>
        </form>
      </div>
    </div></main>
  );
};

const FocusStage = ({ leadName, onBack, onContinue }: { leadName: string; onBack: () => void; onContinue: () => void }) => {
  const [selectedId, setSelectedId] = useState<FocusId>("alignment");
  const selected = useMemo(() => AREAS.find((area) => area.id === selectedId) ?? AREAS[0], [selectedId]);
  const SelectedIcon = selected.icon;
  return (
    <main className="px-5 pb-16 pt-8 sm:pt-12"><div className="mx-auto max-w-6xl"><JourneyRail current={2} />
      <button type="button" onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-xs font-black text-slate-500"><ChevronLeft className="h-4 w-4" /> Voltar</button>
      <div className="mx-auto mt-6 max-w-3xl text-center"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Seu sorriso em foco</p><h1 className="mt-3 text-4xl font-black sm:text-6xl">{leadName || "Agora"}, números ajudam a comparar. A ação vem da leitura do conjunto.</h1><p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">Os índices são visuais e comparativos — não diagnósticos. Eles mostram onde existe mais contraste e onde vale levar a conversa adiante.</p></div>

      <section className="mx-auto mt-9 max-w-5xl rounded-[2.75rem] bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-300">Comparação visual</p><h2 className="mt-2 text-3xl font-black">O alinhamento fica abaixo dos outros sinais.</h2><p className="mt-3 text-sm font-medium leading-relaxed text-white/55">Isso cria prioridade. Não porque 71 seja um diagnóstico, mas porque ele se distancia do melhor índice da leitura.</p></div>
          <div className="space-y-4">{AREAS.map((area) => <button key={area.id} type="button" onClick={() => setSelectedId(area.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === area.id ? "border-blue-300 bg-white/10" : "border-white/10 bg-white/5"}`}><div className="flex items-center justify-between gap-4"><span className="text-xs font-black">{area.label}</span><span className="text-lg font-black">{area.score}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${selectedId === area.id ? "bg-blue-400" : "bg-white/35"}`} style={{ width: `${area.score}%` }} /></div></button>)}</div>
        </div>
      </section>

      <section className="mx-auto mt-6 grid max-w-5xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-8"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selected.soft} ${selected.accent}`}><SelectedIcon className="h-6 w-6" /></div><p className="mt-5 text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">{selected.label}</p><h2 className="mt-2 text-2xl font-black">{selected.headline}</h2><p className="mt-3 text-xs font-medium leading-relaxed text-slate-500">{selected.summary}</p><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Ação sugerida para conversar</p><p className="mt-2 text-sm font-black text-slate-700">{selected.action}</p></div></article>

        <article className="rounded-[2.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-7 sm:p-8"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white"><Clock3 className="h-6 w-6" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Tempo para perceber mudança</p><h2 className="mt-1 text-2xl font-black">Nem toda melhoria exige o mesmo horizonte.</h2></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white bg-white p-4 shadow-sm"><p className="text-[8px] font-black uppercase tracking-wider text-emerald-600">Rápido</p><p className="mt-2 text-sm font-black">1 consulta</p><p className="mt-1 text-[10px] font-medium text-slate-400">Ex.: limpeza/manutenção, quando indicada.</p></div><div className="rounded-2xl border border-white bg-white p-4 shadow-sm"><p className="text-[8px] font-black uppercase tracking-wider text-amber-600">Semanas</p><p className="mt-2 text-sm font-black">~2–6 semanas</p><p className="mt-1 text-[10px] font-medium text-slate-400">Ex.: clareamento domiciliar supervisionado.</p></div><div className="rounded-2xl border border-white bg-white p-4 shadow-sm"><p className="text-[8px] font-black uppercase tracking-wider text-violet-600">Meses</p><p className="mt-2 text-sm font-black">~6–30 meses</p><p className="mt-1 text-[10px] font-medium text-slate-400">Ex.: tratamento ortodôntico, conforme complexidade.</p></div></div><p className="mt-4 text-[9px] font-medium leading-relaxed text-slate-400">Referências gerais de duração, não estimativa individual. Clareamento: NHS. Ortodontia: NHS. Limpeza/manutenção depende da indicação clínica.</p></article>
      </section>

      <section className="mx-auto mt-6 max-w-5xl rounded-[2.5rem] border border-amber-200 bg-amber-50 p-6 sm:p-8"><div className="grid gap-6 sm:grid-cols-[1fr_auto]"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-700">Por que agir mesmo sem dor?</p><h2 className="mt-2 text-2xl font-black">Dor não é um bom marcador para decidir quando cuidar.</h2><p className="mt-2 max-w-2xl text-xs font-medium leading-relaxed text-slate-600">Cárie em estágio inicial normalmente não causa sintomas. Doença gengival também pode se tornar séria antes de a pessoa perceber. Revisão profissional existe justamente para identificar o que uma foto e a ausência de dor não conseguem confirmar.</p><p className="mt-3 text-[9px] font-black uppercase tracking-wider text-amber-700/60">Evidência educacional: NIDCR + CDC</p></div><button type="button" onClick={onContinue} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white">Quero avaliar isso agora <ArrowRight className="h-4 w-4" /></button></div></section>
    </div></main>
  );
};

const ActionStage = ({ leadName, onBack }: { leadName: string; onBack: () => void }) => {
  const [result, setResult] = useState<"chat" | "contact" | null>(null);
  return (
    <main className="px-5 pb-16 pt-8 sm:pt-12"><div className="mx-auto max-w-5xl"><JourneyRail current={3} /><button type="button" onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-xs font-black text-slate-500"><ChevronLeft className="h-4 w-4" /> Voltar</button>
      <div className="mx-auto mt-6 max-w-3xl text-center"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Próximo passo</p><h1 className="mt-3 text-4xl font-black sm:text-6xl">Você já sabe onde olhar. Agora descubra o que realmente faz sentido fazer.</h1><p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{leadName || "Você"} chega à conversa com prioridade, comparação e expectativa de tempo mais clara.</p></div>
      <section className="mx-auto mt-10 grid max-w-4xl gap-5 lg:grid-cols-[0.9fr_1.1fr]"><article className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-8"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Clínica Saúde Integrada BH</p><h2 className="mt-2 text-2xl font-black">O contexto que a clínica recebe</h2><div className="mt-5 space-y-3">{["Alinhamento como principal ponto de atenção", "Comparação dos quatro índices visuais", "Interesse em entender opções e tempo de evolução"].map((item) => <div key={item} className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-emerald-500" /><p className="text-xs font-bold text-slate-600">{item}</p></div>)}</div></article><article className="rounded-[2.5rem] bg-slate-950 p-7 text-white sm:p-8"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">Ação imediata</p><h2 className="mt-2 text-3xl font-black">Não deixe essa dúvida esfriar.</h2><p className="mt-3 text-sm font-medium leading-relaxed text-white/55">Você já fez a triagem e já tem contexto. O próximo passo é usar isso em uma avaliação profissional.</p><button type="button" onClick={() => setResult("chat")} className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950">Quero falar com a clínica agora <MessageCircle className="h-4 w-4" /></button><button type="button" onClick={() => setResult("contact")} className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white">Prefiro receber o contato <ArrowRight className="h-4 w-4" /></button>{result && <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-black text-emerald-300">{result === "chat" ? "CTA de conversa acionado na demo." : "Pedido de contato registrado na demo."}</p>}</article></section>
      <p className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-2 text-center text-[10px] font-medium text-slate-400"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Índices visuais e horizontes de tempo são informativos. Diagnóstico e indicação clínica permanecem com o dentista.</p>
    </div></main>
  );
};

export const SmileFocusV6Demo = () => {
  const [stage, setStage] = useState<Stage>("signal");
  const [leadName, setLeadName] = useState("");
  return <Shell>{stage === "signal" && <SignalStage onContinue={() => setStage("identity")} />}{stage === "identity" && <IdentityStage onBack={() => setStage("signal")} onContinue={(name) => { setLeadName(name); setStage("focus"); }} />}{stage === "focus" && <FocusStage leadName={leadName} onBack={() => setStage("identity")} onContinue={() => setStage("action")} />}{stage === "action" && <ActionStage leadName={leadName} onBack={() => setStage("focus")} />}</Shell>;
};
