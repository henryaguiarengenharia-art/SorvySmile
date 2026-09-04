#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERRO: esperado 1 bloco em {relative_path}, encontrado {count}. "
            "Nenhum patch parcial deve ser aceito."
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"OK: {relative_path}")


replace_once(
    "functions/src/index.ts",
    '''    const accountSnap = await db.doc(`accounts/${profile.accountId}`).get();
    if (!accountSnap.exists || !hasActiveAccountAccess(accountSnap.data())) {
      throw new HttpsError(
        "failed-precondition",
        "A assinatura deste link está inativa.",
      );
    }

    const sessionRef = db.collection("triageSessions").doc();''',
    '''    const usageMonth = monthKey();
    const [accountSnap, usageSnap] = await Promise.all([
      db.doc(`accounts/${profile.accountId}`).get(),
      db.doc(`usage/${profile.accountId}_${usageMonth}`).get(),
    ]);
    if (!accountSnap.exists || !hasActiveAccountAccess(accountSnap.data())) {
      throw new HttpsError(
        "failed-precondition",
        "A assinatura deste link está inativa.",
      );
    }
    const plan = normalizePlan(accountSnap.data()?.plan);
    const triageUsage = triageUsageFromData(usageSnap.data());
    if (!canStartAnotherTriage(triageUsage, PLANS[plan].monthlyLeadLimit)) {
      throw new HttpsError(
        "resource-exhausted",
        "O limite mensal de triagens deste plano foi atingido.",
      );
    }

    const sessionRef = db.collection("triageSessions").doc();''',
)

replace_once(
    "functions/src/index.ts",
    '''      const account = accountSnap.data() as AccountRecord;
      const currentTrialStatus = trialStatusAt({
        trialStatus: account.trialStatus,
        trialStartedAtMs: account.trialStartedAtMs,
        trialEndsAtMs: account.trialEndsAtMs,
        trialUntil: account.trialUntil,
      }, now);
      if (account.status !== "active" || currentTrialStatus === "expired") {
        throw new HttpsError("failed-precondition", "O acesso deste profissional está inativo.");
      }''',
    '''      const account = accountSnap.data() as AccountRecord;
      if (!hasActiveAccountAccess(account, now)) {
        throw new HttpsError("failed-precondition", "O acesso deste profissional está inativo.");
      }''',
)

replace_once(
    "functions/src/index.ts",
    '''    if (!isHqUser && user.professionalId !== professionalId) {
      throw new HttpsError("permission-denied", "Você não pode alterar este endereço.");
    }
    const currentSlug = String(professionalSnap.data()?.publicSlug ?? accountSnap.data()?.slug ?? "");''',
    '''    if (!isHqUser && user.professionalId !== professionalId) {
      throw new HttpsError("permission-denied", "Você não pode alterar este endereço.");
    }
    if (!isHqUser && !hasActiveAccountAccess(accountSnap.data())) {
      throw new HttpsError("failed-precondition", "Regularize a assinatura para alterar o link público.");
    }
    const currentSlug = String(professionalSnap.data()?.publicSlug ?? accountSnap.data()?.slug ?? "");''',
)

replace_once(
    "functions/src/index.ts",
    '''  const allowed = user.role === "hq"
    || (user.role === "professional" && user.professionalId === professionalId)
    || (user.role === "clinic" && user.accountId === professional.accountId);
  if (!allowed) throw new HttpsError("permission-denied", "Você não pode acessar o Post do Dia deste profissional.");
  return { professionalId, professional };''',
    '''  const allowed = user.role === "hq"
    || (user.role === "professional" && user.professionalId === professionalId)
    || (user.role === "clinic" && user.accountId === professional.accountId);
  if (!allowed) throw new HttpsError("permission-denied", "Você não pode acessar o Post do Dia deste profissional.");
  if (user.role !== "hq") {
    const accountId = String(professional.accountId ?? "");
    const accountSnap = accountId ? await db.doc(`accounts/${accountId}`).get() : null;
    if (!accountSnap?.exists || !hasActiveAccountAccess(accountSnap.data()) || professional.isActive !== true) {
      throw new HttpsError("failed-precondition", "Regularize a assinatura para usar o Post do Dia.");
    }
  }
  return { professionalId, professional };''',
)

