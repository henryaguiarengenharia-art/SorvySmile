
import React, { useState, useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  UserCheck,
  DollarSign,
  X,
  Building2,
  Search,
  MoreVertical,
  CheckCircle2,
  Phone,
  Clock,
  Settings,
  ShieldPlus
} from 'lucide-react';
import { LeadRecord, DentistRecord, BillingAccount, PlanTier, PlanConfig, AccountStatus, AccountRisk } from '../types';

interface HQDashboardViewProps {
  leadRecords: LeadRecord[];
  dentistRecords: DentistRecord[];
  billingAccounts: Record<string, BillingAccount>;
  usageByAccount: Record<string, Record<string, number>>;
  planConfigs: Record<PlanTier, PlanConfig>;
  onUpdateDentist: (id: string, patch: Partial<DentistRecord>) => void;
  onUpdateLead: (id: string, patch: Partial<LeadRecord>) => void;
  onUpdateBilling: (id: string, patch: Partial<BillingAccount>) => void;
  onOpenWhatsApp: (number: string, message: string) => void;
  onResolveBacklog: () => void;
  onPrioritizeCriticalIA: () => void;
  onReassignInactivePortfolio: (dentistId: string) => void;
}

type AccountFilter = 'all' | 'pending' | 'expiring' | 'risk' | 'overdue';

