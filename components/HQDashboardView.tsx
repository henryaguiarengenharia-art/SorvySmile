import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Archive,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Edit3,
  Eye,
  LoaderCircle,
  MessageCircle,
  Search,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  PlayCircle,
  UserRoundCheck,
  X,
} from "lucide-react";
import {
  AccountStatus,
  AdminAuditLog,
  BillingAccount,
  DentistRecord,
  DailyPost,
  DailyPostStatus,
  LeadRecord,
  PlanConfig,
  PlanTier,
  SubscriptionHistoryEvent,
} from "../types";
import { planName } from "../planCatalog";
import { DailyPostManager } from "./DailyPostManager";
import { PeriodFilter } from "./PeriodFilter";
import { filterLeadsByPeriod, MetricPeriod } from "../services/metrics";

interface HQDashboardViewProps {
  leadRecords: LeadRecord[];
  billingAccounts: Record<string, BillingAccount>;
  usageByAccount: Record<string, Record<string, number>>;
  planConfigs: Record<PlanTier, PlanConfig>;
  onUpdateBilling: (
    id: string,
    status: "active" | "overdue" | "paused",
    plan?: PlanTier,
  ) => Promise<void>;
  onOpenWhatsApp: (number: string, message: string) => void;
  professionals: DentistRecord[];
  onStartTrial: (accountId: string, professionalId: string) => Promise<void>;
  onUpdateProfessional: (
    accountId: string,
    professionalId: string,
    patch: Partial<DentistRecord>,
  ) => Promise<void>;
  onArchiveProfessional: (
    accountId: string,
    professionalId: string,
    reason: string,
  ) => Promise<void>;
  onRestoreProfessional: (
    accountId: string,
    professionalId: string,
  ) => Promise<void>;
  onViewProfessionalDashboard: (professionalId: string) => void;
  dailyPosts: DailyPost[];
  adminAuditLogs: AdminAuditLog[];
  subscriptionHistory: SubscriptionHistoryEvent[];
  onManageDailyPost: (input: { postId?: string; title: string; caption: string; cta: string; imageUrl?: string; status: DailyPostStatus; publishAtMs?: number | null; expiresAtMs?: number | null }) => Promise<unknown>;
}

const statusCopy: Record<
  AccountStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Ativa",
    className: "bg-emerald-50 text-emerald-700",
  },
  pending: {
    label: "Aguardando pagamento",
    className: "bg-blue-50 text-blue-700",
  },
  overdue: {
    label: "Inadimplente",
    className: "bg-amber-50 text-amber-700",
  },
  paused: {
    label: "Pausada",
    className: "bg-slate-100 text-slate-600",
  },
};