replace_once(
    "functions/src/index.ts",
    '''  const trialEndsAt = Number(account.trialEndsAtMs ?? account.trialUntil ?? 0);
  const trialMarked = account.subscriptionStatus === "trial" || account.trialStatus === "active";
  const trialActive = trialMarked && trialEndsAt > now;
  const trialExpired = account.trialStatus === "expired" || (trialMarked && trialEndsAt <= now);
  const entitlement = assistantEntitlement({
    plan,
    accountActive: account.status === "active" && !trialExpired,
    trialActive,
    trialExpired,''',
    '''  const trialEndsAt = Number(account.trialEndsAtMs ?? account.trialUntil ?? 0);
  const trialMarked = account.subscriptionStatus === "trial" || account.trialStatus === "active";
  const trialActive = trialMarked && trialEndsAt > now;
  const trialExpired = account.trialStatus === "expired" || (trialMarked && trialEndsAt <= now);
  const accountActive = hasActiveAccountAccess(account, now);
  const entitlement = assistantEntitlement({
    plan,
    accountActive,
    trialActive,
    trialExpired,''',
)

replace_once(
    "functions/src/index.ts",
    '''    const current = assistantEntitlement({
      plan: access.plan,
      accountActive: access.account.status === "active",
      trialActive: access.trialActive,''',
    '''    const current = assistantEntitlement({
      plan: access.plan,
      accountActive: hasActiveAccountAccess(access.account),
      trialActive: access.trialActive,''',
)

replace_once(
    "functions/src/index.ts",
    '''  if (ownsProfile && (account.data()?.status !== "active" || professional.data()?.isActive !== true)) {
    throw new HttpsError("failed-precondition", "A conta e o perfil profissional precisam estar ativos.");
  }''',
    '''  if (ownsProfile && (!hasActiveAccountAccess(account.data()) || professional.data()?.isActive !== true)) {
    throw new HttpsError("failed-precondition", "A conta e o perfil profissional precisam estar ativos.");
  }''',
)

replace_once(
    "functions/src/index.ts",
    '''    const trialStatus = trialStatusAt({ ...professional, status: previous as ProfessionalRecord["status"] }, now);
    const canAccess = account.status === "active" && previous !== "inactive" && trialStatus !== "expired";''',
    '''    const trialStatus = trialStatusAt({ ...professional, status: previous as ProfessionalRecord["status"] }, now);
    const canAccess = hasActiveAccountAccess(account, now) && previous !== "inactive" && trialStatus !== "expired";''',
)

replace_once(
    "functions/src/index.ts",
    '''    const snapshot = await db
      .collection("accounts")
      .where("subscriptionStatus", "==", "active")
      .where("renewAtMs", "<", now)
      .limit(500)
      .get();''',
    '''    const snapshot = await db
      .collection("accounts")
      .where("status", "==", "active")
      .where("renewAtMs", "<", now)
      .limit(500)
      .get();''',
)

replace_once(
    "App.tsx",
    '''  useEffect(() => {
    const target = workspaceUser?.role === "hq" ? hqPreviewProfessionalId ?? undefined : workspaceUser?.professionalId;
    if (!workspaceUser || (workspaceUser.role === "hq" && !target)) {
      setDailyPostAssignment(null);
      setDailyPostHistory([]);
      return;
    }''',
    '''  useEffect(() => {
    const target = workspaceUser?.role === "hq" ? hqPreviewProfessionalId ?? undefined : workspaceUser?.professionalId;
    const accountStatus = workspaceUser?.accountId
      ? workspace?.accounts[workspaceUser.accountId]?.status
      : undefined;
    const operationallyLocked = workspaceUser?.role !== "hq" && accountStatus === "overdue";
    if (!workspaceUser || operationallyLocked || (workspaceUser.role === "hq" && !target)) {
      setDailyPostAssignment(null);
      setDailyPostHistory([]);
      return;
    }''',
)

replace_once(
    "App.tsx",
    '''  }, [workspaceUser, hqPreviewProfessionalId]);''',
    '''  }, [workspaceUser, workspace?.accounts, hqPreviewProfessionalId]);''',
)

replace_once(
    "App.tsx",
    '''              planConfig={PLAN_CONFIGS[currentAccount.tier]}
              currentUsage={currentUsage}
              dailyPost={dailyPostAssignment}''',
    '''              planConfig={PLAN_CONFIGS[currentAccount.tier]}
              currentUsage={currentUsage}
              readOnly={currentAccount.status === "overdue"}
              dailyPost={dailyPostAssignment}''',
)

replace_once(
    "App.tsx",
    '''              account={currentAccount}
              currentUsage={currentUsage}
              currentProfessionalId={workspaceUser?.professionalId}''',
    '''              account={currentAccount}
              currentUsage={currentUsage}
              readOnly={currentAccount.status === "overdue"}
              currentProfessionalId={workspaceUser?.professionalId}''',
)

