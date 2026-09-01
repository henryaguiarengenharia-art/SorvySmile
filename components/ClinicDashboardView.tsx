import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Clock,
  Eye,
  Link as LinkIcon,
  LoaderCircle,
  Phone,
  Plus,
  Power,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  BillingAccount,
  AssistantResponse,
  DailyPostAssignment,
  DailyPostVariant,
  DentistRecord,
  LeadRecord,
  LeadStatus,
} from "../types";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { DailyPostCard } from "./DailyPostCard";
import { PeriodFilter } from "./PeriodFilter";
import { PLAN_CONFIGS } from "../planCatalog";
import { filterLeadsByPeriod, MetricPeriod } from "../services/metrics";
import { BillingSummaryCard } from "./BillingSummaryCard";

interface TeamMemberInput {
  name: string;
  email: string;
  whatsapp: string;
  specialty: string;
  teamTag: string;
  temporaryPassword: string;
}

interface ClinicDashboardViewProps {
  leadRecords: LeadRecord[];
  professionals: DentistRecord[];
  account: BillingAccount;
  currentUsage: number;
  currentProfessionalId?: string;
  onAssignLead: (leadId: string, professionalId: string | null) => Promise<void>;
  onCreateProfessional: (input: TeamMemberInput) => Promise<unknown>;
  onToggleProfessional: (professionalId: string, isActive: boolean) => Promise<void>;
  onUpdateLead: (leadId: string, patch: Partial<LeadRecord>) => Promise<void>;
  managerProfessional?: DentistRecord;
  onUpdateClinicProfile: (patch: Partial<DentistRecord>) => Promise<void>;
  onStartCheckout?: (context: "trial_ready" | "trial_active" | "pending" | "overdue") => Promise<void>;
  dailyPost?: DailyPostAssignment | null;
  dailyPostHistory?: DailyPostAssignment[];
  onDailyPostEvent?: (event: 'view' | 'customize' | 'copy_caption' | 'download_feed' | 'download_story' | 'mark_as_used' | 'request_alternative', format?: 'feed' | 'story' | 'carousel' | 'none', variant?: DailyPostVariant) => Promise<void>;
  onAskAssistant?: (input: { mode: "management" | "conversion"; question: string; leadId?: string; conversationId?: string }) => Promise<AssistantResponse>;
  onUpdateSlug?: (slug: string) => Promise<string>;
  readOnly?: boolean;
}

type ClinicTab = "overview" | "leads" | "team" | "profile" | "post";

const statusLabel: Record<LeadStatus, string> = {
  new: "Novo",
  in_chat: "Em conversa",
  scheduled: "Agendado",
  closed: "Convertido",
  lost: "Perdido",
};

const emptyMember = (): TeamMemberInput => ({
  name: "",
  email: "",
  whatsapp: "",
  specialty: "",
  teamTag: "Dentista",
  temporaryPassword: generateTemporaryPassword(),
});

function generateTemporaryPassword(): string {
  const bytes = new Uint32Array(3);
  crypto.getRandomValues(bytes);
  return `Sorvy!${Array.from(bytes, (value) => value.toString(36)).join("").slice(0, 12)}`;
}

const digits = (value: string): string => value.replace(/\D/g, "");

