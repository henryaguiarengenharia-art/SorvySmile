import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Instagram,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  LogOut,
  ShieldCheck,
  Smile,
  Sparkles,
} from "lucide-react";
import { PatientAssistantGuide } from "./components/PatientAssistantGuide";
import {
  AppView,
  DailyPostAssignment,
  PlanTier,
  PublicProfessionalProfile,
  WorkspaceUser,
} from "./types";
import {
  assignLead,
  askBusinessAssistant,
  archiveProfessional,
  changeAccountStatus,
  confirmInfinitePayReturn,
  createInfinitePayCheckout,
  createTeamMember,
  deleteLeadRecord,
  getDailyPostAssignment,
  loginWorkspace,
  logoutWorkspace,
  manageDailyPost,
  recordDailyPostEvent,
  recordSubscriptionIntent,
  requestPasswordReset,
  registerPendingSubscription,
  restoreWorkspaceSession,
  restoreProfessional,
  saveProfessionalProfile,
  saveProfessionalProfileAsHq,
  setTeamMemberStatus,
  startProfessionalTrial,
  subscribeWorkspace,
  updateLeadCrm,
  updateProfessionalSlug,
} from "./services/lazySorvyApi";
import type { WorkspaceData } from "./services/lazySorvyApi";
import { isFirebaseConfigured } from "./services/firebaseApp";
import { publicLandingPresentation } from "./services/publicRoute";
import { whatsappUrl } from "./services/whatsapp";
import { instagramProfileUrl, normalizeInstagramHandle, normalizePublicHttpsUrl, publicProfessionalDetail, publicProfessionalName } from "./services/publicProfessionalIdentity";
import {
  isPlanPubliclyAvailable,
  PLAN_CONFIGS,
  PLAN_COPY,
} from "./planCatalog";

