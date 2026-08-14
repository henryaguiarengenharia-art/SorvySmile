import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Archive,
  Edit3,
  LoaderCircle,
  MessageCircle,
  Search,
  ShieldCheck,
  RotateCcw,
  PlayCircle,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import {
  AccountStatus,
  BillingAccount,
  DentistRecord,
  LeadRecord,
  PlanConfig,
  PlanTier,
} from "../types";
import { planName } from "../planCatalog";

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
  const [professionalName, setProfessionalName] = useState("");
  const [professionalSpecialty, setProfessionalSpecialty] = useState("");

  const accounts = useMemo(
    () =>
      Object.values(billingAccounts)
        .filter((account) => {
          const term = search.trim().toLowerCase();
          const matchesSearch =
            !term
            || account.id.toLowerCase().includes(term)
            || (account.accountName ?? "").toLowerCase().includes(term)
            || (account.checkoutEmail ?? "").toLowerCase().includes(term)
            || (account.checkoutWhatsapp ?? "").includes(term);
          return (
            matchesSearch
            && (statusFilter === "all" || account.status === statusFilter)
          );
        })
        .sort((a, b) => b.startAt - a.startAt),
    [billingAccounts, search, statusFilter],
  );

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
  }, []);

  const stats = useMemo(() => {
    const all = Object.values(billingAccounts);
    const active = all.filter((account) => account.status === "active");
    return {
      active: active.length,
      pending: all.filter((account) => account.status === "pending").length,
      mrr: active.reduce(
        (sum, account) => sum + planConfigs[account.tier].price,
        0,
      ),
      monthLeads: leadRecords.filter((lead) => {
        const created = new Date(lead.createdAt);
        return (
          created.getUTCFullYear() === new Date().getUTCFullYear()
          && created.getUTCMonth() === new Date().getUTCMonth()
        );
      }).length,
    };
  }, [billingAccounts, leadRecords, planConfigs]);

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
          Contas, conferência de pagamentos, uso e receita recorrente sem
          gestão de rede.
        </p>
      </header>

      {notice && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {notice}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={<UserRoundCheck className="h-5 w-5" />}
          label="Contas ativas"
          value={String(stats.active)}
        />
        <Kpi
          icon={<CreditCard className="h-5 w-5" />}
          label="Aguardando"
          value={String(stats.pending)}
        />
        <Kpi
          icon={<Users className="h-5 w-5" />}
          label="Leads no mês"
          value={String(stats.monthLeads)}
        />
        <Kpi
          icon={<ShieldCheck className="h-5 w-5" />}
          label="MRR contratado"
          value={stats.mrr.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          })}
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Rede e profissionais</p>
            <h2 className="mt-1 text-xl font-black">Acesso, trial e histórico</h2>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{professionals.length} cadastro(s)</span>
        </header>
        <div className="divide-y divide-slate-100">
          {professionals.map((professional) => {
            const status = professional.status ?? (professional.isActive ? "active" : "inactive");
            const account = billingAccounts[professional.billingAccountId];
            const canTrial = status === "inactive"
              && professional.isActive !== true
              && !professional.isProtected
              && !professional.isDemo;
            return (
              <article key={professional.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{professional.name || "Profissional sem nome"}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{status}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">{professional.specialty || "Especialidade não informada"} · {account?.accountName || professional.billingAccountId}</p>
                  {status === "trial" && professional.trialEndsAt && <p className="mt-1 text-xs font-bold text-amber-700">Trial até {new Date(professional.trialEndsAt).toLocaleDateString("pt-BR")}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => editProfessional(professional)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"><Edit3 className="h-4 w-4" /> Editar</button>
                  {canTrial && <button disabled={busyId === professional.id} onClick={async () => { setBusyId(professional.id); try { await onStartTrial(professional.billingAccountId, professional.id); setNotice("Trial de 7 dias iniciado."); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível iniciar o trial."); } finally { setBusyId(null); } }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><PlayCircle className="h-4 w-4" /> Iniciar trial</button>}
                  {status === "archived" ? <button onClick={async () => { setBusyId(professional.id); try { await onRestoreProfessional(professional.billingAccountId, professional.id); setNotice("Profissional restaurado."); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível restaurar."); } finally { setBusyId(null); } }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><RotateCcw className="h-4 w-4" /> Restaurar</button> : <button onClick={async () => { if (!window.confirm(`Arquivar ${professional.name || "este profissional"}? Os leads serão preservados.`)) return; setBusyId(professional.id); try { await onArchiveProfessional(professional.billingAccountId, professional.id, "arquivamento administrativo"); setNotice("Profissional arquivado; histórico preservado."); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível arquivar."); } finally { setBusyId(null); } }} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-700"><Archive className="h-4 w-4" /> Arquivar</button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white">
        <header className="grid gap-4 border-b border-slate-100 bg-slate-50 p-6 md:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conta, email ou WhatsApp"
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

        {accounts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-bold text-slate-500">
              Nenhuma conta encontrada.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {accounts.map((account) => {
              const status = account.status ?? "pending";
              const usage = usageByAccount[account.id]?.[month] ?? 0;
              const limit = planConfigs[account.tier].baseMonthlyLeadLimit;
              return (
                <article
                  key={account.id}
                  className="grid gap-5 p-6 xl:grid-cols-[1.3fr_.7fr_.7fr_auto] xl:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-black">
                        {account.accountName
                          || account.checkoutName
                          || "Conta sem nome"}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusCopy[status].className}`}
                      >
                        {statusCopy[status].label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {account.checkoutEmail || "Email não informado"} ·{" "}
                      {account.checkoutWhatsapp || "WhatsApp não informado"}
                    </p>
                    <p className="mt-1 break-all text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Ref. {account.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Plano
                    </p>
                    <p className="mt-1 font-black">
                      {planName(account.tier)} · R${" "}
                      {planConfigs[account.tier].price}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Uso do mês
                    </p>
                    <p className="mt-1 font-black">
                      {usage} / {limit}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => contactAccount(account)}
                      className="rounded-xl border border-emerald-100 p-3 text-emerald-600 hover:bg-emerald-50"
                      aria-label="Conversar no WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    {status === "pending" && (
                      <button
                        onClick={() => openActivation(account)}
                        className="rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                      >
                        Ativar
                      </button>
                    )}
                    {status === "active" && (
                      <button
                        disabled={busyId === account.id}
                        onClick={() =>
                          void changeStatus(account, "paused")
                        }
                        className="rounded-xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600"
                      >
                        Pausar
                      </button>
                    )}
                    {(status === "paused" || status === "overdue") && (
                      <button
                        onClick={() => openActivation(account)}
                        className="rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                      >
                        Reativar
                      </button>
                    )}
                    {busyId === account.id && (
                      <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