export const HQDashboardView: React.FC<HQDashboardViewProps> = ({
  leadRecords,
  billingAccounts,
  usageByAccount,
  planConfigs,
  onUpdateBilling,
  onOpenWhatsApp,
  professionals,
  onStartTrial,
  onUpdateProfessional,
  onArchiveProfessional,
  onRestoreProfessional,
  onViewProfessionalDashboard,
  dailyPosts,
  adminAuditLogs,
  subscriptionHistory,
  onManageDailyPost,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">(
    "all",
  );
  const [selected, setSelected] = useState<BillingAccount | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>("pro");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<DentistRecord | null>(null);
  const [managedProfessional, setManagedProfessional] = useState<DentistRecord | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const [professionalSpecialty, setProfessionalSpecialty] = useState("");
  const [metricPeriod, setMetricPeriod] = useState<MetricPeriod>(30);

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
  }, []);
  const metricLeads = useMemo(
    () => filterLeadsByPeriod(leadRecords, metricPeriod),
    [leadRecords, metricPeriod],
  );

  const stats = useMemo(() => {
    const all = Object.values(billingAccounts);
    const subscribers = all.filter((account) =>
      account.status === "active"
      && account.subscriptionStatus !== "trial"
      && account.trialStatus !== "active"
    );
    const trials = all.filter((account) =>
      account.subscriptionStatus === "trial" || account.trialStatus === "active"
    );
    const terminal = metricLeads.filter(
      (lead) => lead.status === "closed" || lead.status === "lost",
    );
    const converted = terminal.filter((lead) => lead.status === "closed").length;
    const atRisk = all.filter((account) =>
      account.status === "overdue"
      || account.status === "paused"
      || account.riskLevel === "critical"
    );
    return {
      subscribers: subscribers.length,
      trials: trials.length,
      pending: all.filter((account) => account.status === "pending").length,
      atRisk: atRisk.length,
      mrr: subscribers.reduce(
        (sum, account) => sum + planConfigs[account.tier].price,
        0,
      ),
      arr: subscribers.reduce(
        (sum, account) => sum + planConfigs[account.tier].price * 12,
        0,
      ),
      conversion: terminal.length > 0 ? Math.round((converted / terminal.length) * 100) : 0,
      periodLeads: metricLeads.length,
      monthLeads: leadRecords.filter((lead) => {
        const created = new Date(lead.createdAt);
        return (
          created.getUTCFullYear() === new Date().getUTCFullYear()
          && created.getUTCMonth() === new Date().getUTCMonth()
        );
      }).length,
    };
  }, [billingAccounts, leadRecords, metricLeads, planConfigs]);

  const alerts = useMemo<Array<{ account: BillingAccount; tone: "critical" | "attention"; text: string }>>(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const result: Array<{ account: BillingAccount; tone: "critical" | "attention"; text: string }> = [];
    Object.values(billingAccounts).forEach((account) => {
      const name = account.accountName || account.checkoutName || "Conta sem nome";
      if (account.status === "overdue") result.push({ account, tone: "critical", text: `${name}: pagamento pendente` });
      else if (account.status === "pending") result.push({ account, tone: "attention", text: `${name}: aguardando ativação` });
      if (account.status === "active" && account.renewAt > now && account.renewAt <= now + sevenDays) {
        result.push({ account, tone: "attention", text: `${name}: renovação em ${new Date(account.renewAt).toLocaleDateString("pt-BR")}` });
      }
    });
    return result.slice(0, 6);
  }, [billingAccounts]);

  const visibleProfessionals = useMemo(() => professionals.filter((professional) => {
    const account = billingAccounts[professional.billingAccountId];
    const term = search.trim().toLowerCase();
    const matchesSearch = !term
      || professional.name.toLowerCase().includes(term)
      || (professional.email ?? "").toLowerCase().includes(term)
      || professional.whatsapp.includes(term)
      || professional.id.toLowerCase().includes(term);
    return matchesSearch && (statusFilter === "all" || account?.status === statusFilter);
  }), [billingAccounts, professionals, search, statusFilter]);

  const openActivation = (account: BillingAccount): void => {
    setSelected(account);
    setSelectedPlan(account.requestedPlan ?? account.tier);
    setNotice(null);
  };

  const changeStatus = async (
    account: BillingAccount,
    status: "active" | "overdue" | "paused",
    plan?: PlanTier,
  ): Promise<void> => {
    setBusyId(account.id);
    setNotice(null);
    try {
      await onUpdateBilling(account.id, status, plan);
      setSelected(null);
      setNotice(
        status === "active"
          ? "Conta ativada. O link profissional já pode ser usado."
          : status === "paused"
            ? "Conta pausada e link público desativado."
            : "Conta marcada como inadimplente.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível atualizar.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const contactAccount = (account: BillingAccount): void => {
    const name = account.accountName || account.checkoutName || "profissional";
    const plan = planName(account.requestedPlan ?? account.tier);
    const message =
      account.status === "pending"
        ? `Olá ${name}! Sua contratação do plano ${plan} da Sorvy Smile ainda aparece como pendente. Posso ajudar a concluir o checkout?`
        : account.status === "overdue"
          ? `Olá ${name}! Identificamos uma pendência na renovação do plano ${plan} da Sorvy Smile. Posso ajudar?`
          : `Olá ${name}! Tudo bem? Gostaria de saber como está sua experiência com a Sorvy Smile.`;
    onOpenWhatsApp(account.checkoutWhatsapp ?? "", message);
  };

  const editProfessional = (professional: DentistRecord): void => {
    setSelectedProfessional(professional);
    setProfessionalName(professional.name);
    setProfessionalSpecialty(professional.specialty ?? "");
    setNotice(null);
  };

  const saveProfessional = async (): Promise<void> => {
    if (!selectedProfessional) return;
    setBusyId(selectedProfessional.id);
    try {
      await onUpdateProfessional(
        selectedProfessional.billingAccountId,
        selectedProfessional.id,
        { name: professionalName.trim(), specialty: professionalSpecialty.trim() },
      );
      setNotice("Cadastro do profissional atualizado.");
      setSelectedProfessional(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
      <header>
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
          Administração Sorvy
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">
          Operação Sorvy Smile
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Visão executiva de clientes, receita, conversão, risco e operação.
        </p>
      </header>

      {notice && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Período da performance</p>
          <p className="mt-1 text-sm font-bold text-slate-600">{stats.periodLeads} no período · {leadRecords.length} no geral</p>
        </div>
        <PeriodFilter value={metricPeriod} onChange={setMetricPeriod} />
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Kpi
          icon={<UserRoundCheck className="h-5 w-5" />}
          label="Assinantes"
          value={String(stats.subscribers)}
        />
        <Kpi
          icon={<PlayCircle className="h-5 w-5" />}
          label="Trials ativos"
          value={String(stats.trials)}
        />
        <Kpi
          icon={<ShieldCheck className="h-5 w-5" />}
          label="MRR pago"
          value={stats.mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
        />
        <Kpi
          icon={<TrendingUp className="h-5 w-5" />}
          label="Receita anual"
          value={stats.arr.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
        />
        <Kpi
          icon={<BarChart3 className="h-5 w-5" />}
          label="Conversão no período"
          value={`${stats.conversion}%`}
        />
        <Kpi
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Contas em risco"
          value={String(stats.atRisk)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Ações urgentes</p><h2 className="mt-1 text-xl font-black">Prioridades da operação</h2></div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{alerts.length}</span>
          </div>
          <div className="mt-5 space-y-2">
            {alerts.length === 0 && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">Nenhuma ação urgente no momento.</p>}
            {alerts.map(({ account, tone, text }) => (
              <button key={`${account.id}-${text}`} onClick={() => openActivation(account)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left text-sm font-bold ${tone === "critical" ? "border-rose-100 bg-rose-50 text-rose-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
                <span>{text}</span><ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </article>
        <article className="rounded-[2rem] bg-slate-950 p-6 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Pulso do mês</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div><p className="text-4xl font-black">{stats.monthLeads}</p><p className="mt-1 text-xs font-bold text-slate-300">leads no mês</p></div>
            <div><p className="text-4xl font-black">{leadRecords.length}</p><p className="mt-1 text-xs font-bold text-slate-300">leads gerais</p></div>
          </div>
          <div className="mt-6 border-t border-white/10 pt-4"><p className="text-2xl font-black">{stats.pending}</p><p className="text-xs font-bold text-slate-400">pagamentos aguardando conferência</p></div>
        </article>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white">
        <header className="grid gap-4 border-b border-slate-100 bg-slate-50 p-6 md:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar profissional, email, WhatsApp ou ID"
              className="w-full bg-transparent py-3 text-sm font-bold outline-none"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as AccountStatus | "all")
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            <option value="all">Todos os status</option>
            {(Object.keys(statusCopy) as AccountStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusCopy[status].label}
              </option>
            ))}
          </select>
        </header>

        <div className="hidden grid-cols-[1.4fr_.7fr_.7fr_.7fr_auto] gap-4 border-b border-slate-100 px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 xl:grid">
          <span>Profissional</span><span>Plano e acesso</span><span>Performance no período</span><span>Renovação</span><span>Ação</span>
        </div>
        {visibleProfessionals.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-bold text-slate-500">
              Nenhuma conta encontrada.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleProfessionals.map((professional) => {
              const account = billingAccounts[professional.billingAccountId];
              if (!account) return null;
              const status = account.status ?? "pending";
              const usage = usageByAccount[account.id]?.[month] ?? 0;
              const limit = planConfigs[account.tier].baseMonthlyLeadLimit;
              const isClinicManager = account.ownerType === "clinic"
                && (
                  account.ownerProfessionalId === professional.id
                  || (!account.ownerProfessionalId
                    && professional.teamTag?.toLowerCase().includes("admin"))
                );
              const professionalLeads = metricLeads.filter((lead) => {
                if (isClinicManager) return lead.accountId === account.id;
                const assignedProfessionalId = lead.professionalId ?? lead.dentistId;
                if (assignedProfessionalId) return assignedProfessionalId === professional.id;
                return account.ownerType === "dentist" && lead.accountId === account.id;
              });
              const conversions = professionalLeads.filter((lead) => lead.status === "closed").length;
              return (
                <article
                  key={professional.id}
                  className="grid gap-5 p-6 xl:grid-cols-[1.4fr_.7fr_.7fr_.7fr_auto] xl:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-black">
                        {professional.name || "Profissional sem nome"}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusCopy[status].className}`}
                      >
                        {statusCopy[status].label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {professional.specialty || "Especialidade não informada"} · {account.accountName || "Conta sem nome"}
                    </p>
                    <p className="mt-1 break-all text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {professional.email || account.checkoutEmail || "Email não informado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Plano
                    </p>
                    <p className="mt-1 font-black">{planName(account.tier)}</p>
                    <p className="text-xs font-bold text-slate-500">{usage} / {limit} leads</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Leads / conversão
                    </p>
                    <p className="mt-1 font-black">
                      {professionalLeads.length} / {conversions}
                    </p>
                    <p className="text-xs font-bold text-slate-500">{professionalLeads.length ? Math.round((conversions / professionalLeads.length) * 100) : 0}% convertido</p>
                  </div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Renovação</p><p className="mt-1 font-black">{new Date(account.renewAt).toLocaleDateString("pt-BR")}</p></div>
                  <div>
                    <button onClick={() => setManagedProfessional(professional)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">
                      Gerenciar <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Conteúdo para a rede</p><h2 className="mt-1 text-2xl font-black">Post do Dia</h2></div>
        <DailyPostManager posts={dailyPosts} onSave={onManageDailyPost} />
      </section>

      {managedProfessional && (() => {
        const professional = managedProfessional;
        const account = billingAccounts[professional.billingAccountId];
        if (!account) return null;
        const status = professional.status ?? (professional.isActive ? "active" : "inactive");
        const isClinicManager = account.ownerType === "clinic"
          && (
            account.ownerProfessionalId === professional.id
            || (!account.ownerProfessionalId
              && professional.teamTag?.toLowerCase().includes("admin"))
          );
        const professionalLeads = leadRecords.filter((lead) => {
          if (isClinicManager) return lead.accountId === account.id;
          const assignedProfessionalId = lead.professionalId ?? lead.dentistId;
          if (assignedProfessionalId) return assignedProfessionalId === professional.id;
          return account.ownerType === "dentist" && lead.accountId === account.id;
        });
        const leadCounts = {
          new: professionalLeads.filter((lead) => lead.status === "new").length,
          inChat: professionalLeads.filter((lead) => lead.status === "in_chat").length,
          scheduled: professionalLeads.filter((lead) => lead.status === "scheduled").length,
          closed: professionalLeads.filter((lead) => lead.status === "closed").length,
        };
        const history = [
          ...adminAuditLogs.filter((item) => item.accountId === account.id && (!item.professionalId || item.professionalId === professional.id)).map((item) => ({ id: `audit-${item.id}`, label: item.action.replaceAll("_", " "), detail: "Ação administrativa", createdAt: item.createdAt })),
          ...subscriptionHistory.filter((item) => item.accountId === account.id && (!item.professionalId || item.professionalId === professional.id)).map((item) => ({ id: `subscription-${item.id}`, label: `${item.fromStatus ?? "início"} → ${item.toStatus}`, detail: item.reason || "Assinatura", createdAt: item.createdAt })),
        ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
        const canTrial = status === "inactive" && professional.isActive !== true && !professional.isProtected && !professional.isDemo;
        const run = async (action: () => Promise<void>, success: string): Promise<void> => {
          setBusyId(professional.id);
          try { await action(); setNotice(success); setManagedProfessional(null); }
          catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação."); }
          finally { setBusyId(null); }
        };
        return (
          <div className="fixed inset-0 z-[105] bg-slate-950/50 backdrop-blur-sm" onClick={() => setManagedProfessional(null)}>
            <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
              <button onClick={() => setManagedProfessional(null)} className="float-right rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Gestão do cliente</p>
              <h2 className="mt-2 pr-10 text-3xl font-black">{professional.name || "Profissional sem nome"}</h2>
              <p className="mt-2 text-sm font-bold text-slate-500">{account.accountName || account.id}</p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <Info label="Status" value={statusCopy[account.status ?? "pending"].label} />
                <Info label="Plano" value={planName(account.tier)} />
                <Info label="Mensalidade" value={planConfigs[account.tier].price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                <Info label="Renovação" value={new Date(account.renewAt).toLocaleDateString("pt-BR")} />
                <Info label="Uso do mês" value={`${usageByAccount[account.id]?.[month] ?? 0} / ${planConfigs[account.tier].baseMonthlyLeadLimit}`} />
                <Info label="Trial" value={professional.trialEndsAt ? `até ${new Date(professional.trialEndsAt).toLocaleDateString("pt-BR")}` : "não ativo"} />
              </div>

              <div className="mt-7 rounded-2xl border border-slate-100 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Leads gerais do profissional</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Info label="Total" value={String(professionalLeads.length)} />
                  <Info label="Novos" value={String(leadCounts.new)} />
                  <Info label="Em conversa" value={String(leadCounts.inChat)} />
                  <Info label="Agendados" value={String(leadCounts.scheduled)} />
                  <Info label="Convertidos" value={String(leadCounts.closed)} />
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-slate-100 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acesso e suporte</p>
                <p className="mt-3 text-sm font-bold">{professional.email || account.checkoutEmail || "Email não informado"}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{professional.whatsapp || account.checkoutWhatsapp || "WhatsApp não informado"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => contactAccount(account)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 px-3 py-2 text-xs font-black text-emerald-700"><MessageCircle className="h-4 w-4" /> WhatsApp</button>
                  <button onClick={() => { setManagedProfessional(null); onViewProfessionalDashboard(professional.id); }} className="inline-flex items-center gap-2 rounded-xl border border-blue-100 px-3 py-2 text-xs font-black text-blue-700"><Eye className="h-4 w-4" /> {isClinicManager ? "Ver gestão da clínica" : "Ver painel do profissional"}</button>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ações administrativas</p>
                <button onClick={() => { setManagedProfessional(null); editProfessional(professional); }} className="action-button"><Edit3 className="h-4 w-4" /> Editar cadastro</button>
                {account.status === "active" && account.subscriptionStatus !== "trial" && <button disabled={busyId === professional.id} onClick={() => void run(() => onUpdateBilling(account.id, "active", account.tier), "Assinatura renovada por 30 dias.")} className="action-button"><CalendarClock className="h-4 w-4" /> Renovar por 30 dias</button>}
                {account.status === "active" && <button disabled={busyId === professional.id} onClick={() => void run(() => onUpdateBilling(account.id, "paused"), "Conta pausada; dados preservados.")} className="action-button"><CreditCard className="h-4 w-4" /> Pausar acesso</button>}
                {(account.status === "paused" || account.status === "overdue" || account.status === "pending") && <button disabled={busyId === professional.id} onClick={() => { setManagedProfessional(null); openActivation(account); }} className="action-button"><CheckCircle2 className="h-4 w-4" /> {account.status === "pending" ? "Conferir e ativar" : "Reativar assinatura"}</button>}
                {canTrial && <button disabled={busyId === professional.id} onClick={() => void run(() => onStartTrial(account.id, professional.id), "Trial de 7 dias iniciado.")} className="action-button"><PlayCircle className="h-4 w-4" /> Iniciar trial de 7 dias</button>}
                {status === "archived" ? (
                  <button disabled={busyId === professional.id} onClick={() => void run(() => onRestoreProfessional(account.id, professional.id), "Profissional restaurado.")} className="action-button text-emerald-700"><RotateCcw className="h-4 w-4" /> Restaurar profissional</button>
                ) : (
                  <button disabled={busyId === professional.id || professional.isProtected || professional.isDemo} onClick={() => { if (window.confirm(`Arquivar ${professional.name}? Os leads e o histórico serão preservados.`)) void run(() => onArchiveProfessional(account.id, professional.id, "arquivamento administrativo"), "Profissional arquivado; histórico preservado."); }} className="action-button text-amber-700 disabled:opacity-40"><Archive className="h-4 w-4" /> Arquivar profissional</button>
                )}
              </div>
              <div className="mt-7 rounded-2xl border border-slate-100 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico administrativo</p>
                <div className="mt-4 space-y-3">{history.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-black capitalize">{item.label}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.detail} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p></div>)}{history.length === 0 && <p className="text-sm font-bold text-slate-400">Nenhum evento registrado.</p>}</div>
              </div>
            </aside>
          </div>
        );
      })()}

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
          <section className="relative w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl">
            <button
              onClick={() => setSelected(null)}
              className="absolute right-5 top-5 rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            <h2 className="mt-5 text-2xl font-black">
              Confirmar pagamento e ativar
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Confira o comprovante e o pagamento na InfinitePay antes de
              liberar o acesso de{" "}
              <strong>{selected.accountName || selected.checkoutName}</strong>.
            </p>
            <p className="mt-3 break-all rounded-xl bg-slate-50 p-3 text-xs font-black text-slate-500">
              Referência: {selected.id}
            </p>
            <label className="mt-6 block">
              <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">
                Plano liberado
              </span>
              <select
                value={selectedPlan}
                onChange={(event) =>
                  setSelectedPlan(event.target.value as PlanTier)
                }
                className="input"
              >
                {(Object.keys(planConfigs) as PlanTier[]).map((tier) => (
                  <option key={tier} value={tier}>
                    {planName(tier)} — R$ {planConfigs[tier].price}/mês
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busyId === selected.id}
              onClick={() =>
                void changeStatus(selected, "active", selectedPlan)
              }
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              {busyId === selected.id ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              Confirmar pagamento e ativar
            </button>
          </section>
        </div>
      )}

      {selectedProfessional && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
          <section className="relative w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl">
            <button onClick={() => setSelectedProfessional(null)} className="absolute right-5 top-5 rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Cadastro seguro</p>
            <h2 className="mt-2 text-2xl font-black">Editar profissional</h2>
            <p className="mt-2 text-xs font-medium text-slate-500">A edição usa o accountId e professionalId selecionados. Leads e histórico permanecem intactos.</p>
            <label className="mt-6 block"><span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Nome</span><input value={professionalName} onChange={(event) => setProfessionalName(event.target.value)} className="input" /></label>
            <label className="mt-4 block"><span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Especialidade</span><input value={professionalSpecialty} onChange={(event) => setProfessionalSpecialty(event.target.value)} className="input" /></label>
            <button disabled={busyId === selectedProfessional.id} onClick={() => void saveProfessional()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50">{busyId === selectedProfessional.id && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar alterações</button>
          </section>
        </div>
      )}
    </main>
  );
};

const Kpi = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <article className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
    <div className="text-blue-600">{icon}</div>
    <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-2xl font-black">{value}</p>
  </article>
);

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-slate-50 p-4">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
  </div>
);
