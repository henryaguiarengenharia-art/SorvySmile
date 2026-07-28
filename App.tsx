import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Smile,
  Sparkles,
  Users,
} from "lucide-react";
import { PatientJourney } from "./components/PatientJourney";
import {
  AppView,
  PlanTier,
  PublicProfessionalProfile,
  WorkspaceUser,
} from "./types";
import {
  changeAccountStatus,
  deleteLeadRecord,
  getPublicProfile,
  loginWorkspace,
  logoutWorkspace,
  requestPasswordReset,
  registerPendingSubscription,
  restoreWorkspaceSession,
  saveProfessionalProfile,
  subscribeWorkspace,
  updateLeadCrm,
  WorkspaceData,
} from "./services/sorvyApi";
import { isFirebaseConfigured } from "./services/firebaseClient";
import {
  paymentUrlFor,
  PLAN_CONFIGS,
  PLAN_COPY,
} from "./planCatalog";

const DentistPortalView = React.lazy(() =>
  import("./components/DentistPortalView").then((module) => ({
    default: module.DentistPortalView,
  })),
);
const HQDashboardView = React.lazy(() =>
  import("./components/HQDashboardView").then((module) => ({
    default: module.HQDashboardView,
  })),
);

const DEFAULT_SLUG =
  String(import.meta.env.VITE_DEFAULT_PROFESSIONAL_SLUG ?? "")
    .trim()
    .toLowerCase();

function resolveSlug(): string | null {
  const pathMatch = window.location.pathname.match(/^\/p\/([a-z0-9-]+)\/?$/i);
  if (pathMatch) return pathMatch[1].toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const explicitSlug = (
    params.get("p")
    || params.get("d")
    || params.get("c")
    || ""
  ).trim();
  return explicitSlug ? explicitSlug.toLowerCase() : DEFAULT_SLUG || null;
}

function resolveInitialView(): AppView {
  if (window.location.pathname.startsWith("/planos")) return "pricing";
  if (window.location.pathname.startsWith("/privacidade")) return "privacy";
  if (window.location.pathname.startsWith("/termos-assinante")) {
    return "subscriber-terms";
  }
  return "landing";
}

interface PendingRegistration {
  accountId: string;
  name: string;
  email: string;
  whatsapp: string;
  plan: PlanTier;
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(resolveInitialView);
  const [profile, setProfile] = useState<PublicProfessionalProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [workspaceUser, setWorkspaceUser] = useState<WorkspaceUser | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const workspaceUnsubscribe = useRef<(() => void) | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>("pro");
  const [pendingRegistration, setPendingRegistration] =
    useState<PendingRegistration | null>(null);

