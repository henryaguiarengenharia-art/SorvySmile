import React, { useEffect, useState } from "react";
import { Bot, CircleDollarSign, LoaderCircle, MessageSquareText, ShieldAlert, ThumbsUp } from "lucide-react";
import { AssistantAdminOverview } from "../types";
import { getAssistantAdminOverview } from "../services/sorvyApi";

export const AssistantHqOverview: React.FC = () => {
  const [data, setData] = useState<AssistantAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAssistantAdminOverview()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((loadError: Error) => { if (!cancelled) setError(loadError.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#123B5D] p-6 text-white">
        <div className="flex items-center gap-3"><span className="rounded-2xl bg-[#18AFA5] p-3"><Bot className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Governança de IA</p><h2 className="text-xl font-black">Uso das assistentes</h2></div></div>
        <p className="text-xs font-bold text-blue-100">Somente métricas; nenhum conteúdo sensível é exibido.</p>
      </header>
      {!data && !error && <div className="flex items-center gap-2 p-6 text-sm font-bold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Carregando indicadores...</div>}
      {error && <p className="m-6 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {data && <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={<Bot />} label="Contas ativas no uso" value={String(data.accountsUsed)} />
        <Metric icon={<MessageSquareText />} label="Interações no mês" value={String(data.interactions)} />
        <Metric icon={<ThumbsUp />} label="Feedback positivo" value={String(data.positiveFeedback)} />
        <Metric icon={<ShieldAlert />} label="Bloqueios / erros" value={`${data.blocked} / ${data.errors}`} />
        <Metric icon={<MessageSquareText />} label="Ações confirmadas" value={`${data.actionsConfirmed} / ${data.actionsProposed}`} />
        <Metric icon={<CircleDollarSign />} label="Custo estimado" value={data.estimatedCost.toLocaleString("pt-BR", { style: "currency", currency: "USD" })} />
      </div>}
    </section>
  );
};

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => <div className="rounded-2xl bg-slate-50 p-4"><span className="block text-blue-600 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