const DentistPortalView = React.lazy(() =>
  import("./components/DentistPortalView").then((module) => ({
    default: module.DentistPortalView,
  })),
);
const PatientJourney = React.lazy(() =>
  import("./components/PatientJourney").then((module) => ({
    default: module.PatientJourney,
  })),
);
const HQDashboardView = React.lazy(() =>
  import("./components/HQDashboardView").then((module) => ({
    default: module.HQDashboardView,
  })),
);
const ClinicDashboardView = React.lazy(() =>
  import("./components/ClinicDashboardView").then((module) => ({
    default: module.ClinicDashboardView,
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
  const paymentParams = new URLSearchParams(window.location.search);
  if (
    paymentParams.get("payment_return") === "1"
    || paymentParams.has("order_nsu")
    || paymentParams.has("transaction_nsu")
  ) {
    return "checkout-return";
  }
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

type CheckoutMode = "paid" | "trial";

function dashboardViewFor(user: WorkspaceUser): AppView {
  if (user.role === "hq") return "hq-dashboard";
  if (user.role === "clinic") return "admin-dashboard";
  return "dentist-portal";
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
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("paid");
  const [pendingRegistration, setPendingRegistration] =
    useState<PendingRegistration | null>(null);
  const [hqPreviewProfessionalId, setHqPreviewProfessionalId] = useState<string | null>(null);
  const [dailyPostAssignment, setDailyPostAssignment] = useState<DailyPostAssignment | null>(null);
  const [dailyPostHistory, setDailyPostHistory] = useState<DailyPostAssignment[]>([]);
  const [lifecycleNow, setLifecycleNow] = useState(Date.now());

  const slug = useMemo(resolveSlug, []);

  useEffect(() => {
    const target = workspaceUser?.role === "hq" ? hqPreviewProfessionalId ?? undefined : workspaceUser?.professionalId;
    const account = workspaceUser?.accountId
      ? workspace?.accounts[workspaceUser.accountId]
      : undefined;
    const paidExpired = Boolean(
      account
      && Number(account.renewAt ?? 0) > 0
      && Number(account.renewAt ?? 0) <= lifecycleNow
      && (
        account.paymentStatus === "confirmed"
        || account.subscriptionStatus === "active"
      )
    );
    const operationallyLocked = workspaceUser?.role !== "hq"
      && (account?.status === "overdue" || paidExpired);
    if (!workspaceUser || operationallyLocked || (workspaceUser.role === "hq" && !target)) {
      setDailyPostAssignment(null);
      setDailyPostHistory([]);
      return;
    }
    let cancelled = false;
    getDailyPostAssignment(target).then(({ assignment, history }) => {
      if (!cancelled) { setDailyPostAssignment(assignment); setDailyPostHistory(history); }
    }).catch((error: Error) => { if (!cancelled) setPageError(error.message); });
    return () => { cancelled = true; };
  }, [workspaceUser, workspace?.accounts, hqPreviewProfessionalId, lifecycleNow]);

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
    import("./services/publicProfileApi")
      .then(({ getPublicProfile }) => getPublicProfile(slug))
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setProfileError(
          result ? null : "Este link profissional ainda não está ativo.",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setProfileError(
            "Não foi possível carregar este perfil agora. Tente novamente em alguns instantes.",
          );
        }
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
    const timer = window.setInterval(() => setLifecycleNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
      if (user.status === "pending") {
        setWorkspaceUser(user);
        setView("checkout-confirm");
        return;
      }
      setWorkspaceUser(user);
      workspaceUnsubscribe.current?.();
      workspaceUnsubscribe.current = await subscribeWorkspace(
        user,
        setWorkspace,
        setPageError,
      );
      if (!cancelled) {
        setView(dashboardViewFor(user));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const openWhatsApp = (number: string, message: string) => {
    const url = whatsappUrl(number, message);
    if (!url) return;
    window.open(
      url,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const openWorkspace = async (user: WorkspaceUser) => {
    setWorkspaceUser(user);
    workspaceUnsubscribe.current?.();
    workspaceUnsubscribe.current = await subscribeWorkspace(
      user,
      setWorkspace,
      setPageError,
    );
    setView(dashboardViewFor(user));
  };

  const handleLogin = async (email: string, password: string) => {
    const user = await loginWorkspace(email, password);
    const paymentParams = new URLSearchParams(window.location.search);
    if (
      paymentParams.get("payment_return") === "1"
      || paymentParams.has("order_nsu")
      || paymentParams.has("transaction_nsu")
    ) {
      setWorkspaceUser(user);
      setView("checkout-return");
      return;
    }
    if (user.status === "pending") {
      setWorkspaceUser(user);
      setView("checkout-confirm");
      return;
    }
    await openWorkspace(user);
  };

  const handleStartCheckout = async (
    context: Parameters<typeof recordSubscriptionIntent>[0],
  ): Promise<void> => {
    setPageError(null);
    await recordSubscriptionIntent(context);
    const checkout = await createInfinitePayCheckout();
    window.location.assign(checkout.checkoutUrl);
  };

  const handleLogout = async () => {
    workspaceUnsubscribe.current?.();
    workspaceUnsubscribe.current = null;
    setWorkspace(null);
    setWorkspaceUser(null);
    setHqPreviewProfessionalId(null);
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
  const currentOperationalReadOnly = Boolean(
    currentAccount
    && (
      currentAccount.status === "overdue"
      || (
        Number(currentAccount.renewAt ?? 0) > 0
        && Number(currentAccount.renewAt ?? 0) <= lifecycleNow
        && (
          currentAccount.paymentStatus === "confirmed"
          || currentAccount.subscriptionStatus === "active"
        )
      )
    )
  );
  const currentTrialExpired = Boolean(
    currentAccount
    && (
      currentAccount.trialStatus === "expired"
      || currentAccount.subscriptionStatus === "trial_expired"
      || (
        currentAccount.trialStatus === "active"
        && Boolean(currentAccount.trialUntil)
        && Number(currentAccount.trialUntil) <= lifecycleNow
      )
    ),
  );
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);
  const currentUsage = workspaceUser?.accountId
    ? workspace?.usageByAccount[workspaceUser.accountId]?.[currentMonth] ?? 0
    : 0;

  const hqPreviewProfessional = hqPreviewProfessionalId
    ? workspace?.professionals.find((item) => item.id === hqPreviewProfessionalId)
    : undefined;
  const hqPreviewAccount = hqPreviewProfessional
    ? workspace?.accounts[hqPreviewProfessional.billingAccountId]
    : undefined;
  const hqPreviewIsClinicManager = Boolean(
    hqPreviewProfessional
    && hqPreviewAccount?.ownerType === "clinic"
    && (
      hqPreviewAccount.ownerProfessionalId === hqPreviewProfessional.id
      || (!hqPreviewAccount.ownerProfessionalId
        && hqPreviewProfessional.teamTag?.toLowerCase().includes("admin"))
    ),
  );
  const hqPreviewProfessionals = hqPreviewAccount
    ? (workspace?.professionals ?? []).filter(
        (professional) => professional.billingAccountId === hqPreviewAccount.id,
      )
    : [];
  const hqPreviewLeads = hqPreviewProfessional && hqPreviewAccount
    ? (workspace?.leads ?? []).filter((lead) => {
        if (hqPreviewIsClinicManager) return lead.accountId === hqPreviewAccount.id;
        const assignedProfessionalId = lead.professionalId ?? lead.dentistId;
        if (assignedProfessionalId) return assignedProfessionalId === hqPreviewProfessional.id;
        return hqPreviewAccount.ownerType === "dentist" && lead.accountId === hqPreviewAccount.id;
      })
    : [];
  const hqPreviewUsage = hqPreviewAccount
    ? workspace?.usageByAccount[hqPreviewAccount.id]?.[currentMonth] ?? 0
    : 0;
  const handleDailyPostEvent = async (eventType: Parameters<typeof recordDailyPostEvent>[0]["eventType"], format: Parameters<typeof recordDailyPostEvent>[0]["format"] = "none", customizedVariant?: Parameters<typeof recordDailyPostEvent>[0]["customizedVariant"]) => {
    if (!dailyPostAssignment) {
      throw new Error("O Post do Dia ainda está sendo carregado. Aguarde alguns segundos e tente novamente.");
    }
    const updatedAssignment = await recordDailyPostEvent({ assignmentId: dailyPostAssignment.id, eventType, format, customizedVariant });
    if (!updatedAssignment) {
      throw new Error("Não foi possível confirmar a atualização do Post do Dia.");
    }
    setDailyPostAssignment(updatedAssignment);
    setDailyPostHistory((current) => [
      updatedAssignment,
      ...current.filter((item) => item.id !== updatedAssignment.id),
    ]);
  };

  const showPublicNav = ![
    "patient",
    "dentist-portal",
    "admin-dashboard",
    "hq-dashboard",
  ].includes(view);
  const isProfessionalLanding = view === "landing" && Boolean(slug);
  const landingPresentation = publicLandingPresentation(
    slug,
    profileLoading,
    Boolean(profile),
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showPublicNav && (
        <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/95 px-5 backdrop-blur-md">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between">
            <a
              href="/"
              onClick={(event) => {
                if (!isProfessionalLanding) {
                  event.preventDefault();
                  setView("landing");
                }
              }}
              className="flex items-center gap-2"
              aria-label={isProfessionalLanding ? "Ir para o início da Sorvy Smile" : "Sorvy Smile"}
            >
              <span className="rounded-xl bg-blue-600 p-2 text-white">
                <Smile className="h-5 w-5" />
              </span>
              <span className="hidden text-lg font-black uppercase tracking-tight sm:inline">
                Sorvy Smile
              </span>
            </a>
            {!isProfessionalLanding && <div className="flex items-center gap-1">
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
            </div>}
            {isProfessionalLanding && (
              <span className="max-w-[60%] truncate text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                {profile ? `Experiência de ${publicProfessionalName(profile.name)}` : "Experiência profissional"}
              </span>
            )}
          </div>
        </nav>
      )}

      {profileError && view === "landing" && !slug && (
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
        <>
          {landingPresentation === "professional-loading" ? (
            <PublicProfileLoadingView />
          ) : landingPresentation === "professional-unavailable" ? (
            <PublicProfileUnavailableView message={profileError} />
          ) : (
            <LandingView
              profile={profile}
              onStart={() => profile && setView("patient")}
              onPlans={() => setView("pricing")}
            />
          )}
          {profile && <PatientAssistantGuide profile={profile} stage="journey" />}
        </>
      )}

      {view === "patient" && profile && (
        <React.Suspense fallback={<PatientJourneyLoading />}>
          <PatientJourney profile={profile} onExit={() => setView("landing")} />
        </React.Suspense>
      )}

      {view === "pricing" && (
        <PricingView
          onSelect={(plan, mode) => {
            setSelectedPlan(plan);
            setCheckoutMode(mode);
            setView("checkout-pix");
          }}
        />
      )}

      {view === "checkout-pix" && (
        <CheckoutView
          plan={selectedPlan}
          mode={checkoutMode}
          onBack={() => setView("pricing")}
          onCreated={async (registration, user) => {
            if (checkoutMode === "trial" && user) {
              await openWorkspace(user);
              return;
            }
            setPendingRegistration(registration);
            setView("checkout-confirm");
          }}
        />
      )}

      {view === "checkout-confirm" && (pendingRegistration || workspaceUser?.status === "pending") && (
        <PaymentInstructionsView
          registration={pendingRegistration}
          onStartCheckout={() => handleStartCheckout("pending")}
        />
      )}

      {view === "checkout-return" && (
        <InfinitePayReturnView
          onActivated={openWorkspace}
          onLogin={() => setView("login")}
        />
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

      {(view === "dentist-portal" || view === "admin-dashboard")
        && workspace && currentAccount && currentTrialExpired && (
        <DashboardShell title="Teste gratuito concluído" onLogout={handleLogout}>
          <TrialExpiredView
            account={currentAccount}
            onStartCheckout={() => handleStartCheckout("trial_expired")}
          />
        </DashboardShell>
      )}

      {view === "dentist-portal" && workspace && currentProfessional && currentAccount && !currentTrialExpired && (
        <DashboardShell title={currentProfessional.name} onLogout={handleLogout}>
          <React.Suspense fallback={<DashboardLoading />}>
            <DentistPortalView
              leadRecords={workspace.leads}
              professional={currentProfessional}
              billingAccount={currentAccount}
              planConfig={PLAN_CONFIGS[currentAccount.tier]}
              currentUsage={currentUsage}
              readOnly={currentOperationalReadOnly}
              dailyPost={dailyPostAssignment}
              dailyPostHistory={dailyPostHistory}
              onDailyPostEvent={handleDailyPostEvent}
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
              onUpdateSlug={(slug) => updateProfessionalSlug({ slug })}
              onAskAssistant={(input) => askBusinessAssistant(input)}
              onStartCheckout={handleStartCheckout}
            />
          </React.Suspense>
        </DashboardShell>
      )}

      {view === "admin-dashboard" && workspace && currentAccount && !currentTrialExpired && (
        <DashboardShell
          title={currentAccount.accountName || "Administração da clínica"}
          onLogout={handleLogout}
        >
          <React.Suspense fallback={<DashboardLoading />}>
            <ClinicDashboardView
              leadRecords={workspace.leads}
              professionals={workspace.professionals}
              account={currentAccount}
              currentUsage={currentUsage}
              readOnly={currentOperationalReadOnly}
              currentProfessionalId={workspaceUser?.professionalId}
              managerProfessional={currentProfessional}
              onAssignLead={assignLead}
              onCreateProfessional={createTeamMember}
              onToggleProfessional={setTeamMemberStatus}
              onUpdateClinicProfile={(patch) =>
                saveProfessionalProfile(patch).catch((error: Error) => {
                  setPageError(error.message);
                  throw error;
                })
              }
              dailyPost={dailyPostAssignment}
              dailyPostHistory={dailyPostHistory}
              onDailyPostEvent={handleDailyPostEvent}
              onAskAssistant={(input) => askBusinessAssistant({ ...input, accountId: currentAccount.id })}
              onUpdateSlug={(slug) => updateProfessionalSlug({ slug })}
              onUpdateLead={(id, patch) =>
                updateLeadCrm(id, patch).catch((error: Error) => {
                  setPageError(error.message);
                  throw error;
                })
              }
              onStartCheckout={handleStartCheckout}
            />
          </React.Suspense>
        </DashboardShell>
      )}

      {view === "hq-dashboard" && workspace && hqPreviewProfessional && hqPreviewAccount && (
        <DashboardShell title={`HQ · ${hqPreviewIsClinicManager ? hqPreviewAccount.accountName || hqPreviewProfessional.name : hqPreviewProfessional.name}`} onLogout={handleLogout}>
          <div className="mx-auto max-w-7xl px-5 pt-6">
            <button onClick={() => setHqPreviewProfessionalId(null)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4" /> Voltar à administração Sorvy
            </button>
          </div>
          <React.Suspense fallback={<DashboardLoading />}>
            {hqPreviewIsClinicManager ? (
              <ClinicDashboardView
                leadRecords={hqPreviewLeads}
                professionals={hqPreviewProfessionals}
                account={hqPreviewAccount}
                currentUsage={hqPreviewUsage}
                currentProfessionalId={hqPreviewAccount.ownerProfessionalId ?? hqPreviewProfessional.id}
                managerProfessional={hqPreviewProfessional}
                dailyPost={dailyPostAssignment}
                dailyPostHistory={dailyPostHistory}
                readOnly
                onAssignLead={async () => undefined}
                onCreateProfessional={async () => undefined}
                onToggleProfessional={async () => undefined}
                onUpdateLead={async () => undefined}
                onUpdateClinicProfile={async () => undefined}
              />
            ) : (
              <DentistPortalView
                leadRecords={hqPreviewLeads}
                professional={hqPreviewProfessional}
                billingAccount={hqPreviewAccount}
                planConfig={PLAN_CONFIGS[hqPreviewAccount.tier]}
                currentUsage={hqPreviewUsage}
                readOnly
                dailyPost={dailyPostAssignment}
                dailyPostHistory={dailyPostHistory}
                onUpdateLead={async () => undefined}
                onUpdateProfessional={async () => undefined}
                onDeleteLead={async () => undefined}
              />
            )}
          </React.Suspense>
        </DashboardShell>
      )}

      {view === "hq-dashboard" && workspace && !hqPreviewProfessional && (
        <DashboardShell title="Administração Sorvy" onLogout={handleLogout}>
          <React.Suspense fallback={<DashboardLoading />}>
            <HQDashboardView
              leadRecords={workspace.leads}
              professionals={workspace.professionals}
              billingAccounts={workspace.accounts}
              usageByAccount={workspace.usageByAccount}
              planConfigs={PLAN_CONFIGS}
              onUpdateBilling={(id, status, plan, renewAtMs) =>
                changeAccountStatus(id, status, plan, renewAtMs).catch((error: Error) => {
                  setPageError(error.message);
                  throw error;
                })
              }
              onOpenWhatsApp={openWhatsApp}
              onStartTrial={startProfessionalTrial}
              onUpdateProfessional={saveProfessionalProfileAsHq}
              onArchiveProfessional={archiveProfessional}
              onRestoreProfessional={restoreProfessional}
              onViewProfessionalDashboard={setHqPreviewProfessionalId}
              dailyPosts={workspace.dailyPosts}
              dailyPostEvents={workspace.dailyPostEvents}
              adminAuditLogs={workspace.adminAuditLogs}
              subscriptionHistory={workspace.subscriptionHistory}
              funnelEvents={workspace.funnelEvents}
              onManageDailyPost={manageDailyPost}
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

const PublicProfilePhoto = ({ src, name }: { src?: string; name: string }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-blue-600 shadow-xl ring-4 ring-white sm:h-32 sm:w-32"><Smile className="h-10 w-10" /></span>;
  }
  return <img src={src} alt={`Foto de ${name}`} width="128" height="128" loading="eager" decoding="async" fetchPriority="high" onError={() => setFailed(true)} className="h-24 w-24 rounded-3xl bg-white object-cover shadow-xl ring-4 ring-white sm:h-32 sm:w-32" referrerPolicy="no-referrer" />;
};

const PublicProfileLoadingView = () => (
  <main className="mx-auto max-w-6xl px-6 py-12 md:py-16" role="status" aria-live="polite">
    <div className="mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-100">
      <div className="h-52 animate-pulse bg-gradient-to-br from-[#123B5D] via-[#1D5477] to-[#18AFA5] sm:h-64" />
      <div className="relative grid gap-8 p-6 pt-20 sm:p-9 sm:pt-24 md:grid-cols-[1fr_17rem]">
        <div className="absolute -top-12 left-6 h-24 w-24 animate-pulse rounded-3xl bg-slate-100 ring-4 ring-white sm:-top-16 sm:left-9 sm:h-32 sm:w-32" />
        <div className="space-y-4">
          <div className="h-3 w-48 animate-pulse rounded-full bg-slate-100" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-slate-100" />
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-44 animate-pulse rounded-[2rem] bg-emerald-50" />
      </div>
    </div>
    <p className="mt-6 text-center text-xs font-bold text-slate-400">Carregando a experiência do profissional…</p>
  </main>
);

const PublicProfileUnavailableView = ({ message }: { message?: string | null }) => (
  <main className="mx-auto flex min-h-[65vh] max-w-2xl items-center px-6 py-16 text-center">
    <section className="w-full rounded-[2.5rem] border border-slate-100 bg-white p-9 shadow-xl">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Smile className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl font-black tracking-tight">Este perfil não está disponível.</h1>
      <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-slate-500">
        {message || "Confira o endereço recebido ou solicite ao profissional um novo link."}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => window.location.reload()} className="rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black text-white hover:bg-blue-600">
          Tentar novamente
        </button>
        <a href="/" className="rounded-2xl border border-slate-200 px-6 py-3 text-xs font-black text-slate-700 hover:border-blue-300 hover:text-blue-700">
          Ir para Sorvy Smile
        </a>
      </div>
    </section>
  </main>
);

const PatientJourneyLoading = () => (
  <main className="flex min-h-[70vh] items-center justify-center px-6" role="status" aria-live="polite">
    <div className="text-center">
      <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-blue-600" />
      <p className="mt-4 text-sm font-bold text-slate-500">Preparando sua experiência segura…</p>
    </div>
  </main>
);

const LandingView = ({
  profile,
  onStart,
  onPlans,
}: {
  profile: PublicProfessionalProfile | null;
  onStart: () => void;
  onPlans: () => void;
}) => {
  const professionalName = publicProfessionalName(profile?.name);
  const specialty = publicProfessionalDetail(profile?.specialty);
  return (
  <main>
    <section className="mx-auto max-w-6xl px-6 py-12 text-center md:py-16">
      {!profile && <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
        <Sparkles className="h-4 w-4" /> Mapeamento visual gratuito · leva poucos segundos
      </div>}
      {!profile && <><h1 className="mx-auto max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter md:text-7xl">Descubra o potencial do seu <span className="text-blue-600">sorriso em segundos.</span></h1><p className="mx-auto mt-7 max-w-2xl text-lg font-medium leading-relaxed text-slate-500">Tenha seu sorriso mapeado e chegue à conversa com o dentista sabendo quais pontos deseja explorar. Sem cadastro. Sem compromisso.</p></>}
      {profile && (
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-white text-left shadow-2xl shadow-slate-900/15 ring-1 ring-slate-100">
          <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#123B5D] via-[#1D5477] to-[#18AFA5] sm:h-64">
            {profile.coverImage && <img src={profile.coverImage} alt="" width="1024" height="256" loading="eager" decoding="async" fetchPriority="high" onError={(event) => { event.currentTarget.style.display = "none"; }} className="h-full w-full object-cover opacity-80" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B2036]/95 via-[#123B5D]/25 to-transparent" />
            <div className="absolute bottom-6 left-32 right-6 sm:left-44">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">Experiência profissional individual</p>
              <p className="mt-1 text-2xl font-black leading-tight text-white sm:text-4xl">{professionalName}</p>
            </div>
          </div>
          <div className="relative p-6 pt-16 sm:p-9 sm:pt-20">
            <div className="absolute -top-12 left-6 sm:-top-16 sm:left-9">
            <PublicProfilePhoto src={profile.profileImage} name={professionalName} />
            </div>
            <div className="grid gap-7 md:grid-cols-[1fr_17rem]">
              <div>
              {(specialty || profile.city) && (
                <p className="text-xs font-black uppercase tracking-widest text-[#18AFA5]">
                  {[specialty, profile.city, profile.state]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {profile.registrationNumber && <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{profile.registrationNumber}</p>}
              {profile.bio && (
                <p className="mt-5 max-w-xl text-base font-medium italic leading-relaxed text-slate-600">
                  {profile.bio}
                </p>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                {instagramProfileUrl(profile.instagramHandle) && <a href={instagramProfileUrl(profile.instagramHandle)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700"><Instagram className="h-4 w-4 text-pink-500" />@{normalizeInstagramHandle(profile.instagramHandle)}</a>}
                {profile.bioLink && <a href={normalizePublicHttpsUrl(profile.bioLink)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700">Conheça meu trabalho <ExternalLink className="h-4 w-4" /></a>}
              </div>
              </div>
              <aside className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-center">
                <p className="text-lg font-black text-emerald-950">Inicie sua experiência</p>
                <p className="mt-3 text-xs font-medium leading-relaxed text-emerald-800">Responda algumas perguntas rápidas para organizar o que deseja conversar.</p>
                <button onClick={onStart} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-xs font-black uppercase text-white shadow-lg transition hover:bg-emerald-700">Começar agora <ArrowRight className="h-4 w-4" /></button>
                {profile.whatsapp && <a href={whatsappUrl(profile.whatsapp)} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black text-emerald-800"><MessageCircle className="h-4 w-4" />Falar com profissional</a>}
              </aside>
            </div>
          </div>
        </div>
      )}
      {!profile && <button
        disabled={!profile}
        onClick={onStart}
        className="mx-auto mt-9 flex items-center gap-3 rounded-3xl bg-slate-900 px-10 py-6 text-base font-black text-white shadow-2xl transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Smile className="h-5 w-5" />
        {profile ? "Começar minha experiência" : "Mapear meu sorriso agora"} <ArrowRight className="h-5 w-5" />
      </button>}
      {!profile && (
        <p className="mx-auto mt-3 max-w-md text-xs font-bold text-amber-700">
          A triagem é liberada pelo link individual do dentista ou da clínica.
        </p>
      )}
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

    {!profile && <section className="border-y border-slate-100 bg-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-blue-600">
          Como funciona
        </p>
        <h2 className="mt-3 text-center text-4xl font-black tracking-tight">
          Simples, rápido e informativo.
        </h2>
        <div className="mt-9 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              number: "01",
              icon: "📸",
              title: "Foto guiada",
              text: "A câmera orienta posição, distância e iluminação.",
            },
            {
              number: "02",
              icon: "✨",
              title: "Primeira descoberta",
              text: "Veja os primeiros destaques antes de informar seus dados.",
            },
            {
              number: "03",
              icon: "📊",
              title: "Mapa do Sorriso",
              text: "Receba pontos para conversar em uma avaliação.",
            },
            {
              number: "04",
              icon: "📋",
              title: "Próximo passo",
              text: "Escolha iniciar a conversa ou receber o contato.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6 text-center"
            >
              <div className="text-3xl">{item.icon}</div>
              <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-blue-600">
                {item.number}
              </p>
              <h3 className="mt-1 text-sm font-black">{item.title}</h3>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
                {item.text}
              </p>
            </article>
          ))}
        </div>
        <button
          onClick={onPlans}
          className="mx-auto mt-9 flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black text-white hover:bg-blue-700"
        >
          Sou profissional · conhecer os planos <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-5 text-center text-xs font-medium text-slate-400">
          Triagem informativa. Não substitui consulta com cirurgião-dentista.
        </p>
      </div>
    </section>}
  </main>
  );
};

const PricingView = ({
  onSelect,
}: {
  onSelect: (plan: PlanTier, mode: CheckoutMode) => void;
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
        Escolha entre uma operação individual simples, um funil profissional
        completo ou a gestão de uma clínica com equipe.
      </p>
    </div>
    <div className="mt-12 grid gap-6 lg:grid-cols-3">
      {(Object.keys(PLAN_CONFIGS) as PlanTier[]).map((tier) => {
        const plan = PLAN_CONFIGS[tier];
        const copy = PLAN_COPY[tier];
        const highlighted = tier === "pro";
        const available = isPlanPubliclyAvailable(tier);
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
            {!available && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-200 px-4 py-1 text-[9px] font-black uppercase tracking-widest text-slate-700">
                Em breve
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
              disabled={!available}
              onClick={() => onSelect(tier, "paid")}
              className={`mt-9 w-full rounded-2xl py-4 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${
                highlighted
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-slate-900 text-white hover:bg-blue-600"
              }`}
            >
              {available ? `Escolher ${copy.name}` : "Indisponível no lançamento"}
            </button>
            {available && tier !== "network" && (
              <>
                <button
                  onClick={() => onSelect(tier, "trial")}
                  className={`mt-3 w-full rounded-2xl border-2 py-4 text-xs font-black uppercase tracking-widest ${
                    highlighted
                      ? "border-white/20 text-white hover:border-blue-400 hover:text-blue-300"
                      : "border-blue-100 text-blue-700 hover:border-blue-300"
                  }`}
                >
                  Testar grátis por 7 dias
                </button>
                <p className={`mt-3 text-center text-[11px] font-bold leading-relaxed ${highlighted ? "text-slate-400" : "text-slate-500"}`}>
                  Os 7 dias começam somente após a captura do primeiro lead.
                </p>
              </>
            )}
          </article>
        );
      })}
    </div>
  </main>
);

const CheckoutView = ({
  plan,
  mode,
  onBack,
  onCreated,
}: {
  plan: PlanTier;
  mode: CheckoutMode;
  onBack: () => void;
  onCreated: (registration: PendingRegistration, user?: WorkspaceUser) => Promise<void> | void;
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
    if (!isPlanPubliclyAvailable(plan)) {
      setError("O plano Network estará disponível em breve. Escolha Lite ou Pro.");
      return;
    }
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
      const subscription = await registerPendingSubscription({ ...form, plan, checkoutMode: mode });
      await onCreated({
        accountId: subscription.accountId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp,
        plan,
      }, subscription.user);
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
            {mode === "trial"
              ? "Cadastre sua conta sem cobrança. Os 7 dias só começam quando seu primeiro lead for capturado."
              : `R$ ${PLAN_CONFIGS[plan].price}/mês. Depois do cadastro, o checkout seguro será criado na InfinitePay.`}
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
            , {mode === "trial" ? "as regras do teste gratuito" : "a contratação mensal"} e a{" "}
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
            mode === "trial" ? <Sparkles className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />
          )}
          {mode === "trial" ? "Criar conta e iniciar experiência" : "Criar conta e ver pagamento"}
        </button>
      </form>
    </main>
  );
};

const PaymentInstructionsView = ({
  registration,
  onStartCheckout,
}: {
  registration: PendingRegistration | null;
  onStartCheckout: () => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onStartCheckout();
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Não foi possível abrir o pagamento agora.",
      );
      setBusy(false);
    }
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
            {registration
              ? `Contrate o plano ${PLAN_COPY[registration.plan].name} no ambiente seguro da InfinitePay.`
              : "Seu cadastro está pronto. Continue no ambiente seguro da InfinitePay."}
            {" "}O pagamento será validado automaticamente antes de liberar o painel.
          </p>
        </div>

        {registration && (
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
        )}

        {error && (
          <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-sm font-black uppercase tracking-widest text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
          {busy ? "Preparando checkout..." : "Pagar e liberar automaticamente"}
        </button>
        <p className="text-center text-xs font-medium leading-relaxed text-slate-400">
          Após a aprovação, você voltará à Sorvy Smile com o plano e os limites
          liberados. Não será necessário enviar comprovante.
        </p>
      </section>
    </main>
  );
};

const InfinitePayReturnView = ({
  onActivated,
  onLogin,
}: {
  onActivated: (user: WorkspaceUser) => Promise<void>;
  onLogin: () => void;
}) => {
  const [state, setState] = useState<"processing" | "error">("processing");
  const [message, setMessage] = useState("Confirmando seu pagamento com segurança...");

  useEffect(() => {
    let cancelled = false;
    const confirm = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const orderNsu = params.get("order_nsu") ?? "";
        const transactionNsu = params.get("transaction_nsu") ?? "";
        const slug = params.get("slug") ?? params.get("invoice_slug") ?? "";
        if (!orderNsu || !transactionNsu || !slug) {
          const existingUser = await restoreWorkspaceSession();
          if (existingUser?.status === "active") {
            window.history.replaceState({}, document.title, "/");
            await onActivated(existingUser);
            return;
          }
          throw new Error(
            "A InfinitePay não retornou todos os dados da confirmação. Entre novamente para verificar se o webhook já liberou seu acesso.",
          );
        }

        await confirmInfinitePayReturn({
          orderNsu,
          transactionNsu,
          slug,
          receiptUrl: params.get("receipt_url") ?? undefined,
          captureMethod: params.get("capture_method") ?? undefined,
        });
        const user = await restoreWorkspaceSession();
        if (!user || user.status !== "active") {
          throw new Error(
            "O pagamento foi aprovado, mas o painel ainda não atualizou. Tente entrar novamente em alguns segundos.",
          );
        }
        if (cancelled) return;
        window.history.replaceState({}, document.title, "/");
        await onActivated(user);
      } catch (confirmationError) {
        if (cancelled) return;
        setMessage(
          confirmationError instanceof Error
            ? confirmationError.message
            : "Não foi possível confirmar o pagamento automaticamente.",
        );
        setState("error");
      }
    };
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [onActivated]);

  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center">
      <div className="rounded-[3rem] border border-slate-100 bg-white p-10 shadow-xl">
        {state === "processing" ? (
          <LoaderCircle className="mx-auto h-16 w-16 animate-spin text-blue-600" />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-3xl font-black text-amber-700">!</div>
        )}
        <h1 className="mt-7 text-4xl font-black">
          {state === "processing" ? "Validando pagamento" : "Precisamos revisar a confirmação"}
        </h1>
        <p className="mt-4 font-medium leading-relaxed text-slate-500">{message}</p>
        {state === "error" && (
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-2xl bg-blue-600 py-5 text-sm font-black uppercase tracking-widest text-white hover:bg-blue-700"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="w-full rounded-2xl border-2 border-slate-200 py-4 text-xs font-black uppercase tracking-widest text-slate-700"
            >
              Entrar na minha conta
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

const TrialExpiredView = ({
  account,
  onStartCheckout,
}: {
  account: import("./types").BillingAccount;
  onStartCheckout: () => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await onStartCheckout();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Não foi possível abrir o pagamento.");
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <section className="rounded-[3rem] border border-amber-100 bg-white p-10 shadow-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-700">
          <LockKeyhole className="h-9 w-9" />
        </div>
        <p className="mt-7 text-[10px] font-black uppercase tracking-widest text-amber-700">
          Experiência concluída
        </p>
        <h1 className="mt-2 text-4xl font-black">Seu teste de 7 dias terminou</h1>
        <p className="mx-auto mt-4 max-w-lg font-medium leading-relaxed text-slate-500">
          Seus dados e leads continuam preservados. Para voltar a usar o painel e reativar seu link público, assine o plano {PLAN_COPY[account.tier].name}.
        </p>
        <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-slate-50 p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Plano selecionado</p>
          <p className="mt-2 text-2xl font-black">R$ {PLAN_CONFIGS[account.tier].price}/mês</p>
        </div>
        {error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-sm font-black uppercase tracking-widest text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
          {busy ? "Preparando checkout..." : "Assinar e reativar acesso"}
        </button>
        <p className="mt-4 text-xs font-medium leading-relaxed text-slate-400">
          O pagamento será confirmado diretamente com a InfinitePay e o acesso será reativado automaticamente.
        </p>
      </section>
    </main>
  );
};

const LegalView = ({
  type,
  onBack,
}: {
  type: "privacy" | "terms";
  onBack: () => void;
}) => {
  const privacyEmail = String(
    import.meta.env.VITE_PRIVACY_CONTACT_EMAIL ?? "",
  ).trim();
  const isPrivacy = type === "privacy";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <button onClick={onBack} className="mb-6 text-sm font-black text-slate-500">
        ← Voltar
      </button>
      <article className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl md:p-12">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
          Versão 2026-08
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
              de segurança, escolhas de contato e informações da conta
              profissional. A orientação de enquadramento da câmera acontece
              localmente no aparelho, sem gravar os quadros do vídeo. A foto
              confirmada serve apenas para validar e gerar a leitura solicitada;
              nome e WhatsApp permitem compartilhar o resultado com o
              profissional do link e realizar o contato autorizado.
            </LegalSection>
            <LegalSection title="3. Consentimento e uso da imagem">
              A foto pode revelar dado de saúde e, por isso, só é processada
              após consentimento específico e destacado. Esta experiência é
              destinada a maiores de 18 anos que utilizem uma imagem própria.
              Para a avaliação de menores, o responsável legal deve contatar a
              clínica sem utilizar esta triagem. O consentimento para contato é
              separado e pode ser revogado.
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
              resultado, consentimentos e escolhas do próximo passo é mantido
              por até 12 meses, salvo obrigação legal ou pedido de exclusão
              aplicável. Logs técnicos do provedor podem seguir os prazos de
              segurança contratados.
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
              risco. Solicitações de privacidade podem ser enviadas
              {privacyEmail ? (
                <>
                  {" para "}
                  <a
                    className="font-black text-blue-600 underline"
                    href={`mailto:${privacyEmail}`}
                  >
                    {privacyEmail}
                  </a>
                </>
              ) : (
                " pelo canal de atendimento identificado no site"
              )}
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
              Lite, Pro e Network possuem preços e limites mensais exibidos na
              contratação. O Network inclui gestão de equipe, atribuição de
              leads e indicadores por profissional. Funcionalidades ainda em
              validação são identificadas no produto e não devem ser tratadas
              como ativas. O teste gratuito está disponível apenas para Lite e
              Pro, uma única vez por conta. Seus sete dias começam na primeira
              captura de lead concluída com consentimento, e não no cadastro.
              Ao final, o painel operacional e o link público são pausados,
              preservando os dados para eventual assinatura.
            </LegalSection>
            <LegalSection title="3. Pagamento e ativação">
              A solicitação cria uma conta pendente e um checkout vinculado ao
              plano escolhido. Após a aprovação, a Sorvy reconfirma pedido,
              transação e valor diretamente na InfinitePay e libera o acesso
              automaticamente. Comprovantes e comunicações disponibilizados
              pelo pagamento são processados pelo provedor. Renovação,
              cancelamento, reembolso e vencimento seguem as condições
              exibidas no checkout e nos canais oficiais.
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
