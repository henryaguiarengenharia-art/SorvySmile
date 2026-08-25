import React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { paymentUrlFor, PLAN_CONFIGS, planName } from "../planCatalog";
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
}

export const BillingSummaryCard: React.FC<BillingSummaryCardProps> = ({
  account,
  readOnly = false,
}) => {
  const status = account.status ?? "pending";
  const statusInfo = statusCopy[status];
  const isTrial = account.subscriptionStatus === "trial" || account.trialStatus === "active";
  const dueAt = isTrial ? account.trialUntil ?? 0 : account.renewAt;
  const dueLabel = isTrial ? "Fim do teste" : "Próximo vencimento";
  const paymentUrl = paymentUrlFor(account.tier);
  const showPaymentLink = !readOnly
    && Boolean(paymentUrl)
    && (status === "pending" || status === "overdue");

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
            <h2 className="mt-1 text-lg font-black">{statusInfo.label}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">{statusInfo.detail}</p>
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
              {dueAt ? new Date(dueAt).toLocaleDateString("pt-BR") : "Após a ativação"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium leading-relaxed text-slate-500">
          E-mails e mensagens de cobrança são enviados diretamente pela InfinitePay.
        </p>
        {showPaymentLink && (
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-700"
          >
            Abrir InfinitePay <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </article>
  );
};
