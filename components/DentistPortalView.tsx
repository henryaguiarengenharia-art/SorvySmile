import React, { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Instagram,
  Link2,
  LoaderCircle,
  MessageCircle,
  Phone,
  Save,
  Settings,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import {
  DentistRecord,
  LeadRecord,
  LeadStatus,
  PlanConfig,
} from "../types";
import { planName } from "../planCatalog";

interface DentistPortalViewProps {
  leadRecords: LeadRecord[];
  professional: DentistRecord;
  planConfig: PlanConfig;
  currentUsage: number;
  onUpdateLead: (
    id: string,
    patch: Partial<LeadRecord>,
  ) => Promise<void>;
  onUpdateProfessional: (
    patch: Partial<DentistRecord>,
  ) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  readOnly?: boolean;
}

type PortalTab = "dashboard" | "leads" | "post" | "profile";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const statusLabel: Record<LeadStatus, string> = {
  new: "Novo",
  in_chat: "Em conversa",
  scheduled: "Agendado",
  closed: "Convertido",
  lost: "Não convertido",
};

const statusClass: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700",
  in_chat: "bg-indigo-50 text-indigo-700",
  scheduled: "bg-emerald-50 text-emerald-700",
  closed: "bg-violet-50 text-violet-700",
  lost: "bg-slate-100 text-slate-600",
};

