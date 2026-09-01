import React, { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
} from "lucide-react";
import { PLAN_CONFIGS, planName } from "../planCatalog";
import { AccountStatus, BillingAccount } from "../types";

const statusCopy: Record<AccountStatus, {
  label: string;
  detail: string;
  className: string;
}> = {
  active: {
    label: "Assinatura ativa",
    detail: "Pagamento confirmado",
    className: "bg-emerald-50 text-emerald-700",
  },
  pending: {
    label: "Ativação pendente",
    detail: "Aguardando o primeiro pagamento",
    className: "bg-blue-50 text-blue-700",
  },
  overdue: {
    label: "Pagamento em atraso",
    detail: "Regularize para evitar a pausa do acesso",
    className: "bg-amber-50 text-amber-800",
  },
  paused: {
    label: "Assinatura pausada",
    detail: "Acesso temporariamente suspenso",
    className: "bg-slate-100 text-slate-700",
  },
};

interface BillingSummaryCardProps {
  account: BillingAccount;
  readOnly?: boolean;
  onStartCheckout?: (context: "trial_ready" | "trial_active" | "pending" | "overdue") => Promise<void>;
}

export const BillingSummaryCard: React.FC<BillingSummaryCardProps> = ({
  account,
  readOnly = false,
  onStartCheckout,
}) => {
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const status = account.status ?? "pending";
  const statusInfo = statusCopy[status];
  const isTrialReady = account.subscriptionStatus === "trial_ready" || account.trialStatus === "ready";
  const isTrial = account.subscriptionStatus === "trial" || account.trialStatus === "active";
  const dueAt = isTrial ? account.trialUntil ?? 0 : account.renewAt;
  const dueLabel = isTrialReady ? "Início da contagem" : isTrial ? "Fim do teste" : "Próximo vencimento";
  const lifecycleLabel = isTrialReady ? "Teste preparado" : isTrial ? "Teste em andamento" : statusInfo.label;
  const lifecycleDetail = isTrialReady
    ? "Sem cobrança e sem dias consumidos"
    : isTrial
      ? "Período gratuito ativo"
      : statusInfo.detail;
  const showPaymentLink = !readOnly
    && Boolean(onStartCheckout)
    && (status === "pending" || status === "overdue" || isTrialReady || isTrial);
  const intentContext = isTrialReady
    ? "trial_ready" as const
    : isTrial
      ? "trial_active" as const
      : status === "overdue"
        ? "overdue" as const
        : "pending" as const;

  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className={`rounded-2xl p-3 ${statusInfo.className}`}>
            {status === "active" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : status === "overdue" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Cobrança · InfinitePay
            </p>
            <h2 className="mt-1 text-lg font-black">{lifecycleLabel}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">{lifecycleDetail}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[410px]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Plano mensal
            </p>
            <p className="mt-1 font-black">
              {planName(account.tier)} · R$ {PLAN_CONFIGS[account.tier].price}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" /> {dueLabel}
            </p>
            <p className="mt-1 font-black">
              {isTrialReady
                ? "No primeiro lead capturado"
                : dueAt
                  ? new Date(dueAt).toLocaleDateString("pt-BR")
                  : "Após a ativação"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium leading-relaxed text-slate-500">
          {isTrialReady
            ? "Você pode configurar e divulgar seu link com calma. A contagem ainda não começou."
            : isTrial
              ? "Você pode assinar antes do encerramento sem perder seus dados."
              : "A aprovação é verificada diretamente na InfinitePay e libera o acesso automaticamente."}
        </p>
        {showPaymentLink && (
          <button
            type="button"
            disabled={paymentBusy}
            onClick={() => {
              if (!onStartCheckout || paymentBusy) return;
              setPaymentBusy(true);
              setPaymentError(null);
              void onStartCheckout(intentContext).catch((error: unknown) => {
                setPaymentError(error instanceof Error ? error.message : "Não foi possível abrir o pagamento.");
                setPaymentBusy(false);
              });
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-700"
          >
            {paymentBusy
              ? "Preparando checkout"
              : isTrialReady || isTrial
                ? "Assinar plano"
                : "Abrir InfinitePay"}
            {paymentBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          </button>
        )}
      </div>
      {paymentError && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
          {paymentError}
        </p>
      )}
    </article>
  );
};