export const ClinicDashboardView: React.FC<ClinicDashboardViewProps> = ({
  leadRecords,
  professionals,
  account,
  currentUsage,
  currentProfessionalId,
  onAssignLead,
  onCreateProfessional,
  onToggleProfessional,
  onUpdateLead,
  managerProfessional,
  onUpdateClinicProfile,
  onStartCheckout,
  dailyPost,
  dailyPostHistory,
  onDailyPostEvent,
  onAskAssistant,
  onUpdateSlug,
  readOnly = false,
}) => {
  const [tab, setTab] = useState<ClinicTab>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [member, setMember] = useState<TeamMemberInput>(emptyMember);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metricPeriod, setMetricPeriod] = useState<MetricPeriod>(30);
  const [clinicProfile, setClinicProfile] = useState({
    whatsapp: managerProfessional?.whatsapp ?? "",
    city: managerProfessional?.city ?? "",
    state: managerProfessional?.state ?? "",
    bio: managerProfessional?.bio ?? "",
    standardMessage: managerProfessional?.standardMessage ?? "",
    profileImage: managerProfessional?.profileImage ?? "",
    publicSlug: managerProfessional?.publicSlug ?? "",
  });

  useEffect(() => {
    if (!managerProfessional) return;
    setClinicProfile({
      whatsapp: managerProfessional.whatsapp ?? "",
      city: managerProfessional.city ?? "",
      state: managerProfessional.state ?? "",
      bio: managerProfessional.bio ?? "",
      standardMessage: managerProfessional.standardMessage ?? "",
      profileImage: managerProfessional.profileImage ?? "",
      publicSlug: managerProfessional.publicSlug ?? "",
    });
  }, [managerProfessional]);

  const activeProfessionals = professionals.filter((item) => item.isActive);
  const unassigned = leadRecords.filter((lead) => !(lead.professionalId ?? lead.dentistId));
  const metricLeads = useMemo(
    () => filterLeadsByPeriod(leadRecords, metricPeriod),
    [leadRecords, metricPeriod],
  );
  const now = Date.now();
  const backlog = leadRecords.filter(
    (lead) =>
      lead.status === "new"
      && !lead.firstContactAt
      && now - lead.createdAt > 120 * 60 * 1000,
  );
  const finished = metricLeads.filter(
    (lead) => lead.status === "closed" || lead.status === "lost",
  );
  const converted = metricLeads.filter((lead) => lead.status === "closed");
  const conversion = finished.length
    ? Math.round((converted.length / finished.length) * 100)
    : 0;

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leadRecords.filter((lead) => {
      const matchesSearch = !query
        || lead.lead.name.toLowerCase().includes(query)
        || digits(lead.lead.whatsapp).includes(digits(query));
      return matchesSearch && (statusFilter === "all" || lead.status === statusFilter);
    });
  }, [leadRecords, search, statusFilter]);

  const teamMetrics = useMemo(
    () => professionals.map((professional) => {
      const leads = metricLeads.filter(
        (lead) => (lead.professionalId ?? lead.dentistId) === professional.id,
      );
      const completed = leads.filter(
        (lead) => lead.status === "closed" || lead.status === "lost",
      );
      const won = leads.filter((lead) => lead.status === "closed");
      const contacted = leads.filter((lead) => lead.firstContactAt);
      const averageMinutes = contacted.length
        ? Math.round(
            contacted.reduce(
              (sum, lead) => sum + ((lead.firstContactAt ?? lead.createdAt) - lead.createdAt),
              0,
            ) / contacted.length / 60_000,
          )
        : 0;
      return {
        professional,
        leads: leads.length,
        conversion: completed.length ? Math.round((won.length / completed.length) * 100) : 0,
        averageMinutes,
      };
    }),
    [metricLeads, professionals],
  );

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    if (readOnly) return;
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Não foi possível concluir a ação.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const submitMember = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(
      "new-member",
      () => onCreateProfessional(member),
      "Acesso criado. Envie o email e a senha temporária ao profissional por um canal seguro.",
    );
    setShowMemberForm(false);
    setMember(emptyMember());
  };

  const openWhatsApp = (lead: LeadRecord) => {
    if (readOnly) return;
    const number = digits(lead.lead.whatsapp);
    if (!number) return;
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(
        `Olá, ${lead.lead.name}! Recebemos sua triagem informativa pela Sorvy Smile. Como podemos ajudar com sua avaliação?`,
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
            Operação da clínica · Network
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Equipe e distribuição de leads</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            O link da clínica alimenta esta fila; cada dentista visualiza somente os leads atribuídos a ele.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {managerProfessional?.publicSlug && (
            <button
              onClick={() => navigator.clipboard.writeText(
                `${window.location.origin}/p/${managerProfessional.publicSlug}`,
              )}
              className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-black text-blue-700"
            >
              <LinkIcon className="h-4 w-4" /> Copiar link da clínica
            </button>
          )}
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-sm font-black">
            {activeProfessionals.length}/{account.seatsTotal ?? 2} acessos ativos
          </div>
        </div>
      </header>

      {(notice || error) && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${
          error
            ? "border-red-100 bg-red-50 text-red-700"
            : "border-emerald-100 bg-emerald-50 text-emerald-700"
        }`}>
          {error ?? notice}
        </div>
      )}

      {readOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
          <Eye className="h-5 w-5 shrink-0" />
          Visualização administrativa da HQ. Você está vendo a gestão desta clínica em modo somente leitura.
        </div>
      )}

      <nav className="flex flex-wrap gap-2">
        <Tab active={tab === "overview"} onClick={() => setTab("overview")} label="Visão geral" />
        <Tab active={tab === "leads"} onClick={() => setTab("leads")} label="Fila de leads" />
        <Tab active={tab === "team"} onClick={() => setTab("team")} label="Equipe" />
        <Tab active={tab === "profile"} onClick={() => setTab("profile")} label="Perfil da clínica" />
        <Tab active={tab === "post"} onClick={() => setTab("post")} label="Post do Dia" />
      </nav>

      {tab === "overview" && (
        <>
          <BillingSummaryCard account={account} readOnly={readOnly} onStartCheckout={onStartCheckout} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Métricas da operação</p>
              <p className="mt-1 text-sm font-bold text-slate-600">{metricLeads.length} no período · {leadRecords.length} no geral</p>
            </div>
            <PeriodFilter value={metricPeriod} onChange={setMetricPeriod} />
          </div>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Kpi label="Leads no período" value={metricLeads.length} icon={<Users />} />
            <Kpi label="Leads gerais" value={leadRecords.length} icon={<Users />} />
            <Kpi label="Sem responsável" value={unassigned.length} icon={<UserCheck />} warn={unassigned.length > 0} />
            <Kpi label="Backlog +2h" value={backlog.length} icon={<AlertTriangle />} warn={backlog.length > 0} />
            <Kpi label="Conversão" value={`${conversion}%`} icon={<CheckCircle2 />} />
            <Kpi label="Uso mensal" value={`${currentUsage}/${PLAN_CONFIGS[account.tier].baseMonthlyLeadLimit}`} icon={<Clock />} />
          </section>
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Leads que precisam de ação</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Priorize os não atribuídos e os que aguardam há mais de duas horas.
                </p>
              </div>
              <button onClick={() => setTab("leads")} className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white">
                Abrir fila
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {[...unassigned, ...backlog.filter((lead) => lead.professionalId)]
                .filter((lead, index, all) => all.findIndex((item) => item.id === lead.id) === index)
                .slice(0, 6)
                .map((lead) => (
                  <div key={lead.id} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">{lead.lead.name}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        {new Date(lead.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <AssignmentSelect
                      lead={lead}
                      professionals={activeProfessionals}
                      busy={readOnly || busyId === lead.id}
                      onChange={(professionalId) =>
                        run(lead.id, () => onAssignLead(lead.id, professionalId), "Lead atribuído.")
                      }
                    />
                  </div>
                ))}
              {unassigned.length === 0 && backlog.length === 0 && (
                <p className="rounded-2xl bg-emerald-50 p-5 text-center text-sm font-bold text-emerald-700">
                  Nenhum lead crítico neste momento.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "leads" && (
        <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou WhatsApp" className="w-full bg-transparent py-3 text-sm font-bold outline-none" />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "all")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
              <option value="all">Todos os status</option>
              {(Object.keys(statusLabel) as LeadStatus[]).map((status) => (
                <option key={status} value={status}>{statusLabel[status]}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <tr><th className="p-4">Paciente</th><th className="p-4">Entrada</th><th className="p-4">Responsável</th><th className="p-4">Status</th><th className="p-4 text-right">Contato</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="p-4"><p className="font-black">{lead.lead.name}</p><p className="text-xs text-slate-400">{lead.lead.whatsapp}</p></td>
                    <td className="p-4 text-xs font-bold text-slate-500">{new Date(lead.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="p-4"><AssignmentSelect lead={lead} professionals={activeProfessionals} busy={readOnly || busyId === lead.id} onChange={(professionalId) => run(lead.id, () => onAssignLead(lead.id, professionalId), "Lead atribuído.")} /></td>
                    <td className="p-4">
                      <select value={lead.status} disabled={readOnly || busyId === lead.id} onChange={(event) => run(lead.id, () => onUpdateLead(lead.id, { status: event.target.value as LeadStatus }), "Status atualizado.")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black">
                        {(Object.keys(statusLabel) as LeadStatus[]).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-right">{!readOnly && <button onClick={() => openWhatsApp(lead)} className="rounded-xl border border-emerald-100 p-3 text-emerald-600 hover:bg-emerald-50"><Phone className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "team" && (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Profissionais da clínica</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Cada profissional recebe login e link próprios; o administrador mantém a visão consolidada.
              </p>
            </div>
            {!readOnly && <button disabled={activeProfessionals.length >= (account.seatsTotal ?? 2)} onClick={() => setShowMemberForm(true)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40">
              <Plus className="h-4 w-4" /> Novo profissional
            </button>}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {teamMetrics.map(({ professional, leads, conversion: memberConversion, averageMinutes }) => {
              const publicUrl = `${window.location.origin}/p/${professional.publicSlug ?? ""}`;
              const isOwner = professional.id === currentProfessionalId;
              return (
                <article key={professional.id} className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="text-lg font-black">{professional.name}</h3>{isOwner && <span className="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black uppercase text-blue-600">Administrador</span>}</div>
                      <p className="mt-1 text-xs font-bold text-slate-400">{professional.specialty || professional.teamTag || "Dentista"}</p>
                    </div>
                    <button disabled={readOnly || isOwner || busyId === professional.id} onClick={() => run(professional.id, () => onToggleProfessional(professional.id, !professional.isActive), professional.isActive ? "Acesso pausado." : "Acesso reativado.")} className={`rounded-xl p-3 disabled:opacity-50 ${professional.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`} title={professional.isActive ? "Pausar acesso" : "Reativar acesso"}>
                      {busyId === professional.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <Metric label="Leads" value={leads} />
                    <Metric label="Conversão" value={`${memberConversion}%`} />
                    <Metric label="Resposta" value={`${averageMinutes}m`} />
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(publicUrl)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">
                    <LinkIcon className="h-4 w-4" /> Copiar link individual
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "profile" && (
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-slate-100 bg-white p-7 shadow-sm">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">
              Link oficial da clínica
            </p>
            <h2 className="mt-2 text-2xl font-black">Dados exibidos na jornada do paciente</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Alterações de contato atualizam o destino da triagem sem trocar o slug oficial.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field disabled={readOnly} label="WhatsApp da clínica" value={clinicProfile.whatsapp} onChange={(value) => setClinicProfile({ ...clinicProfile, whatsapp: value })} />
            <Field disabled={readOnly} label="Cidade" value={clinicProfile.city} onChange={(value) => setClinicProfile({ ...clinicProfile, city: value })} />
            <Field disabled={readOnly} label="UF" value={clinicProfile.state} onChange={(value) => setClinicProfile({ ...clinicProfile, state: value.toUpperCase().slice(0, 2) })} />
            <Field disabled={readOnly} label="Mensagem padrão" value={clinicProfile.standardMessage} onChange={(value) => setClinicProfile({ ...clinicProfile, standardMessage: value })} />
            <Field disabled={readOnly} label="Link público" value={clinicProfile.publicSlug} onChange={(value) => setClinicProfile({ ...clinicProfile, publicSlug: value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
            <Field required={false} disabled={readOnly} label="URL https da foto" value={clinicProfile.profileImage} onChange={(value) => setClinicProfile({ ...clinicProfile, profileImage: value })} />
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Descrição curta</span>
            <textarea disabled={readOnly} value={clinicProfile.bio} onChange={(event) => setClinicProfile({ ...clinicProfile, bio: event.target.value })} className="min-h-28 w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 disabled:opacity-70" />
          </label>
          {!readOnly && <button
            disabled={busyId === "clinic-profile"}
            onClick={() => run(
              "clinic-profile",
              async () => {
                await onUpdateClinicProfile(clinicProfile);
                if (onUpdateSlug && managerProfessional && clinicProfile.publicSlug !== managerProfessional.publicSlug) {
                  const slug = await onUpdateSlug(clinicProfile.publicSlug);
                  setClinicProfile((current) => ({ ...current, publicSlug: slug }));
                }
              },
              "Perfil da clínica atualizado.",
            )}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {busyId === "clinic-profile" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar perfil da clínica
          </button>}
        </section>
      )}

      {tab === "post" && <DailyPostCard post={dailyPost} history={dailyPostHistory} readOnly={readOnly} onEvent={onDailyPostEvent} />}

      {account.tier === "network" && !readOnly && onAskAssistant && (
        <AIAssistantPanel
          leadRecords={leadRecords}
          accountId={account.id}
          role="clinic"
          onAsk={onAskAssistant}
          onViewLead={(leadId) => {
            const lead = leadRecords.find((item) => item.id === leadId);
            setTab("leads");
            if (lead) setSearch(lead.lead.name);
          }}
          onShortcut={(shortcut) => {
            if (shortcut === "post") setTab("post");
            else if (shortcut === "leads") setTab("leads");
            else setTab("overview");
          }}
        />
      )}

      {showMemberForm && !readOnly && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-5 backdrop-blur-sm">
          <form onSubmit={submitMember} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Novo acesso Network</p><h2 className="mt-1 text-2xl font-black">Adicionar profissional</h2></div><button type="button" onClick={() => setShowMemberForm(false)} className="rounded-xl bg-slate-100 p-3"><X className="h-5 w-5" /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Nome" value={member.name} onChange={(value) => setMember({ ...member, name: value })} />
              <Field label="Email de acesso" type="email" value={member.email} onChange={(value) => setMember({ ...member, email: value })} />
              <Field label="WhatsApp" value={member.whatsapp} onChange={(value) => setMember({ ...member, whatsapp: value })} />
              <Field label="Especialidade" value={member.specialty} onChange={(value) => setMember({ ...member, specialty: value })} />
              <Field label="Função na equipe" value={member.teamTag} onChange={(value) => setMember({ ...member, teamTag: value })} />
              <Field label="Senha temporária" value={member.temporaryPassword} onChange={(value) => setMember({ ...member, temporaryPassword: value })} />
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-xs font-bold leading-relaxed text-amber-800"><Clipboard className="h-5 w-5 shrink-0" />Envie a senha por um canal seguro. O profissional poderá trocá-la usando “Esqueci minha senha”.</div>
            <button disabled={busyId === "new-member"} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50">{busyId === "new-member" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar acesso</button>
          </form>
        </div>
      )}
    </div>
  );
};

const AssignmentSelect = ({ lead, professionals, busy, onChange }: { lead: LeadRecord; professionals: DentistRecord[]; busy: boolean; onChange: (professionalId: string | null) => void }) => (
  <select disabled={busy} value={lead.professionalId ?? lead.dentistId ?? ""} onChange={(event) => onChange(event.target.value || null)} className="max-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black disabled:opacity-50">
    <option value="">Sem responsável</option>
    {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
  </select>
);

const Tab = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button onClick={onClick} className={`rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest ${active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-500"}`}>{label}</button>
);

const Kpi = ({ label, value, icon, warn = false }: { label: string; value: string | number; icon: React.ReactNode; warn?: boolean }) => (
  <article className={`rounded-[1.5rem] border p-5 ${warn ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-white"}`}><div className={`h-5 w-5 ${warn ? "text-amber-600" : "text-blue-600"}`}>{icon}</div><p className="mt-4 text-3xl font-black">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p></article>
);

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-black">{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p></div>
);

const Field = ({ label, value, onChange, type = "text", disabled = false, required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; required?: boolean }) => (
  <label className="space-y-2"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span><input required={required} disabled={disabled} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 disabled:opacity-70" /></label>
);