  const slug = useMemo(resolveSlug, []);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }
    if (!isFirebaseConfigured) {
      setProfileLoading(false);
      setProfileError(
        "O ambiente Firebase ainda precisa ser conectado para liberar a triagem.",
      );
      return;
    }
    getPublicProfile(slug)
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setProfileError(
          result ? null : "Este link profissional ainda não está ativo.",
        );
      })
      .catch((error: Error) => {
        if (!cancelled) setProfileError(error.message);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(
    () => () => {
      workspaceUnsubscribe.current?.();
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const initialView = resolveInitialView();
    if (
      !isFirebaseConfigured
      || Boolean(slug)
      || (initialView !== "landing" && initialView !== "login")
    ) {
      return undefined;
    }
    void restoreWorkspaceSession().then(async (user) => {
      if (!user || cancelled) return;
      setWorkspaceUser(user);
      workspaceUnsubscribe.current?.();
      workspaceUnsubscribe.current = await subscribeWorkspace(
        user,
        setWorkspace,
        setPageError,
      );
      if (!cancelled) {
        setView(user.role === "hq" ? "hq-dashboard" : "dentist-portal");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const openWhatsApp = (number: string, message: string) => {
    const digits = number.replace(/\D/g, "");
    if (!digits) return;
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleLogin = async (email: string, password: string) => {
    const user = await loginWorkspace(email, password);
    setWorkspaceUser(user);
    workspaceUnsubscribe.current?.();
    workspaceUnsubscribe.current = await subscribeWorkspace(
      user,
      setWorkspace,
      setPageError,
    );
    setView(user.role === "hq" ? "hq-dashboard" : "dentist-portal");
  };

  const handleLogout = async () => {
    workspaceUnsubscribe.current?.();
    workspaceUnsubscribe.current = null;
    setWorkspace(null);
    setWorkspaceUser(null);
    await logoutWorkspace();
    setView("landing");
  };

  const currentProfessional = workspaceUser?.professionalId
    ? workspace?.professionals.find(
        (item) => item.id === workspaceUser.professionalId,
      )
    : undefined;
  const currentAccount = workspaceUser?.accountId
    ? workspace?.accounts[workspaceUser.accountId]
    : undefined;
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);
  const currentUsage = workspaceUser?.accountId
    ? workspace?.usageByAccount[workspaceUser.accountId]?.[currentMonth] ?? 0
    : 0;

  const showPublicNav = ![
    "patient",
    "dentist-portal",
    "hq-dashboard",
  ].includes(view);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showPublicNav && (
        <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/95 px-5 backdrop-blur-md">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between">
            <button
              onClick={() => setView("landing")}
              className="flex items-center gap-2"
            >
              <span className="rounded-xl bg-blue-600 p-2 text-white">
                <Smile className="h-5 w-5" />
              </span>
              <span className="hidden text-lg font-black uppercase tracking-tight sm:inline">
                Sorvy Smile
              </span>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setView("landing")}
                className="hidden rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 sm:block"
              >
                Como funciona
              </button>
              <button
                onClick={() => setView("pricing")}
                className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:text-blue-600"
              >
                Planos
              </button>
              <button
                onClick={() => setView("login")}
                className="rounded-xl px-3 py-2 text-xs font-black text-slate-900 hover:text-blue-600"
              >
                <span className="sm:hidden">Entrar</span>
                <span className="hidden sm:inline">Acesso Pro</span>
              </button>
            </div>
          </div>
        </nav>
      )}

      {profileError && view === "landing" && (
        <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm font-bold text-amber-800">
          {profileError}
        </div>
      )}

      {pageError && view !== "patient" && (
        <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm font-bold text-amber-800">
          {pageError}
        </div>
      )}

      {view === "landing" && (
        <LandingView
          profile={profile}
          loading={profileLoading}
          onStart={() => profile && setView("patient")}
          onPlans={() => setView("pricing")}
        />
      )}

      {view === "patient" && profile && (
        <PatientJourney profile={profile} onExit={() => setView("landing")} />
      )}

      {view === "pricing" && (
        <PricingView
          onSelect={(plan) => {
            setSelectedPlan(plan);
            setView("checkout-pix");
          }}
        />
      )}

      {view === "checkout-pix" && (
        <CheckoutView
          plan={selectedPlan}
          onBack={() => setView("pricing")}
          onCreated={(registration) => {
            setPendingRegistration(registration);
            setView("checkout-confirm");
          }}
        />
      )}

      {view === "checkout-confirm" && pendingRegistration && (
        <PaymentInstructionsView
          registration={pendingRegistration}
          onFinished={() => setView("checkout-done")}
        />
      )}

      {view === "checkout-done" && (
        <CheckoutReturnView onLogin={() => setView("login")} />
      )}

      {view === "privacy" && (
        <LegalView type="privacy" onBack={() => setView("landing")} />
      )}

      {view === "subscriber-terms" && (
        <LegalView type="terms" onBack={() => setView("landing")} />
      )}

      {view === "login" && (
        <LoginView onLogin={handleLogin} onBack={() => setView("landing")} />
      )}

      {view === "dentist-portal" && workspace && currentProfessional && currentAccount && (
        <DashboardShell title={currentProfessional.name} onLogout={handleLogout}>
          <React.Suspense fallback={<DashboardLoading />}>
            <DentistPortalView
              leadRecords={workspace.leads}
              professional={currentProfessional}
              planConfig={PLAN_CONFIGS[currentAccount.tier]}
              currentUsage={currentUsage}
              onUpdateLead={(id, patch) =>
                updateLeadCrm(id, patch).catch((error: Error) => {
                  setPageError(error.message);
                  throw error;
                })
              }
              onUpdateProfessional={(patch) =>
                saveProfessionalProfile(patch).catch((error: Error) => {
                  setPageError(error.message);
                  throw error;
                })
              }
              onDeleteLead={(id) =>
                deleteLeadRecord(id).catch((error: Error) => {
                  setPageError(error.message);
                  throw error;
                })
              }
            />
          </React.Suspense>
        </DashboardShell>
      )}

      {view === "hq-dashboard" && workspace && (
        <DashboardShell title="Administração Sorvy" onLogout={handleLogout}>
          <React.Suspense fallback={<DashboardLoading />}>
            <HQDashboardView
              leadRecords={workspace.leads}
              billingAccounts={workspace.accounts}
              usageByAccount={workspace.usageByAccount}
              planConfigs={PLAN_CONFIGS}
              onUpdateBilling={(id, status, plan) =>
                changeAccountStatus(id, status, plan).catch((error: Error) => {
                  setPageError(error.message);
                  throw error;
                })
              }
              onOpenWhatsApp={openWhatsApp}
            />
          </React.Suspense>
        </DashboardShell>
      )}

      {showPublicNav && (
        <footer className="border-t border-slate-100 bg-white px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 text-xs font-bold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Sorvy Smile · Triagem informativa</p>
            <div className="flex gap-5">
              <button
                onClick={() => setView("privacy")}
                className="hover:text-blue-600"
              >
                Privacidade
              </button>
              <button
                onClick={() => setView("subscriber-terms")}
                className="hover:text-blue-600"
              >
                Termos do Assinante
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

const LandingView = ({
  profile,
  loading,
  onStart,
  onPlans,
}: {
  profile: PublicProfessionalProfile | null;
  loading: boolean;
  onStart: () => void;
  onPlans: () => void;
}) => (
  <main>
    <section className="mx-auto max-w-6xl px-6 py-20 text-center">
      <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
        <Sparkles className="h-4 w-4" /> Triagem estética informativa
      </div>
      <h1 className="mx-auto max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter md:text-8xl">
        Transforme curiosidade em uma{" "}
        <span className="text-blue-600">conversa profissional.</span>
      </h1>
      <p className="mx-auto mt-7 max-w-2xl text-lg font-medium leading-relaxed text-slate-500">
        Uma experiência visual rápida para conhecer melhor o sorriso e facilitar
        o próximo passo com o cirurgião-dentista.
      </p>
      {profile && (
        <p className="mt-4 text-sm font-bold text-slate-400">
          Experiência oferecida por {profile.name}
        </p>
      )}
      <button
        disabled={loading}
        onClick={profile ? onStart : onPlans}
        className="mx-auto mt-9 flex items-center gap-3 rounded-3xl bg-slate-900 px-10 py-6 text-base font-black text-white shadow-2xl transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <Smile className="h-5 w-5" />
        )}
        {profile ? "Iniciar triagem gratuita" : "Conhecer planos"}
      </button>
      <div className="mt-8 flex flex-wrap justify-center gap-5 text-xs font-bold text-slate-400">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Foto não é salva no painel
        </span>
        <span className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-emerald-500" />
          Consentimento explícito
        </span>
        <span className="flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-500" />
          Não substitui avaliação clínica
        </span>
      </div>
    </section>

    <section className="border-y border-slate-100 bg-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-blue-600">
          Como a Sorvy Smile ajuda meu negócio?
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <Sparkles className="h-6 w-6" />,
              title: "O paciente recebe",
              text: "Uma triagem visual informativa, simples e personalizada, antes da conversa.",
            },
            {
              icon: <Users className="h-6 w-6" />,
              title: "Você recebe",
              text: "Nome, WhatsApp, consentimento e contexto da triagem no mesmo painel.",
            },
            {
              icon: <LayoutDashboard className="h-6 w-6" />,
              title: "No dia a dia",
              text: "CRM, histórico, templates e acompanhamento do primeiro contato ao agendamento.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-[2rem] border border-slate-100 bg-slate-50 p-7"
            >
              <div className="mb-5 inline-flex rounded-2xl bg-blue-600 p-3 text-white">
                {item.icon}
              </div>
              <h2 className="text-xl font-black">{item.title}</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                {item.text}
              </p>
            </article>
          ))}
        </div>
        <button
          onClick={onPlans}
          className="mx-auto mt-9 flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black text-white hover:bg-blue-700"
        >
          Ver planos e preços <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  </main>
);

const PricingView = ({
  onSelect,
}: {
  onSelect: (plan: PlanTier) => void;
}) => (
  <main className="mx-auto max-w-6xl px-6 py-16">
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
        Simples e progressivo
      </p>
      <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
        Um plano para cada fase.
      </h1>
      <p className="mx-auto mt-4 max-w-xl font-medium text-slate-500">
        Sem marketplace, distribuição de rede ou cobrança por assento. Você
        escolhe o nível de captação e automação.
      </p>
    </div>
    <div className="mt-12 grid gap-6 lg:grid-cols-3">
      {(Object.keys(PLAN_CONFIGS) as PlanTier[]).map((tier) => {
        const plan = PLAN_CONFIGS[tier];
        const copy = PLAN_COPY[tier];
        const highlighted = tier === "pro";
        return (
          <article
            key={tier}
            className={`relative rounded-[2.5rem] border p-8 ${
              highlighted
                ? "border-blue-600 bg-slate-900 text-white shadow-2xl"
                : "border-slate-100 bg-white"
            }`}
          >
            {highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                Recomendado
              </span>
            )}
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">
              {copy.name}
            </p>
            <h2 className="mt-3 text-2xl font-black">{copy.tagline}</h2>
            <p className="mt-6 text-4xl font-black">
              R$ {plan.price}
              <span className="text-sm font-bold opacity-40">/mês</span>
            </p>
            <div className="my-7 h-px bg-current opacity-10" />
            <ul className="space-y-4">
              {copy.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm font-bold">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onSelect(tier)}
              className={`mt-9 w-full rounded-2xl py-4 text-xs font-black uppercase tracking-widest ${
                highlighted
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-slate-900 text-white hover:bg-blue-600"
              }`}
            >
              Escolher {copy.name}
            </button>
          </article>
        );
      })}
    </div>
    <p className="mt-8 text-center text-xs font-medium text-slate-400">
      O assistente automatizado do Elite será liberado por etapas após validação
      do fluxo principal.
    </p>
  </main>
);

const CheckoutView = ({
  plan,
  onBack,
  onCreated,
}: {
  plan: PlanTier;
  onBack: () => void;
  onCreated: (registration: PendingRegistration) => void;
}) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    specialty: "",
    password: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accepted) {
      setError("Aceite os Termos do Assinante para continuar.");
      return;
    }
    if (form.password.length < 10) {
      setError("A senha deve ter pelo menos 10 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const subscription = await registerPendingSubscription({ ...form, plan });
      onCreated({
        accountId: subscription.accountId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp,
        plan,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível criar a solicitação.",
      );
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <button onClick={onBack} className="mb-6 text-sm font-black text-slate-500">
        ← Voltar aos planos
      </button>
      <form
        onSubmit={submit}
        className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl"
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
            Plano {PLAN_COPY[plan].name}
          </p>
          <h1 className="mt-2 text-3xl font-black">Criar sua conta</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            R$ {PLAN_CONFIGS[plan].price}/mês. Depois do cadastro você verá o
            link de pagamento e enviará o comprovante para validação.
          </p>
        </div>
        {[
          ["name", "Nome profissional ou clínica", "text"],
          ["email", "Email de acesso", "email"],
          ["whatsapp", "WhatsApp com DDD", "tel"],
          ["specialty", "Especialidade (opcional)", "text"],
          ["password", "Senha (mínimo 10 caracteres)", "password"],
        ].map(([field, label, type]) => (
          <label key={field} className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {label}
            </span>
            <input
              required={field !== "specialty"}
              type={type}
              value={form[field as keyof typeof form]}
              onChange={(event) =>
                setForm({ ...form, [field]: event.target.value })
              }
              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 font-bold outline-none focus:border-blue-500"
            />
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 h-5 w-5"
          />
          <span className="text-xs font-bold leading-relaxed text-slate-600">
            Li e aceito os{" "}
            <a
              href="/termos-assinante"
              className="text-blue-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              Termos do Assinante
            </a>
            , a contratação mensal e a{" "}
            <a
              href="/privacidade"
              className="text-blue-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              Política de Privacidade
            </a>
            .
          </span>
        </label>
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
          Criar conta e ver pagamento
        </button>
      </form>
    </main>
  );
};

const PaymentInstructionsView = ({
  registration,
  onFinished,
}: {
  registration: PendingRegistration;
  onFinished: () => void;
}) => {
  const paymentUrl = paymentUrlFor(registration.plan);
  const salesWhatsapp = String(
    import.meta.env.VITE_SALES_WHATSAPP ?? "",
  ).replace(/\D/g, "");
  const [paymentOpened, setPaymentOpened] = useState(false);

  const sendReceipt = (): void => {
    if (!salesWhatsapp) return;
    const message = [
      "Olá! Fiz o pagamento da Sorvy Smile e quero solicitar a ativação.",
      `Conta: ${registration.accountId}`,
      `Nome: ${registration.name}`,
      `Email: ${registration.email}`,
      `Plano: ${PLAN_COPY[registration.plan].name}`,
      "Vou anexar o comprovante nesta conversa.",
    ].join("\n");
    window.open(
      `https://wa.me/${salesWhatsapp}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    onFinished();
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <section className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <CreditCard className="h-7 w-7" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
            Conta criada · ativação pendente
          </p>
          <h1 className="mt-2 text-3xl font-black">Concluir pagamento</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">
            Pague o plano {PLAN_COPY[registration.plan].name} no ambiente
            seguro do provedor. Depois, envie o comprovante para a Sorvy
            conferir e liberar seu painel e link profissional.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Mensalidade selecionada
          </p>
          <p className="mt-2 text-2xl font-black">
            R$ {PLAN_CONFIGS[registration.plan].price}/mês
          </p>
          <p className="mt-1 break-all text-xs font-bold text-slate-500">
            Referência: {registration.accountId}
          </p>
        </div>

        {paymentUrl ? (
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setPaymentOpened(true)}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-sm font-black uppercase tracking-widest text-white hover:bg-blue-700"
          >
            <CreditCard className="h-5 w-5" />
            Abrir pagamento seguro
          </a>
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            O link deste plano ainda precisa ser confirmado pela Sorvy antes
            da publicação.
          </p>
        )}

        <button
          type="button"
          disabled={!salesWhatsapp || !paymentOpened}
          onClick={sendReceipt}
          className="w-full rounded-2xl border-2 border-emerald-200 py-4 text-xs font-black uppercase tracking-widest text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Já paguei · enviar comprovante
        </button>
        <p className="text-center text-xs font-medium leading-relaxed text-slate-400">
          A conta permanece bloqueada até a conferência. Nunca envie senha,
          cartão ou código de segurança pelo WhatsApp.
        </p>
      </section>
    </main>
  );
};

const CheckoutReturnView = ({ onLogin }: { onLogin: () => void }) => (
  <main className="mx-auto max-w-xl px-6 py-20 text-center">
    <div className="rounded-[3rem] border border-slate-100 bg-white p-10 shadow-xl">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <h1 className="mt-7 text-4xl font-black">Solicitação enviada</h1>
      <p className="mt-4 font-medium leading-relaxed text-slate-500">
        A Sorvy conferirá o comprovante e ativará sua conta pelo painel
        administrativo. Você receberá a confirmação pelo canal de atendimento.
      </p>
      <button
        onClick={onLogin}
        className="mt-8 w-full rounded-2xl bg-slate-900 py-5 text-sm font-black uppercase tracking-widest text-white hover:bg-blue-600"
      >
        Acessar meu painel
      </button>
    </div>
  </main>
);

const LegalView = ({
  type,
  onBack,
}: {
  type: "privacy" | "terms";
  onBack: () => void;
}) => {
  const privacyEmail = String(
    import.meta.env.VITE_PRIVACY_CONTACT_EMAIL
      ?? "henry.aguiar.engenharia@gmail.com",
  ).trim();
  const isPrivacy = type === "privacy";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <button onClick={onBack} className="mb-6 text-sm font-black text-slate-500">
        ← Voltar
      </button>
      <article className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl md:p-12">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
          Versão 2026-07
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">
          {isPrivacy ? "Política de Privacidade" : "Termos do Assinante"}
        </h1>

        {isPrivacy ? (
          <div className="mt-8 space-y-7 text-sm font-medium leading-relaxed text-slate-600">
            <LegalSection title="1. Escopo">
              Esta política explica o tratamento de dados na triagem visual da
              Sorvy Smile e nos painéis de profissionais. A triagem é
              informativa e não constitui diagnóstico, prescrição ou consulta
              odontológica.
            </LegalSection>
            <LegalSection title="2. Dados e finalidades">
              Processamos a fotografia do sorriso, confirmações de
              consentimento, nome, WhatsApp, resultado visual, dados técnicos
              de segurança e informações da conta profissional. A foto serve
              apenas para validar e gerar a leitura solicitada; nome e WhatsApp
              permitem compartilhar o resultado com o profissional do link e
              realizar o contato autorizado.
            </LegalSection>
            <LegalSection title="3. Consentimento e maioridade">
              A foto pode revelar dado de saúde e, por isso, só é processada
              após consentimento específico e destacado. A experiência é
              destinada a maiores de 18 anos que utilizem uma foto própria.
              O consentimento para contato é separado e pode ser revogado.
            </LegalSection>
            <LegalSection title="4. Fornecedores e transferência internacional">
              Firebase/Google Cloud hospedam autenticação, banco e Functions.
              A fotografia é enviada temporariamente à API paga do Google
              Gemini para a análise solicitada e pode envolver processamento
              internacional conforme os contratos e medidas do fornecedor.
            </LegalSection>
            <LegalSection title="5. Armazenamento e retenção">
              A Sorvy não grava a fotografia no Firestore, Storage ou painel.
              A sessão de triagem expira em 30 minutos. O registro do lead,
              resultado e consentimentos é mantido por até 12 meses, salvo
              obrigação legal ou pedido de exclusão aplicável. Logs técnicos
              do provedor podem seguir os prazos de segurança contratados.
            </LegalSection>
            <LegalSection title="6. Direitos do titular">
              O titular pode pedir confirmação, acesso, correção, informação,
              portabilidade quando aplicável, revogação do consentimento e
              eliminação dos dados tratados com base no consentimento. A
              exclusão também pode ser feita pelo profissional no painel.
            </LegalSection>
            <LegalSection title="7. Contato e segurança">
              Aplicamos isolamento por conta, autenticação, App Check, limites
              no servidor e acesso restrito. Nenhuma transmissão é isenta de
              risco. Solicitações de privacidade podem ser enviadas para{" "}
              <a
                className="font-black text-blue-600 underline"
                href={`mailto:${privacyEmail}`}
              >
                {privacyEmail}
              </a>
              .
            </LegalSection>
          </div>
        ) : (
          <div className="mt-8 space-y-7 text-sm font-medium leading-relaxed text-slate-600">
            <LegalSection title="1. Serviço">
              A Sorvy Smile oferece link de triagem visual informativa, captação
              consentida e painel de acompanhamento para profissionais e
              clínicas odontológicas. O serviço não promete diagnóstico,
              quantidade de pacientes, faturamento ou resultado comercial.
            </LegalSection>
            <LegalSection title="2. Planos e limites">
              Lite, Pro e Elite possuem preços e limites mensais
              exibidos na contratação. O Elite inclui recursos de automação
              liberados por etapas; funcionalidades ainda em validação são
              identificadas no produto e não devem ser tratadas como ativas.
            </LegalSection>
            <LegalSection title="3. Pagamento e ativação">
              A solicitação cria uma conta pendente. O pagamento ocorre no link
              externo indicado e a ativação é feita pela Sorvy após conferência
              do comprovante. Renovação, cancelamento, reembolso e vencimento
              seguem as condições exibidas pelo provedor de pagamento e
              confirmadas no atendimento comercial.
            </LegalSection>
            <LegalSection title="4. Responsabilidades do assinante">
              O assinante deve proteger suas credenciais, manter os dados do
              perfil corretos, contatar apenas pessoas que autorizaram o contato
              e conduzir qualquer avaliação clínica de acordo com as normas
              profissionais. É proibido usar o serviço para diagnóstico
              automático, discriminação, spam ou tratamento de fotos de
              terceiros sem autorização.
            </LegalSection>
            <LegalSection title="5. Disponibilidade e suspensão">
              O acesso pode ser limitado ao atingir a cota, por inadimplência,
              risco de segurança ou uso indevido. Manutenções e fornecedores
              externos podem causar indisponibilidade temporária. Mudanças
              materiais de preço ou termos devem ser comunicadas antes de
              produzir efeitos sobre a renovação.
            </LegalSection>
            <LegalSection title="6. Dados e encerramento">
              O tratamento de dados segue a Política de Privacidade. Ao
              encerrar a conta, os dados são eliminados ou anonimizados conforme
              os prazos aplicáveis, ressalvadas obrigações legais e registros
              necessários ao exercício de direitos.
            </LegalSection>
          </div>
        )}
      </article>
    </main>
  );
};

const LegalSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section>
    <h2 className="text-base font-black text-slate-900">{title}</h2>
    <p className="mt-2">{children}</p>
  </section>
);

const LoginView = ({
  onLogin,
  onBack,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onBack: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Falha no acesso.");
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setResetBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestPasswordReset(email);
      setNotice(
        "Se este email estiver cadastrado, você receberá as instruções para criar uma nova senha.",
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Não foi possível solicitar a recuperação.",
      );
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <form
        onSubmit={submit}
        className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl"
      >
        <div className="text-center">
          <div className="mx-auto inline-flex rounded-2xl bg-slate-900 p-4 text-white">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-black">Acesso profissional</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Use o email e a senha da sua conta.
          </p>
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu@email.com"
          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 font-bold outline-none focus:border-blue-500"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Sua senha"
          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 font-bold outline-none focus:border-blue-500"
        />
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            {notice}
          </p>
        )}
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
          Entrar
        </button>
        <button
          type="button"
          disabled={resetBusy}
          onClick={() => void resetPassword()}
          className="w-full text-xs font-black uppercase tracking-widest text-blue-600 disabled:opacity-50"
        >
          {resetBusy ? "Enviando instruções..." : "Esqueci minha senha"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-xs font-black uppercase tracking-widest text-slate-400"
        >
          Voltar
        </button>
      </form>
    </main>
  );
};

const DashboardShell = ({
  title,
  onLogout,
  children,
}: {
  title: string;
  onLogout: () => void;
  children: React.ReactNode;
}) => (
  <div className="min-h-screen bg-slate-50">
    <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-6">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-blue-600 p-2 text-white">
          <Smile className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Sorvy Smile
          </p>
          <p className="text-sm font-black">{title}</p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100"
      >
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </header>
    {children}
  </div>
);

const DashboardLoading = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <LoaderCircle className="h-10 w-10 animate-spin text-blue-600" />
  </div>
);

export default App;