export const HQDashboardView: React.FC<HQDashboardViewProps> = ({
  leadRecords,
  dentistRecords,
  billingAccounts: propBillingAccounts,
  planConfigs,
  onOpenWhatsApp,
  onUpdateBilling,
  onUpdateDentist
}) => {
  const [activeTierFilter, setActiveTierFilter] = useState<PlanTier | 'all'>('all');
  const [accountSearch, setAccountSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<AccountFilter>('all');
  const [selectedAccount, setSelectedAccount] = useState<BillingAccount | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<BillingAccount | null>(null);
  
  const [grantTrial, setGrantTrial] = useState(false);
  const [, setTempUpgrade] = useState<'none' | '30d'>('none');

  const accounts = useMemo(() => Object.values(propBillingAccounts), [propBillingAccounts]);

  const getDaysToRenew = (renewAt: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renew = new Date(renewAt);
    renew.setHours(0, 0, 0, 0);
    return Math.ceil((renew.getTime() - today.getTime()) / (1000 * 3600 * 24));
  };

  const isExpiringSoon = (renewAt: number) => {
    const days = getDaysToRenew(renewAt);
    return days >= 0 && days <= 7;
  };

  const isOverdueAccount = (acc: BillingAccount) => {
    return acc.status === 'overdue' || (!acc.isActive && acc.status !== 'pending' && acc.status !== 'paused');
  };

  const getAccountUsagePct = (acc: BillingAccount) => {
    const plan = planConfigs[acc.tier];
    if (!plan) return { pct: 0, label: "—", raw: 0 };
    
    const limit = plan.baseMonthlyLeadLimit + (acc.addOnLeads || 0);
    if (limit === 0) return { pct: 0, label: "—", raw: 0 };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const leadsThisMonth = leadRecords.filter(l => {
      const d = new Date(l.createdAt);
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return false;

      let leadAccId = "";
      if (l.ownerType === 'clinic' && l.ownerId) {
        leadAccId = l.ownerId;
      } else if (l.dentistId) {
        const dentist = dentistRecords.find(dr => dr.id === l.dentistId);
        if (dentist) leadAccId = dentist.billingAccountId;
      } else if (l.ownerId) {
        leadAccId = l.ownerId;
      }

      return leadAccId === acc.id;
    }).length;

    const pct = (leadsThisMonth / limit) * 100;
    const clampedPct = Math.min(999, Math.max(0, pct));
    return { 
      pct: clampedPct, 
      label: `${Math.floor(clampedPct)}%`, 
      raw: leadsThisMonth,
      limit
    };
  };

  const handleAccountWhatsApp = (acc: BillingAccount) => {
    const daysToRenew = getDaysToRenew(acc.renewAt);
    const usage = getAccountUsagePct(acc);
    const vars = {
      nomeConta: acc.accountName || acc.id,
      plano: acc.tier.toUpperCase(),
      diasParaVencer: daysToRenew.toString(),
      usoPct: usage.label
    };

    let message = "";

    if (acc.status === 'pending') {
      message = `Olá ${vars.nomeConta}! Recebemos seu pagamento do plano ${vars.plano}. Estou ativando sua conta agora!`;
    } else if (daysToRenew >= 0 && daysToRenew <= 7) {
      message = `Olá ${vars.nomeConta}! Sua renovação do plano ${vars.plano} está próxima.`;
    } else {
      message = `Olá ${vars.nomeConta}! Tudo bem? Gostaria de saber como está sua experiência na Sorvy.`;
    }

    onOpenWhatsApp(acc.checkoutWhatsapp || '5531987654321', message);
  };

  const businessStats = useMemo(() => {
    const active = accounts.filter(a => a.status === 'active' || a.status === 'overdue');
    const mrr = active.reduce((acc, curr) => {
      const plan = planConfigs[curr.tier];
      if (!plan) return acc;
      const extraSeats = Math.max(0, curr.seatsTotal - plan.includedSeats);
      return acc + plan.price + (extraSeats * plan.extraSeatPrice);
    }, 0);
    const funnel = {
      total: leadRecords.length,
      analyzed: leadRecords.filter(l => l.scores).length,
      converted: leadRecords.filter(l => l.status === 'closed').length,
    };
    const conversionRate = funnel.total > 0 ? ((funnel.converted / funnel.total) * 100).toFixed(1) : "0";
    const backlogCount = leadRecords.filter(l => l.status === 'new' && !l.firstContactAt && (Date.now() - l.createdAt) > 120 * 60 * 1000).length;
    return { mrr, funnel, conversionRate, backlogCount };
  }, [accounts, leadRecords, planConfigs]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = acc.accountName?.toLowerCase().includes(accountSearch.toLowerCase());
      const matchesTier = activeTierFilter === 'all' || acc.tier === activeTierFilter;
      
      let matchesFilter = true;
      if (activeFilter === 'pending') matchesFilter = acc.status === 'pending';
      else if (activeFilter === 'overdue') matchesFilter = isOverdueAccount(acc);
      else if (activeFilter === 'risk') matchesFilter = acc.riskLevel !== 'ok';
      else if (activeFilter === 'expiring') matchesFilter = isExpiringSoon(acc.renewAt);

      return matchesSearch && matchesTier && matchesFilter;
    });
  }, [accounts, accountSearch, activeTierFilter, activeFilter]);

  const handleApprove = (id: string, overrideTier?: PlanTier) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    
    const finalTier = overrideTier || acc.requestedPlan || acc.tier;
    const finalType = acc.requestedAccountType || acc.ownerType;
    const plan = planConfigs[finalTier];
    
    const now = Date.now();
    const updates: Partial<BillingAccount> = {
      status: 'active',
      isActive: true,
      tier: finalTier,
      ownerType: finalType,
      seatsTotal: plan.includedSeats,
      activatedAt: now,
      startAt: now,
      activatedBy: 'HQ_ADMIN',
      trialUntil: grantTrial ? now + 7 * 24 * 3600 * 1000 : undefined,
      overrideUntil: overrideTier ? now + 30 * 24 * 3600 * 1000 : undefined,
      renewAt: now + 30 * 24 * 3600 * 1000 
    };
    onUpdateBilling(id, updates);

    // Also activate the dentist(s) linked to this billing account
    const linkedDentists = dentistRecords.filter(d => d.billingAccountId === id);
    linkedDentists.forEach(d => onUpdateDentist(d.id, { isActive: true, plan: finalTier }));

    setShowApprovalModal(null);
    setGrantTrial(false);
    setTempUpgrade('none');
  };

  return (
    <div className="px-6 py-12 max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-200">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Sorvy HQ</h2>
            <div className="bg-slate-900 px-3 py-1.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> DONO DA REDE
            </div>
          </div>
          <p className="text-slate-400 font-bold text-sm">Gestão Estratégica & Governança do Ecossistema</p>
        </div>
        
        <div className="bg-slate-900 rounded-[1.5rem] px-8 py-4 text-white shadow-xl shadow-slate-200">
           <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Faturamento Estimado (MRR)</p>
           <p className="text-2xl font-black text-green-400">R$ {businessStats.mrr.toLocaleString('pt-BR')}</p>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-6">
        <KPIBox label="Leads na Rede" value={businessStats.funnel.total} icon={<Users className="w-5 h-5" />} color="blue" />
        <KPIBox label="Analisados IA" value={businessStats.funnel.analyzed} icon={<Zap className="w-5 h-5" />} color="indigo" />
        <KPIBox label="Conversão Média" value={`${businessStats.conversionRate}%`} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
        <KPIBox label="Faturamento Total" value={`R$ ${businessStats.mrr.toLocaleString('pt-BR')}`} icon={<DollarSign className="w-5 h-5" />} color="purple" />
      </div>

      <section className="bg-white border rounded-[3rem] p-10 shadow-sm space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 p-3 rounded-2xl text-slate-900"><Building2 className="w-6 h-6" /></div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Contas da Rede</h3>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar conta..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-slate-600 outline-none w-64 focus:border-blue-500 transition-all"
              />
            </div>
            <select 
              value={activeTierFilter}
              onChange={(e) => setActiveTierFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none"
            >
              <option value="all">Todos Planos</option>
              <option value="lite">Lite</option>
              <option value="pro">Pro</option>
              <option value="network">Network</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
           <FilterChip label="Todas" active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
           <FilterChip label="Pendentes" count={accounts.filter(a => a.status === 'pending').length} active={activeFilter === 'pending'} onClick={() => setActiveFilter('pending')} color="blue" />
           <FilterChip label="Vencem em 7d" count={accounts.filter(a => isExpiringSoon(a.renewAt)).length} active={activeFilter === 'expiring'} onClick={() => setActiveFilter('expiring')} color="orange" />
           <FilterChip label="Em Risco" count={accounts.filter(a => a.riskLevel !== 'ok').length} active={activeFilter === 'risk'} onClick={() => setActiveFilter('risk')} color="red" />
           <FilterChip label="Inadimplentes" count={accounts.filter(a => isOverdueAccount(a)).length} active={activeFilter === 'overdue'} onClick={() => setActiveFilter('overdue')} color="red" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                <th className="px-6 py-4">Nome da Conta</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Plano</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Renovação</th>
                <th className="px-6 py-4">Uso de Cota</th>
                <th className="px-6 py-4">Risco</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAccounts.map((acc) => {
                const usageInfo = getAccountUsagePct(acc);
                const daysToRenew = getDaysToRenew(acc.renewAt);
                
                return (
                  <tr key={acc.id} className="text-sm font-medium hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <p className="font-black text-slate-900 leading-tight">{acc.accountName}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{acc.id}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] font-black uppercase tracking-tight">{acc.ownerType === 'clinic' ? 'CLÍNICA' : 'SOLO'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${acc.tier === 'network' ? 'bg-purple-100 text-purple-600' : acc.tier === 'pro' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                        {acc.tier}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={acc.status || 'active'} />
                    </td>
                    <td className="px-6 py-5">
                      <p className={`text-xs font-bold ${daysToRenew < 0 ? 'text-red-600' : daysToRenew <= 7 ? 'text-orange-600' : 'text-slate-500'}`}>
                        {daysToRenew < 0 ? `vencido há ${Math.abs(daysToRenew)}d` : `vence em ${daysToRenew}d`}
                      </p>
                    </td>
                    <td className="px-6 py-5 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${usageInfo.pct > 90 ? 'bg-red-500' : usageInfo.pct > 70 ? 'bg-orange-500' : 'bg-blue-600'}`} style={{ width: `${usageInfo.pct}%` }}></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400">{usageInfo.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <RiskDot risk={acc.riskLevel || 'ok'} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      {acc.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleAccountWhatsApp(acc)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl" title="Confirmar pagamento"><Phone className="w-4 h-4" /></button>
                          <button onClick={() => setShowApprovalModal(acc)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">Ativar</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleAccountWhatsApp(acc)} className="p-2 text-green-600 hover:bg-green-50 rounded-xl"><Phone className="w-4 h-4" /></button>
                          <button onClick={() => setSelectedAccount(acc)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><MoreVertical className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showApprovalModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in duration-300">
            <div className="p-10 space-y-8">
              <div className="text-center space-y-2">
                <div className="inline-flex p-4 bg-blue-50 text-blue-600 rounded-3xl mb-4"><UserCheck className="w-10 h-10" /></div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Ativar Nova Conta</h3>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{showApprovalModal.accountName || showApprovalModal.id}</p>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                   <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano Solicitado</span>
                      <span className="text-sm font-black text-blue-600 uppercase">{(showApprovalModal.requestedPlan || showApprovalModal.tier)}</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Conta</span>
                      <span className="text-sm font-black text-slate-900 uppercase">{(showApprovalModal.requestedAccountType || showApprovalModal.ownerType)}</span>
                   </div>
                   <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato Checkout</span>
                      <span className="text-xs font-black text-slate-900">{showApprovalModal.checkoutWhatsapp || 'Não informado'}</span>
                   </div>
                </div>
                
                <div className="space-y-4">
                  <label className="flex items-center gap-4 cursor-pointer p-4 bg-blue-50 rounded-2xl border border-blue-100 group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={grantTrial} 
                          onChange={(e) => setGrantTrial(e.target.checked)}
                          className="w-6 h-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-blue-700 uppercase tracking-tight">Ceder 7 dias de Degustação Grátis</p>
                        <p className="text-[9px] font-bold text-blue-400 uppercase">Ideal para conversão de leads frios</p>
                      </div>
                   </label>
                </div>
              </div>

              <div className="space-y-3">
                 <button 
                  onClick={() => handleApprove(showApprovalModal.id)} 
                  className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3"
                 >
                   <CheckCircle2 className="w-4 h-4" /> APROVAR PLANO SOLICITADO
                 </button>
                 
                 <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest">
                      <span className="bg-white px-3 text-slate-400">Opções Extras</span>
                    </div>
                 </div>

                 <button 
                  onClick={() => handleApprove(showApprovalModal.id, 'network')} 
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-blue-600 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3"
                 >
                   <ShieldPlus className="w-4 h-4" /> UPGRADE PARA NETWORK (30D)
                 </button>
              </div>

              <button 
                onClick={() => { setShowApprovalModal(null); setGrantTrial(false); }} 
                className="w-full py-2 font-black text-[10px] uppercase text-slate-400 hover:text-slate-600 transition-colors tracking-widest"
              >
                Cancelar Ativação
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAccount && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in duration-300">
            <div className="p-10 space-y-8">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white"><Settings className="w-6 h-6" /></div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Gerenciar: {selectedAccount.accountName}</h3>
                 </div>
                 <button onClick={() => setSelectedAccount(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo do Plano</p>
                    <div className="flex justify-between items-center">
                       <span className="text-sm font-bold text-slate-700">Plano Atual</span>
                       <span className="text-sm font-black text-blue-600 uppercase">{selectedAccount.tier}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-sm font-bold text-slate-700">Status</span>
                       <StatusBadge status={selectedAccount.status || 'active'} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button onClick={() => { onUpdateBilling(selectedAccount.id, { status: 'active', isActive: true }); setSelectedAccount(null); }} className="w-full flex items-center justify-between p-4 bg-green-50 text-green-700 rounded-2xl font-black text-xs uppercase hover:bg-green-100 transition-colors">
                      Reativar / Renovar agora <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { onUpdateBilling(selectedAccount.id, { status: 'paused', isActive: false }); setSelectedAccount(null); }} className="w-full flex items-center justify-between p-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">
                      Pausar Conta <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas Internas</label>
                    <textarea 
                      placeholder="Adicione notas sobre o relacionamento..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-900 text-xs h-32 outline-none focus:border-blue-500 transition-colors"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Added missing sub-components */

const FilterChip = ({ label, count, active, onClick, color = "blue" }: any) => {
  const colors: any = {
    blue: active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50',
    orange: active ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50',
    red: active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50',
  };
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap flex items-center gap-2 ${colors[color]}`}
    >
      {label} {count !== undefined && <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>}
    </button>
  );
};

const StatusBadge = ({ status }: { status: AccountStatus | string }) => {
  const styles: any = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-blue-100 text-blue-700',
    overdue: 'bg-red-100 text-red-700',
    paused: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
};

const RiskDot = ({ risk }: { risk: AccountRisk | string }) => {
  const styles: any = {
    ok: 'bg-green-500',
    attention: 'bg-orange-500',
    critical: 'bg-red-500',
  };
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${styles[risk] || styles.ok}`}></div>
      <span className="text-[10px] font-bold text-slate-400 uppercase">{risk}</span>
    </div>
  );
};

const KPIBox = ({ label, value, icon, color }: any) => {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
  };
  return (
    <div className="bg-white border rounded-[2rem] p-6 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  );
};