export const DentistPortalView: React.FC<DentistPortalViewProps> = ({
  leadRecords,
  professional,
  planConfig,
  currentUsage,
  onUpdateLead,
  onUpdateProfessional,
  onDeleteLead,
  readOnly = false,
}) => {
  const [tab, setTab] = useState<PortalTab>("dashboard");
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [scheduleLead, setScheduleLead] = useState<LeadRecord | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [whatsapp, setWhatsapp] = useState(
    formatPhone(professional.whatsapp),
  );
  const [city, setCity] = useState(professional.city ?? "");
  const [state, setState] = useState(professional.state ?? "");
  const [bio, setBio] = useState(professional.bio ?? "");
  const [standardMessage, setStandardMessage] = useState(
    professional.standardMessage
      ?? "Olá [NOME]! Recebi sua triagem visual pela Sorvy Smile. Podemos conversar sobre uma avaliação presencial?",
  );
  const [templatesText, setTemplatesText] = useState(
    (professional.templates ?? []).join("\n"),
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const fullCrm = planConfig.features.funnelFull;
  const schedulingEnabled = planConfig.features.scheduling;
  const publicUrl = `${window.location.origin}/p/${professional.publicSlug ?? ""}`;
  const usageLimit = planConfig.baseMonthlyLeadLimit;
  const usagePercent = Math.min(
    100,
    Math.round((currentUsage / Math.max(1, usageLimit)) * 100),
  );

  const leads = useMemo(
    () =>
      leadRecords
        .filter((record) => {
          const term = search.trim().toLowerCase();
          const matchesTerm =
            !term
            || record.lead.name.toLowerCase().includes(term)
            || record.lead.whatsapp.includes(term);
          const matchesStatus = filter === "all" || record.status === filter;
          return matchesTerm && matchesStatus;
        })
        .sort((a, b) => {
          const requestedDifference = Number(Boolean(b.contactRequestedAtMs))
            - Number(Boolean(a.contactRequestedAtMs));
          return requestedDifference || b.createdAt - a.createdAt;
        }),
    [filter, leadRecords, search],
  );

  const counts = useMemo(
    () => ({
      new: leadRecords.filter((lead) => lead.status === "new").length,
      in_chat: leadRecords.filter((lead) => lead.status === "in_chat").length,
      scheduled: leadRecords.filter((lead) => lead.status === "scheduled").length,
      closed: leadRecords.filter((lead) => lead.status === "closed").length,
    }),
    [leadRecords],
  );

  const responseStats = useMemo(() => {
    const responded = leadRecords.filter((lead) => lead.firstContactAt);
    const averageMinutes = responded.length
      ? Math.round(
          responded.reduce(
            (sum, lead) =>
              sum + ((lead.firstContactAt ?? lead.createdAt) - lead.createdAt),
            0,
          )
            / responded.length
            / 60000,
        )
      : 0;
    const terminal = leadRecords.filter(
      (lead) => lead.status === "closed" || lead.status === "lost",
    );
    const conversion = terminal.length
      ? Math.round(
          (terminal.filter((lead) => lead.status === "closed").length
            / terminal.length)
            * 100,
        )
      : 0;
    return { averageMinutes, conversion };
  }, [leadRecords]);

  const priorityLead = useMemo(
    () =>
      [...leadRecords]
        .filter((lead) => lead.status === "new")
        .sort((a, b) => {
          const requestedDifference = Number(Boolean(b.contactRequestedAtMs))
            - Number(Boolean(a.contactRequestedAtMs));
          return requestedDifference || a.createdAt - b.createdAt;
        })[0] ?? null,
    [leadRecords],
  );

  const updateLead = async (
    id: string,
    patch: Partial<LeadRecord>,
  ): Promise<void> => {
    if (readOnly) return;
    setBusyLeadId(id);
    setNotice(null);
    try {
      await onUpdateLead(id, patch);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível atualizar.",
      );
    } finally {
      setBusyLeadId(null);
    }
  };

  const openWhatsApp = async (lead: LeadRecord): Promise<void> => {
    if (readOnly) return;
    const message = standardMessage
      .replaceAll("[NOME]", lead.lead.name)
      .replaceAll("[SCORE]", String(lead.scores?.harmonyIndex ?? ""))
      .replaceAll("[STATUS]", lead.scores?.status ?? "");
    const digits = lead.lead.whatsapp.replace(/\D/g, "");
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (!lead.firstContactAt) {
      await updateLead(lead.id, {
        firstContactAt: Date.now(),
        status: lead.status === "new" ? "in_chat" : lead.status,
      });
    }
  };

  const changeStatus = async (
    lead: LeadRecord,
    status: LeadStatus,
  ): Promise<void> => {
    if (status === "scheduled" && schedulingEnabled) {
      setScheduleLead(lead);
      return;
    }
    await updateLead(lead.id, {
      status,
      firstContactAt:
        status !== "new" && !lead.firstContactAt
          ? Date.now()
          : lead.firstContactAt,
    });
  };

  const confirmSchedule = async (): Promise<void> => {
    if (!scheduleLead || !scheduleAt) return;
    await updateLead(scheduleLead.id, {
      status: "scheduled",
      scheduledAt: new Date(scheduleAt).getTime(),
      firstContactAt: scheduleLead.firstContactAt ?? Date.now(),
    });
    setScheduleLead(null);
    setScheduleAt("");
  };

  const deleteLead = async (lead: LeadRecord): Promise<void> => {
    if (readOnly) return;
    if (
      !window.confirm(
        `Excluir definitivamente o lead de ${lead.lead.name}? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setBusyLeadId(lead.id);
    try {
      await onDeleteLead(lead.id);
      setSelectedLead(null);
      setNotice("Lead excluído.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível excluir.",
      );
    } finally {
      setBusyLeadId(null);
    }
  };

  const saveProfile = async (): Promise<void> => {
    if (readOnly) return;
    if (city.trim().length < 2 || state.trim().length !== 2) {
      setNotice("Informe cidade e UF para salvar o perfil.");
      return;
    }
    setSavingProfile(true);
    setNotice(null);
    try {
      await onUpdateProfessional({
        whatsapp,
        city,
        state,
        bio,
        standardMessage,
        templates: fullCrm
          ? templatesText
              .split("\n")
              .map((template) => template.trim())
              .filter(Boolean)
              .slice(0, 10)
          : [],
      });
      setNotice("Perfil atualizado com sucesso.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
      <header className="grid gap-5 border-b border-slate-200 pb-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
            Portal profissional
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">
            {professional.name}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Captação, contato e evolução dos seus leads em um único lugar.
          </p>
        </div>
        <div className="min-w-64 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                Plano {planName(planConfig.tier)}
              </p>
              <p className="mt-1 text-sm font-black text-blue-900">
                {currentUsage} de {usageLimit} triagens
              </p>
            </div>
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </header>

      {notice && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {notice}
        </div>
      )}

      {readOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
          <Eye className="h-5 w-5 shrink-0" />
          Visualização administrativa da HQ. Você está vendo o painel deste profissional em modo somente leitura.
        </div>
      )}

      {professional.status === "trial" && professional.trialEndsAt && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
          <Clock className="h-5 w-5 shrink-0" />
          Seu período de demonstração termina em {new Date(professional.trialEndsAt).toLocaleDateString("pt-BR")}. Aproveite para configurar seu perfil e conversar com seus leads.
        </div>
      )}
      {professional.status === "inactive" && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-700">O acesso está pausado. Fale com a administração para reativar sua conta.</div>
      )}

      <nav className="flex flex-wrap gap-2">
        <TabButton
          active={tab === "dashboard"}
          icon={<BarChart3 className="h-4 w-4" />}
          label="Visão geral"
          onClick={() => setTab("dashboard")}
        />
        <TabButton
          active={tab === "leads"}
          icon={<Users className="h-4 w-4" />}
          label="Leads"
          onClick={() => setTab("leads")}
        />
        <TabButton
          active={tab === "profile"}
          icon={<Settings className="h-4 w-4" />}
          label="Configurações"
          onClick={() => setTab("profile")}
        />
        <TabButton
          active={tab === "post"}
          icon={<Instagram className="h-4 w-4" />}
          label="Post do Dia"
          onClick={() => setTab("post")}
        />
      </nav>

      {tab === "dashboard" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Novos" value={counts.new} color="text-blue-600" />
            <Kpi
              label="Em conversa"
              value={counts.in_chat}
              color="text-indigo-600"
            />
            <Kpi
              label="Agendados"
              value={counts.scheduled}
              color="text-emerald-600"
            />
            <Kpi
              label="Convertidos"
              value={counts.closed}
              color="text-violet-600"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <article className="rounded-[2rem] bg-blue-600 p-7 text-white">
              <Instagram className="h-6 w-6" />
              <h2 className="mt-5 text-xl font-black">Post do dia</h2>
              <p className="mt-3 text-sm font-medium leading-relaxed text-blue-50">
                Cuidar do sorriso também começa com consciência. Faça sua
                triagem visual pelo link da minha bio e converse comigo sobre o
                próximo passo.
              </p>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(
                    "Cuidar do sorriso também começa com consciência. Faça sua triagem visual pelo link da minha bio e converse comigo sobre o próximo passo.",
                  );
                  setNotice("Legenda copiada.");
                }}
                className="mt-6 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-blue-600"
              >
                <Copy className="h-4 w-4" /> Copiar
              </button>
            </article>

            <article className="rounded-[2rem] border border-slate-100 bg-white p-7">
              <Clock className="h-6 w-6 text-amber-500" />
              <h2 className="mt-5 text-xl font-black">Contato pendente</h2>
              {priorityLead ? (
                <>
                  <p className="mt-3 text-lg font-black">
                    {priorityLead.lead.name}
                  </p>
                  {priorityLead.contactRequestedAtMs && (
                    <span className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700">
                      Pediu para receber contato
                    </span>
                  )}
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Aguardando desde{" "}
                    {new Date(priorityLead.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {!readOnly && <button
                    onClick={() => void openWhatsApp(priorityLead)}
                    className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
                  >
                    <Phone className="h-4 w-4" /> Abrir WhatsApp
                  </button>}
                </>
              ) : (
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Nenhum novo lead aguardando contato.
                </p>
              )}
            </article>

            <article className="rounded-[2rem] border border-slate-100 bg-white p-7">
              <Link2 className="h-6 w-6 text-blue-600" />
              <h2 className="mt-5 text-xl font-black">Seu link de captação</h2>
              <p className="mt-3 break-all rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
                {publicUrl}
              </p>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(publicUrl);
                  setNotice("Link copiado.");
                }}
                className="mt-5 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
              >
                <Copy className="h-4 w-4" /> Copiar link
              </button>
            </article>
          </div>

          {fullCrm && (
            <div className="grid gap-5 md:grid-cols-2">
              <article className="rounded-[2rem] border border-slate-100 bg-white p-7">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Tempo médio até o primeiro contato
                </p>
                <p className="mt-3 text-4xl font-black">
                  {responseStats.averageMinutes} min
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Calculado apenas com leads que já receberam contato.
                </p>
              </article>
              <article className="rounded-[2rem] border border-slate-100 bg-white p-7">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Conversão registrada
                </p>
                <p className="mt-3 text-4xl font-black text-emerald-600">
                  {responseStats.conversion}%
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Convertidos entre os leads encerrados no funil.
                </p>
              </article>
            </div>
          )}

          {planConfig.features.assistantPreview && (
            <article className="rounded-[2rem] bg-slate-900 p-7 text-white">
              <div className="flex items-start gap-4">
                <Sparkles className="mt-1 h-7 w-7 shrink-0 text-blue-400" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                    Network
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    Gestão avançada da operação
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-white/60">
                    Indicadores por profissional, atribuição de leads e recursos
                    de equipe ficam disponíveis no painel da clínica. O portal
                    do dentista continua dedicado à execução individual.
                  </p>
                </div>
              </div>
            </article>
          )}
        </section>
      )}

      {tab === "leads" && (
        <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white">
          <header className="grid gap-4 border-b border-slate-100 bg-slate-50 p-6 md:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou WhatsApp"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
            />
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as LeadStatus | "all")
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
            >
              <option value="all">Todos os status</option>
              {(Object.keys(statusLabel) as LeadStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusLabel[status]}
                </option>
              ))}
            </select>
          </header>
          {leads.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-200" />
              <p className="mt-4 font-bold text-slate-500">
                Nenhum lead encontrado.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <article
                  key={lead.id}
                  className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-black">{lead.lead.name}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass[lead.status]}`}
                      >
                        {statusLabel[lead.status]}
                      </span>
                      {lead.contactRequestedAtMs && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700">
                          Pediu contato
                        </span>
                      )}
                      {lead.patientOpenedWhatsAppAtMs && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                          Iniciou conversa
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {lead.lead.whatsapp} ·{" "}
                      {new Date(lead.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={lead.status}
                      disabled={readOnly || busyLeadId === lead.id}
                      onChange={(event) =>
                        void changeStatus(
                          lead,
                          event.target.value as LeadStatus,
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                    >
                      {(Object.keys(statusLabel) as LeadStatus[])
                        .filter(
                          (status) => status !== "scheduled" || schedulingEnabled,
                        )
                        .map((status) => (
                          <option key={status} value={status}>
                            {statusLabel[status]}
                          </option>
                        ))}
                    </select>
                    <IconButton
                      label="Ver triagem"
                      icon={<Eye className="h-4 w-4" />}
                      onClick={() => setSelectedLead(lead)}
                    />
                    {!readOnly && <IconButton
                      label="Abrir WhatsApp"
                      icon={<Phone className="h-4 w-4" />}
                      onClick={() => void openWhatsApp(lead)}
                      green
                    />}
                    {busyLeadId === lead.id && (
                      <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "post" && (
        <section className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
          <article className="rounded-[2rem] bg-blue-600 p-8 text-white">
            <Instagram className="h-7 w-7" />
            <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-blue-100">Post do Dia</p>
            <h2 className="mt-2 text-3xl font-black">Seu próximo conteúdo para atrair conversas</h2>
            <p className="mt-4 text-sm font-medium leading-relaxed text-blue-50">“Um sorriso saudável começa com uma avaliação que olha para você por inteiro. Faça seu mapa do sorriso e converse comigo sobre os próximos passos.”</p>
            <button onClick={() => navigator.clipboard?.writeText("Um sorriso saudável começa com uma avaliação que olha para você por inteiro. Faça seu mapa do sorriso e converse comigo sobre os próximos passos.")} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-blue-700"><Copy className="h-4 w-4" /> Copiar legenda</button>
          </article>
          <article className="rounded-[2rem] border border-slate-100 bg-white p-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">CTA sugerida</p>
            <p className="mt-4 text-lg font-black text-slate-900">“Envie uma mensagem e descubra o que seu sorriso pode melhorar.”</p>
            <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">Use o link público do seu perfil nas redes sociais: {publicUrl}</p>
          </article>
        </section>
      )}

      {tab === "profile" && (
        <section className="mx-auto max-w-3xl space-y-6 rounded-[2rem] border border-slate-100 bg-white p-7 md:p-9">
          <div className="flex items-center gap-4">
            <span className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <User className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-2xl font-black">Perfil profissional</h2>
              <p className="text-sm font-medium text-slate-500">
                Dados exibidos no link e usados no contato com os leads.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="WhatsApp">
              <input
                value={whatsapp}
                disabled={readOnly}
                onChange={(event) => setWhatsapp(formatPhone(event.target.value))}
                className="input"
              />
            </Field>
            <Field label="Link público">
              <input
                readOnly
                value={publicUrl}
                className="input cursor-not-allowed text-slate-400"
              />
            </Field>
            <Field label="Cidade">
              <input
                value={city}
                disabled={readOnly}
                onChange={(event) => setCity(event.target.value)}
                className="input"
              />
            </Field>
            <Field label="UF">
              <input
                value={state}
                disabled={readOnly}
                maxLength={2}
                onChange={(event) =>
                  setState(event.target.value.toUpperCase().slice(0, 2))
                }
                className="input"
              />
            </Field>
          </div>
          <Field label="Apresentação curta">
            <textarea
              value={bio}
              disabled={readOnly}
              maxLength={400}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              className="input resize-none"
            />
          </Field>
          <Field label="Mensagem padrão do WhatsApp">
            <textarea
              value={standardMessage}
              disabled={readOnly}
              maxLength={500}
              onChange={(event) => setStandardMessage(event.target.value)}
              rows={4}
              className="input resize-none"
            />
            <p className="mt-2 text-xs font-medium text-slate-400">
              Variáveis disponíveis: [NOME], [SCORE] e [STATUS].
            </p>
          </Field>
          {planConfig.features.whatsappTemplates && (
            <Field label="Templates adicionais — um por linha">
              <textarea
                value={templatesText}
                disabled={readOnly}
                onChange={(event) => setTemplatesText(event.target.value)}
                rows={6}
                className="input resize-none"
              />
            </Field>
          )}
          {!readOnly && <button
            disabled={savingProfile}
            onClick={() => void saveProfile()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {savingProfile ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Salvar perfil
          </button>}
        </section>
      )}

      {scheduleLead && (
        <Modal onClose={() => setScheduleLead(null)}>
          <CalendarClock className="h-8 w-8 text-blue-600" />
          <h2 className="mt-4 text-2xl font-black">Registrar agendamento</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {scheduleLead.lead.name}
          </p>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
            className="input mt-6"
          />
          <button
            onClick={() => void confirmSchedule()}
            className="mt-5 w-full rounded-xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white"
          >
            Confirmar
          </button>
        </Modal>
      )}

      {selectedLead && (
        <Modal onClose={() => setSelectedLead(null)} wide>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <FileText className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-black">Resumo da triagem</h2>
                <p className="text-sm font-medium text-slate-500">
                  {selectedLead.lead.name}
                </p>
              </div>
            </div>
          </div>
          {selectedLead.scores && (
            <div className="mt-7 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Score
                  label="Harmonia visual"
                  value={selectedLead.scores.harmonyIndex}
                />
                <Score
                  label="Brilho aparente"
                  value={selectedLead.scores.brightnessIndex}
                />
              </div>
              {fullCrm && (
                <>
                  <div className="rounded-2xl bg-slate-900 p-6 text-white">
                    <p className="text-sm font-bold leading-relaxed text-blue-300">
                      {selectedLead.scores.recommendation}
                    </p>
                    <div className="mt-5 space-y-3">
                      {selectedLead.scores.observations.map((observation) => (
                        <p
                          key={observation}
                          className="flex gap-2 text-sm font-medium text-white/65"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          {observation}
                        </p>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-slate-400">
                    A foto não é armazenada. O painel contém apenas o resumo
                    textual e as métricas informativas.
                  </p>
                </>
              )}
              {!readOnly ? <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void openWhatsApp(selectedLead)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-xs font-black uppercase tracking-widest text-white"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
                <button
                  disabled={busyLeadId === selectedLead.id}
                  onClick={() => void deleteLead(selectedLead)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-100 py-4 text-xs font-black uppercase tracking-widest text-red-600"
                >
                  <Trash2 className="h-4 w-4" /> Excluir dados
                </button>
              </div> : <p className="rounded-xl bg-blue-50 p-4 text-center text-xs font-black uppercase tracking-widest text-blue-700">Ações de contato e exclusão bloqueadas na visualização HQ</p>}
            </div>
          )}
        </Modal>
      )}
    </main>
  );
};

const TabButton = ({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest ${
      active
        ? "bg-slate-900 text-white"
        : "border border-slate-200 bg-white text-slate-500"
    }`}
  >
    {icon} {label}
  </button>
);

const Kpi = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <article className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
  </article>
);

const IconButton = ({
  label,
  icon,
  onClick,
  green = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  green?: boolean;
}) => (
  <button
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`rounded-xl border p-2.5 ${
      green
        ? "border-emerald-100 text-emerald-600 hover:bg-emerald-50"
        : "border-slate-200 text-blue-600 hover:bg-blue-50"
    }`}
  >
    {icon}
  </button>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </span>
    {children}
  </label>
);

const Score = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl bg-slate-50 p-5 text-center">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-2 text-3xl font-black text-blue-600">{value}/100</p>
  </div>
);

const Modal = ({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
    <section
      className={`relative max-h-[90vh] w-full overflow-y-auto rounded-[2rem] bg-white p-7 shadow-2xl ${
        wide ? "max-w-2xl" : "max-w-md"
      }`}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 rounded-xl p-2 text-slate-400 hover:bg-slate-100"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      {children}
    </section>
  </div>
);