replace_once(
    "components/BillingSummaryCard.tsx",
    '''  overdue: {
    label: "Pagamento em atraso",
    detail: "Regularize para evitar a pausa do acesso",
    className: "bg-amber-50 text-amber-800",
  },''',
    '''  overdue: {
    label: "Pagamento em atraso",
    detail: "Acesso operacional pausado até a regularização",
    className: "bg-amber-50 text-amber-800",
  },''',
)

replace_once(
    "components/BillingSummaryCard.tsx",
    '''  const showPaymentLink = !readOnly
    && Boolean(onStartCheckout)
    && (status === "pending" || status === "overdue" || isTrialReady || isTrial);''',
    '''  const showPaymentLink = Boolean(onStartCheckout)
    && (!readOnly || status === "overdue")
    && (status === "pending" || status === "overdue" || isTrialReady || isTrial);''',
)

replace_once(
    "components/DentistPortalView.tsx",
    '''  useEffect(() => {
    if (!planConfig.features.assistantPreview) {
      setAssistantSettingsLoading(false);
      return;
    }''',
    '''  useEffect(() => {
    if (readOnly || !planConfig.features.assistantPreview) {
      setAssistantSettingsLoading(false);
      return;
    }''',
)

replace_once(
    "components/DentistPortalView.tsx",
    '''  }, [planConfig.features.assistantPreview, professional.billingAccountId, professional.id]);''',
    '''  }, [readOnly, planConfig.features.assistantPreview, professional.billingAccountId, professional.id]);''',
)

replace_once(
    "components/DentistPortalView.tsx",
    '''      {readOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
          <Eye className="h-5 w-5 shrink-0" />
          Visualização administrativa da HQ. Você está vendo o painel deste profissional em modo somente leitura.
        </div>
      )}''',
    '''      {readOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
          <Eye className="h-5 w-5 shrink-0" />
          {billingAccount.status === "overdue"
            ? "Pagamento vencido. O painel permanece disponível para consulta e regularização, mas as ações operacionais estão pausadas."
            : "Visualização administrativa da HQ. Você está vendo o painel deste profissional em modo somente leitura."}
        </div>
      )}''',
)

replace_once(
    "components/ClinicDashboardView.tsx",
    '''      {readOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
          <Eye className="h-5 w-5 shrink-0" />
          Visualização administrativa da HQ. Você está vendo a gestão desta clínica em modo somente leitura.
        </div>
      )}''',
    '''      {readOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
          <Eye className="h-5 w-5 shrink-0" />
          {account.status === "overdue"
            ? "Pagamento vencido. A gestão permanece disponível para consulta e regularização, mas as ações operacionais estão pausadas."
            : "Visualização administrativa da HQ. Você está vendo a gestão desta clínica em modo somente leitura."}
        </div>
      )}''',
)

replace_once(
    "firestore.indexes.json",
    '''    {
      "collectionGroup": "accounts",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "subscriptionStatus",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "renewAtMs",
          "order": "ASCENDING"
        }
      ]
    },''',
    '''    {
      "collectionGroup": "accounts",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "subscriptionStatus",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "renewAtMs",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "accounts",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "renewAtMs",
          "order": "ASCENDING"
        }
      ]
    },''',
)

replace_once(
    "functions/src/subscriptions.test.ts",
    '''    expect(paidSubscriptionExpired({
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
      renewAtMs: 1_001,
    }, 1_000)).toBe(false);
    expect(paidSubscriptionExpired({
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
    }, 1_000)).toBe(false);''',
    '''    expect(paidSubscriptionExpired({
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
      renewAtMs: 1_001,
    }, 1_000)).toBe(false);
    expect(paidSubscriptionExpired({
      paymentStatus: "confirmed",
      renewAtMs: 999,
    }, 1_000)).toBe(true);
    expect(paidSubscriptionExpired({
      subscriptionStatus: "active",
      paymentStatus: "confirmed",
    }, 1_000)).toBe(false);''',
)

print("\nHARDENING APLICADO COM SUCESSO.")
print("Arquivos alterados:")
for item in [
    "functions/src/index.ts",
    "functions/src/subscriptions.test.ts",
    "App.tsx",
    "components/BillingSummaryCard.tsx",
    "components/DentistPortalView.tsx",
    "components/ClinicDashboardView.tsx",
    "firestore.indexes.json",
]:
    print(f" - {item}")
print("\nNenhum deploy foi executado.")
