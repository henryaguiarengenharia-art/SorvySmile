
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  Target, 
  UserPlus, 
  ShieldCheck, 
  Clock, 
  AlertTriangle,
  Plus,
  RotateCcw,
  History,
  UserCheck,
  Search,
  X,
  Power,
  ChevronRight,
  Phone,
  ArrowUpRight,
  AlertCircle,
  ListRestart,
  Save,
  LayoutDashboard,
  Building2,
  Settings,
  Link as LinkIcon,
  CreditCard,
  ChevronDown,
  Sparkles,
  Camera,
  MapPin,
  Instagram,
  Copy,
  Lightbulb,
  Trophy
} from 'lucide-react';
import { LeadRecord, DentistRecord, BillingAccount, PlanConfig, LeadStatus, ClinicSettings } from '../types';

const displayPhone = (val: string): string => {
  const d = val.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return val;
};

interface AdminDashboardViewProps {
  leadRecords: LeadRecord[];
  dentistRecords: DentistRecord[];
  billingAccount: BillingAccount;
  planConfig: PlanConfig;
  currentUsage: number;
  clinicSettings: ClinicSettings;
  onUpdateDentist: (id: string, patch: Partial<DentistRecord>) => void;
  onAddDentist: (dentist: DentistRecord) => void;
  onUpdateLead: (id: string, patch: Partial<LeadRecord>) => void;
  onUpdateBilling: (id: string, patch: Partial<BillingAccount>) => void;
  onUpdateClinicSettings: (patch: Partial<ClinicSettings>) => void;
  onOpenWhatsApp: (number: string, message: string) => void;
}

type AdminTab = 'dashboard' | 'leads' | 'dentists' | 'profile';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  leadRecords,
  dentistRecords,
  billingAccount,
  planConfig,
  currentUsage,
  clinicSettings,
  onUpdateDentist,
  onAddDentist,
  onUpdateLead,
  onUpdateClinicSettings,
  onOpenWhatsApp
}) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');
  const [leadSearchTerm, setLeadSearchTerm] = useState("");
  const [dentistSearchTerm, setDentistSearchTerm] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [onlyBacklogFilter, setOnlyBacklogFilter] = useState(false);
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useState(false);
  const [riskDentistsOnly, setRiskDentistsOnly] = useState(false);
  const [showAddDentistModal, setShowAddDentistModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localClinicName, setLocalClinicName] = useState(clinicSettings.clinicName || "");
  const [localReceptionistWhatsapp, setLocalReceptionistWhatsapp] = useState(clinicSettings.receptionistWhatsapp || "");
  const [localPublicSlug, setLocalPublicSlug] = useState(clinicSettings.publicSlug || "");

  useEffect(() => {
    setLocalClinicName(clinicSettings.clinicName || "");
    setLocalReceptionistWhatsapp(clinicSettings.receptionistWhatsapp || "");
    setLocalPublicSlug(clinicSettings.publicSlug || "");
  }, [clinicSettings]);

  const bioCaptaçãoUrl = `${window.location.origin}${window.location.pathname}?c=${localPublicSlug}`;

  const [newDentist, setNewDentist] = useState({
    name: '',
    whatsapp: '',
    email: '',
    teamTag: 'Especialista',
    city: '',
    state: '',
    profileImage: '',
    publicSlug: ''
  });

  const now = Date.now();
  const slaTargetMinutes = clinicSettings.slaMinutes || 120;
  const criticalThreshold = slaTargetMinutes * 60 * 1000;

  const clinicDentists = useMemo(() => 
    dentistRecords.filter(d => d.billingAccountId === billingAccount.id),
  [dentistRecords, billingAccount.id]);

  const clinicLeads = useMemo(() => 
    leadRecords.filter(l => {
      return (l.ownerType === 'clinic' && l.ownerId === billingAccount.id) || 
             (l.dentistId && clinicDentists.some(d => d.id === l.dentistId));
    }),
  [leadRecords, clinicDentists, billingAccount.id]);

  const teamMetrics = useMemo(() => {
    return clinicDentists.map(dentist => {
      const leads = leadRecords.filter(l => l.dentistId === dentist.id);
      const responded = leads.filter(l => l.firstContactAt);
      const closed = leads.filter(l => l.status === 'closed').length;
      const lost = leads.filter(l => l.status === 'lost').length;
      const finished = closed + lost;
      
      const avgSla = responded.length > 0
        ? Math.floor(responded.reduce((acc, l) => acc + (l.firstContactAt! - l.createdAt), 0) / (responded.length * 60000))
        : 0;

      const withinSlaCount = responded.filter(l => (l.firstContactAt! - l.createdAt) <= criticalThreshold).length;
      const slaCompliance = responded.length > 0 ? Math.round((withinSlaCount / responded.length) * 100) : 0;

      const backlogCount = leads.filter(l => l.status === 'new' && !l.firstContactAt && (now - l.createdAt) > criticalThreshold).length;

      return {
        dentist,
        conversion: finished > 0 ? ((closed / finished) * 100).toFixed(1) : "0",
        avgSla,
        slaCompliance,
        backlogCount,
        isAtRisk: backlogCount > 0 || (avgSla > slaTargetMinutes && responded.length > 0)
      };
    });
  }, [clinicDentists, leadRecords, now, criticalThreshold, slaTargetMinutes]);

  const stats = useMemo(() => {
    const backlogCount = clinicLeads.filter(l => l.status === 'new' && !l.firstContactAt && (now - l.createdAt) > criticalThreshold).length;
    const leadsWithSla = clinicLeads.filter(l => l.firstContactAt);
    const avgSla = leadsWithSla.length > 0 
      ? Math.floor(leadsWithSla.reduce((acc, l) => acc + (l.firstContactAt! - l.createdAt), 0) / (leadsWithSla.length * 60000))
      : 0;

    const closed = clinicLeads.filter(l => l.status === 'closed').length;
    const lost = clinicLeads.filter(l => l.status === 'lost').length;
    const conversion = (closed + lost) > 0 ? ((closed / (closed + lost)) * 100).toFixed(1) : "0";

    return { 
      activeCount: clinicDentists.filter(d => d.isActive).length,
      leadsTotal: clinicLeads.length,
      conversion,
      backlogCount,
      avgSla,
      queuedCount: clinicLeads.filter(l => l.status === 'new' && !l.dentistId).length,
      riskCount: teamMetrics.filter(m => m.isAtRisk).length
    };
  }, [clinicDentists, clinicLeads, now, criticalThreshold, teamMetrics, slaTargetMinutes]);

  const filteredLeads = useMemo(() => {
    return clinicLeads.filter(l => {
      const matchesSearch = l.lead.name.toLowerCase().includes(leadSearchTerm.toLowerCase()) || l.lead.whatsapp.includes(leadSearchTerm);
      const matchesStatus = leadStatusFilter === 'all' || l.status === leadStatusFilter;
      const isBacklog = l.status === 'new' && !l.firstContactAt && (now - l.createdAt) > criticalThreshold;
      const matchesBacklog = !onlyBacklogFilter || isBacklog;
      const matchesUnassigned = !unassignedOnlyFilter || !l.dentistId;
      return matchesSearch && matchesStatus && matchesBacklog && matchesUnassigned;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [clinicLeads, leadSearchTerm, leadStatusFilter, onlyBacklogFilter, unassignedOnlyFilter, now, criticalThreshold]);

  const filteredTeam = useMemo(() => {
    return teamMetrics.filter(m => {
      const matchesSearch = m.dentist.name.toLowerCase().includes(dentistSearchTerm.toLowerCase());
      const matchesRisk = !riskDentistsOnly || m.isAtRisk;
      return matchesSearch && matchesRisk;
    });
  }, [teamMetrics, dentistSearchTerm, riskDentistsOnly]);

  const handleAddDentist = () => {
    if (!newDentist.name.trim() || !newDentist.whatsapp.trim() || !newDentist.city.trim() || !newDentist.state.trim()) {
      alert("Por favor, preencha Nome, WhatsApp, Cidade e UF.");
      return;
    }
    
    const newRecord: DentistRecord = {
      id: `dentist_${Date.now()}`,
      name: newDentist.name,
      whatsapp: newDentist.whatsapp,
      email: newDentist.email,
      plan: billingAccount.tier,
      role: 'dentist',
      billingAccountId: billingAccount.id,
      isActive: true,
      createdAt: Date.now(),
      teamTag: newDentist.teamTag,
      city: newDentist.city,
      state: newDentist.state,
      profileImage: newDentist.profileImage,
      publicSlug: newDentist.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000)
    };

    onAddDentist(newRecord);
    setShowAddDentistModal(false);
    setNewDentist({ name: '', whatsapp: '', email: '', teamTag: 'Especialista', city: '', state: '', profileImage: '', publicSlug: '' });
  };

  const handleModalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewDentist(prev => ({ ...prev, profileImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAttribution = (leadId: string, dentistId: string) => {
    const dentist = clinicDentists.find(d => d.id === dentistId);
    if (!dentist) return;
    onUpdateLead(leadId, { 
      dentistId, 
      clinicAssigned: dentist.name,
      isQueued: false,
      matchStatus: 'matched'
    });
  };

  const getSLAStyle = (min: number) => {
    if (min > slaTargetMinutes) return 'text-red-600 bg-red-50';
    if (min > slaTargetMinutes / 2) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  const handleSaveClinicSettings = () => {
    onUpdateClinicSettings({
      clinicName: localClinicName,
      receptionistWhatsapp: localReceptionistWhatsapp,
      publicSlug: localPublicSlug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    });
    alert("Configurações da clínica salvas com sucesso!");
  };

  const rankingTop3 = useMemo(() => {
    return [...teamMetrics]
      .filter(m => Number(m.conversion) > 0 || m.avgSla > 0)
      .sort((a, b) => Number(b.conversion) - Number(a.conversion))
      .slice(0, 3);
  }, [teamMetrics]);

  const handleCopyCaption = () => {
    const caption = "Seu sorriso em HD! ✨ Faça agora uma triagem rápida clicando no link oficial da minha bio e receba um laudo preliminar de harmonia visual em segundos! 🦷📱 #SorvySmile #EsteticaDental";
    navigator.clipboard.writeText(caption);
    alert("Legenda copiada para o clipboard!");
  };

  return (
    <div className="px-6 py-12 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Painel da Clínica</h2>
            <div className="bg-slate-900 px-3 py-1.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> ADMIN MODE
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
            <Building2 className="w-4 h-4" /> 
            <span className="text-slate-900 font-black">{clinicSettings.clinicName || billingAccount.id.replace('acc_', 'Unidade ')}</span>
            <span className="mx-1">•</span>
            <span className="uppercase tracking-widest text-[10px] bg-slate-100 px-2 py-0.5 rounded font-black text-slate-600">{planConfig.tier}</span>
          </div>
        </div>
        
        <nav className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
          <TabButton active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} label="GERAL" icon={<LayoutDashboard className="w-4 h-4" />} />
          <TabButton active={currentTab === 'leads'} onClick={() => setCurrentTab('leads')} label="LEADS" icon={<Users className="w-4 h-4" />} />
          <TabButton active={currentTab === 'dentists'} onClick={() => setCurrentTab('dentists')} label="EQUIPE" icon={<UserCheck className="w-4 h-4" />} />
          <TabButton active={currentTab === 'profile'} onClick={() => setCurrentTab('profile')} label="CONFIG" icon={<Settings className="w-4 h-4" />} />
        </nav>
      </header>

      {currentTab === 'dashboard' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
             <KPICard label="Time Ativo" value={stats.activeCount} icon={<Users className="w-4 h-4" />} />
             <KPICard label="Leads Totais" value={stats.leadsTotal} icon={<History className="w-4 h-4" />} />
             <KPICard label="Conversão (%)" value={`${stats.conversion}%`} icon={<Target className="w-4 h-4" />} color="emerald" />
             <div onClick={() => { setOnlyBacklogFilter(true); setCurrentTab('leads'); }} className="cursor-pointer">
               <KPICard label="Backlog Crítico" value={stats.backlogCount} color={stats.backlogCount > 0 ? "red" : "blue"} icon={<AlertTriangle className="w-4 h-4" />} />
             </div>
             <KPICard label="SLA Médio" value={`${stats.avgSla}m`} color={stats.avgSla > slaTargetMinutes ? "red" : "blue"} icon={<Clock className="w-4 h-4" />} />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] flex flex-col justify-between hover:border-red-200 transition-all shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-4">
                   <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">Resolver Backlog</h4>
                   <div className={`p-3 rounded-2xl ${stats.backlogCount > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                     <RotateCcw className="w-5 h-5" />
                   </div>
                </div>
                <p className={`text-5xl font-black mb-1 ${stats.backlogCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.backlogCount}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Leads em atraso crítico</p>
              </div>
              <button 
                onClick={() => { setOnlyBacklogFilter(true); setCurrentTab('leads'); }}
                className="w-full mt-8 bg-red-600 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
              >
                REATRIBUIR AGORA <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] flex flex-col justify-between hover:border-orange-200 transition-all shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-4">
                   <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">Time em Risco</h4>
                   <div className={`p-3 rounded-2xl ${stats.riskCount > 0 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                     <AlertCircle className="w-5 h-5" />
                   </div>
                </div>
                <p className={`text-5xl font-black mb-1 ${stats.riskCount > 0 ? 'text-orange-600' : 'text-slate-900'}`}>{stats.riskCount}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissionais com lentidão</p>
              </div>
              <button 
                onClick={() => { setRiskDentistsOnly(true); setCurrentTab('dentists'); }}
                className="w-full mt-8 bg-orange-500 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
              >
                NOTIFICAR WHATS <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] flex flex-col justify-between hover:border-blue-200 transition-all shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-4">
                   <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">Leads em Fila</h4>
                   <div className={`p-3 rounded-2xl ${stats.queuedCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                     <ListRestart className="w-5 h-5" />
                   </div>
                </div>
                <p className={`text-5xl font-black mb-1 ${stats.queuedCount > 0 ? 'text-blue-600' : 'text-slate-900'}`}>{stats.queuedCount}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando liberação</p>
              </div>
              <button 
                onClick={() => { setUnassignedOnlyFilter(true); setCurrentTab('leads'); }}
                className="w-full mt-8 bg-blue-600 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                LIBERAR FILA <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Insights da Clínica</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
                <Instagram className="absolute -top-4 -right-4 w-24 h-24 text-white/5 group-hover:rotate-12 transition-transform" />
                <div className="relative z-10 space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-2">
                    <h4 className="text-lg font-black flex items-center gap-2">
                      <Instagram className="w-5 h-5 text-pink-500" /> Post do Dia
                    </h4>
                    <p className="text-xs font-medium text-white/60 italic leading-relaxed">
                      "Seu sorriso em HD! ✨ Faça agora uma triagem rápida clicando no link oficial da minha bio..."
                    </p>
                  </div>
                  <button 
                    onClick={handleCopyCaption}
                    className="w-full bg-white/10 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:text-slate-900 transition-all border border-white/10"
                  >
                    <Copy className="w-4 h-4" /> Copiar Legenda
                  </button>
                </div>
              </div>

              <div className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] flex flex-col justify-center space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight">Dica de Performance</h4>
                </div>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  {stats.avgSla > 30 
                    ? "Notamos que o tempo de resposta está alto. Clínicas que respondem em menos de 15 minutos convertem até 4x mais leads em agendamentos."
                    : "Excelente tempo de resposta! Manter a prontidão no primeiro contato é o fator #1 para garantir o comparecimento na avaliação."}
                </p>
              </div>

              <div className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Ranking do Time
                  </h4>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top 3</span>
                </div>
                <div className="space-y-4">
                  {rankingTop3.length > 0 ? rankingTop3.map((m, i) => (
                    <div key={m.dentist.id} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-500' : 'bg-orange-50 text-orange-700'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-900 truncate">{m.dentist.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-bold text-slate-400">{m.avgSla}m resposta</span>
                          <span className="text-[9px] font-black text-blue-600">{m.slaCompliance}% SLA</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-emerald-600">{m.conversion}% conv.</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center py-4 text-xs font-medium text-slate-400 italic">Sem dados de conversão ainda.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'leads' && (
        <div className="bg-white border rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="px-8 py-6 border-b flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-black text-lg text-slate-900 mr-4">Triagem & Atribuição</h3>
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" placeholder="Nome ou WhatsApp..." value={leadSearchTerm} onChange={(e) => setLeadSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 ring-blue-500/20"
                />
              </div>
              <select 
                value={leadStatusFilter} onChange={(e) => setLeadStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none"
              >
                <option value="all">Todos Status</option>
                <option value="new">Novos</option>
                <option value="in_chat">Conversa</option>
                <option value="scheduled">Agendados</option>
              </select>
              <button 
                onClick={() => setOnlyBacklogFilter(!onlyBacklogFilter)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${onlyBacklogFilter ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100' : 'bg-white text-slate-400 border-slate-200'}`}
              >
                Backlog Crítico
              </button>
              <button 
                onClick={() => setUnassignedOnlyFilter(!unassignedOnlyFilter)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${unassignedOnlyFilter ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-white text-slate-400 border-slate-200'}`}
              >
                Sem Dentista
              </button>
            </div>
            {(onlyBacklogFilter || leadSearchTerm || leadStatusFilter !== 'all' || unassignedOnlyFilter) && (
              <button 
                onClick={() => { setLeadSearchTerm(""); setLeadStatusFilter('all'); setOnlyBacklogFilter(false); setUnassignedOnlyFilter(false); }}
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
              >
                <RotateCcw className="w-3 h-3" /> Limpar Filtros
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <th className="px-8 py-4">Entrada</th>
                  <th className="px-8 py-4">Paciente</th>
                  <th className="px-8 py-4">Origem</th>
                  <th className="px-8 py-4">Recomendação IA</th>
                  <th className="px-8 py-4">Atraso</th>
                  <th className="px-8 py-4">Dentista</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((record) => {
                  const delayMin = Math.floor((now - record.createdAt) / 60000);
                  const isBacklog = record.status === 'new' && !record.firstContactAt && delayMin > slaTargetMinutes;
                  return (
                    <tr key={record.id} className={`hover:bg-slate-50/50 transition-colors ${isBacklog ? 'bg-red-50/30' : ''}`}>
                      <td className="px-8 py-4 text-[11px] font-bold text-slate-400">{new Date(record.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</td>
                      <td className="px-8 py-4">
                        <p className="font-black text-slate-900 text-sm leading-none mb-1">{record.lead.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{displayPhone(record.lead.whatsapp)}</p>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                           <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${record.source === 'bio' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                             {record.source === 'bio' ? 'Link Bio' : 'Direto'}
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{record.intentCategory || 'Indefinido'}</span>
                          {record.ticketLikely && (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full w-fit ${record.ticketLikely === 'Alto' ? 'bg-emerald-100 text-emerald-600' : record.ticketLikely === 'Médio' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                              Ticket {record.ticketLikely}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 font-bold italic">{record.recommendedSpecialty || 'Espec. Geral'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                         <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${record.firstContactAt ? 'text-green-600 bg-green-50' : (isBacklog ? 'text-red-600 bg-red-100' : 'text-slate-400 bg-slate-50')}`}>
                           {record.firstContactAt ? 'Respondido' : `${delayMin} min`}
                         </span>
                      </td>
                      <td className="px-8 py-4">
                        <div className="relative group/select">
                          <select 
                            value={record.dentistId || ""}
                            onChange={(e) => handleAttribution(record.id, e.target.value)}
                            className={`appearance-none bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none pr-8 cursor-pointer focus:ring-2 ring-blue-500/20 ${!record.dentistId ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-slate-700'}`}
                          >
                            <option value="">Não Atribuído</option>
                            {clinicDentists.filter(d => d.isActive).map(d => {
                               const isMatch = record.recommendedSpecialty && (
                                 d.specialty?.toLowerCase().includes(record.recommendedSpecialty.toLowerCase()) || 
                                 d.teamTag?.toLowerCase().includes(record.recommendedSpecialty.toLowerCase())
                               );
                               return (
                                 <option key={d.id} value={d.id}>
                                   {d.name} {isMatch ? '✨ MATCH' : ''}
                                 </option>
                               );
                            })}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button 
                          onClick={() => onOpenWhatsApp(record.lead.whatsapp, `Olá ${record.lead.name}! Sou da recepção da clínica Sorvy Smile. Recebemos sua triagem digital!`)}
                          className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"
                          title="Falar pela Recepção"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredLeads.length === 0 && (
                   <tr>
                     <td colSpan={7} className="px-8 py-20 text-center text-slate-400 font-medium italic">Nenhum lead encontrado com os filtros atuais.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'dentists' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" placeholder="Buscar no time..." value={dentistSearchTerm} onChange={(e) => setDentistSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-600 outline-none shadow-sm focus:ring-2 ring-blue-500/10"
                  />
                </div>
                <button 
                  onClick={() => setRiskDentistsOnly(!riskDentistsOnly)}
                  className={`p-4 rounded-2xl border transition-all ${riskDentistsOnly ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                  title="Somente em Risco"
                >
                  <AlertCircle className="w-5 h-5" />
                </button>
              </div>
              <button 
                onClick={() => setShowAddDentistModal(true)}
                className="w-full md:w-auto bg-slate-900 text-white font-black px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
              >
                <UserPlus className="w-4 h-4" /> Novo Dentista
              </button>
           </div>

           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeam.map((perf) => (
                <div key={perf.dentist.id} className={`bg-white border p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all relative overflow-hidden group ${perf.isAtRisk ? 'border-orange-200 ring-2 ring-orange-50' : 'border-slate-100'}`}>
                   {perf.isAtRisk && (
                     <div className="absolute top-0 right-0 bg-orange-500 text-white px-4 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                        Ação Necessária
                     </div>
                   )}
                   <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ${perf.dentist.isActive ? (perf.isAtRisk ? 'bg-orange-500' : 'bg-slate-900') : 'bg-slate-300'}`}>
                           {perf.dentist.profileImage ? (
                             <img src={perf.dentist.profileImage} className="w-full h-full object-cover" alt={perf.dentist.name} />
                           ) : (
                             <span className="text-xl font-black text-white">{perf.dentist.name.charAt(0)}</span>
                           )}
                         </div>
                         <div>
                            <h4 className="font-black text-slate-900 leading-tight">{perf.dentist.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                               <MapPin className="w-3 h-3" /> {perf.dentist.city || 'Cidade'}, {perf.dentist.state || 'UF'}
                            </p>
                         </div>
                      </div>
                      <button 
                        onClick={() => onUpdateDentist(perf.dentist.id, { isActive: !perf.dentist.isActive })}
                        className={`p-2.5 rounded-xl transition-all ${perf.dentist.isActive ? 'bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-600' : 'bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600'}`}
                        title={perf.dentist.isActive ? "Pausar recebimento" : "Ativar recebimento"}
                      >
                         <Power className="w-5 h-5" />
                      </button>
                   </div>

                   <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Conversão</p>
                         <p className="text-xl font-black text-slate-900">{perf.conversion}%</p>
                      </div>
                      <div className={`p-4 rounded-2xl text-center ${getSLAStyle(perf.avgSla)}`}>
                         <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1">SLA Médio</p>
                         <p className="text-xl font-black">{perf.avgSla}m</p>
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="flex flex-col">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{perf.dentist.teamTag || 'Especialista'}</span>
                         <span className={`text-sm font-black ${perf.backlogCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{perf.backlogCount} Críticos</span>
                      </div>
                      <button 
                        onClick={() => onOpenWhatsApp(perf.dentist.whatsapp, `Olá ${perf.dentist.name}, temos leads acumulados para você. Precisamos agilizar o contato!`)}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                      >
                        Cobrar <ChevronRight className="w-3 h-3" />
                      </button>
                   </div>
                </div>
              ))}
              {filteredTeam.length === 0 && (
                 <div className="col-span-full py-20 text-center text-slate-400 font-medium italic">Nenhum dentista encontrado com os filtros atuais.</div>
              )}
           </div>
        </div>
      )}

      {currentTab === 'profile' && (
        <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="lg:col-span-2 space-y-8">
              <section className="bg-white border rounded-[3rem] p-10 shadow-sm space-y-10">
                 <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white">
                       <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-900">Configurações da Unidade</h3>
                       <p className="text-slate-500 font-medium text-sm">Gerencie os dados e regras operacionais da sua clínica.</p>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         Nome da Clínica
                       </label>
                       <input 
                          type="text" 
                          value={localClinicName}
                          onChange={(e) => setLocalClinicName(e.target.value)}
                          placeholder="Nome Fantasia"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:border-blue-500 outline-none transition-colors shadow-inner"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         WhatsApp Recepção
                       </label>
                       <input 
                          type="text" 
                          value={localReceptionistWhatsapp}
                          onChange={(e) => setLocalReceptionistWhatsapp(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:border-blue-500 outline-none transition-colors shadow-inner"
                       />
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         Bio Slug (Personalizado)
                       </label>
                       <div className="flex gap-2">
                         <span className="flex items-center text-[10px] font-black text-slate-400 bg-slate-100 px-3 rounded-xl">@</span>
                         <input 
                            type="text" 
                            value={localPublicSlug}
                            onChange={(e) => setLocalPublicSlug(e.target.value)}
                            placeholder="ex: unidade-centro"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:border-blue-500 outline-none transition-colors shadow-inner"
                         />
                       </div>
                    </div>
                 </div>

                 <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border-2 border-dashed border-blue-200">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                      <LinkIcon className="w-4 h-4" /> Link da Bio (Captação)
                    </label>
                    <div className="flex gap-2">
                       <div className="flex-1 bg-white border-2 border-blue-100 rounded-2xl p-5 font-bold text-slate-400 truncate flex items-center gap-3 text-xs">
                          <Instagram className="w-4 h-4 shrink-0 text-pink-500" />
                          <span>{bioCaptaçãoUrl}</span>
                       </div>
                       <button 
                         onClick={() => {
                           navigator.clipboard.writeText(bioCaptaçãoUrl);
                           alert("Link de Captação copiado!");
                         }}
                         className="bg-slate-900 text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors"
                        >
                          Copiar
                        </button>
                    </div>
                    <p className="mt-4 text-[10px] font-medium text-slate-500 italic">
                      Dica: Coloque este link no Instagram da clínica. Leads que entrarem por aqui serão exibidos na aba de Atribuição.
                    </p>
                 </div>

                 <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-2xl shadow-sm"><Clock className="w-5 h-5 text-blue-600" /></div>
                          <div>
                             <p className="text-sm font-black text-slate-900">SLA Operacional Alvo</p>
                             <p className="text-xs text-slate-400 font-medium">Define o que é considerado "Backlog Crítico".</p>
                          </div>
                       </div>
                       <select 
                          value={slaTargetMinutes} 
                          onChange={(e) => onUpdateClinicSettings({ slaMinutes: Number(e.target.value) })}
                          className="bg-slate-900 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest outline-none border-none cursor-pointer hover:bg-blue-600 transition-colors"
                       >
                          <option value={15}>15 MIN</option>
                          <option value={30}>30 MIN</option>
                          <option value={60}>60 MIN</option>
                          <option value={120}>120 MIN</option>
                       </select>
                    </div>
                 </div>

                 <div className="pt-6">
                    <button 
                      onClick={handleSaveClinicSettings}
                      className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                    >
                       <Save className="w-5 h-5" /> SALVAR ALTERAÇÕES
                    </button>
                 </div>
              </section>
           </div>

           <div className="space-y-8">
              <section className="bg-slate-900 text-white rounded-[3rem] p-10 shadow-sm flex flex-col gap-8 border border-white/5 relative overflow-hidden h-full">
                 <div className="absolute -top-4 -right-4 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
                 <div className="flex items-center gap-2 relative z-10">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Status da Assinatura</h3>
                 </div>
                 
                 <div className="space-y-8 flex-1 relative z-10">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Plano Ativo</span>
                       <span className="text-sm font-black text-blue-400 uppercase tracking-wider">{planConfig.tier}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Vagas (Seats)</span>
                       <span className="text-sm font-black text-white">{billingAccount.seatsUsed} / {billingAccount.seatsTotal} Utilizadas</span>
                    </div>
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Consumo de Leads (Mês)</span>
                          <span className="text-xs font-black text-white">{currentUsage} / {planConfig.baseMonthlyLeadLimit + billingAccount.addOnLeads}</span>
                       </div>
                       <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${currentUsage / (planConfig.baseMonthlyLeadLimit + billingAccount.addOnLeads) > 0.8 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (currentUsage / (planConfig.baseMonthlyLeadLimit + billingAccount.addOnLeads)) * 100)}%` }}></div>
                       </div>
                       <p className="text-[10px] text-white/30 font-medium italic">A cota reseta em {new Date(billingAccount.renewAt).toLocaleDateString('pt-BR')}.</p>
                    </div>
                 </div>

                 <button className="w-full bg-white/10 text-white border border-white/20 font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-white hover:text-slate-900 transition-all text-xs uppercase tracking-widest">
                    <CreditCard className="w-4 h-4" /> UPGRADE OU EXTRAS
                 </button>
              </section>
           </div>
        </div>
      )}

      {showAddDentistModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in duration-300">
            <div className="p-12 space-y-8">
              <div className="flex justify-between items-center">
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">Novo Profissional</h3>
                 <button onClick={() => setShowAddDentistModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3">
                   <div className="relative group">
                     <div className="w-24 h-24 rounded-[2rem] bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                        {newDentist.profileImage ? (
                          <img src={newDentist.profileImage} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                          <UserCheck className="w-10 h-10 text-slate-300" />
                        )}
                     </div>
                     <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg border-4 border-white hover:scale-110 transition-transform"
                     >
                       <Camera className="w-4 h-4" />
                     </button>
                     <input type="file" ref={fileInputRef} onChange={handleModalImageUpload} className="hidden" accept="image/*" />
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto de Perfil</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      Nome do Dentista <span className="text-red-500">*</span>
                    </label>
                    <input 
                      required
                      type="text" value={newDentist.name} onChange={(e) => setNewDentist({...newDentist, name: e.target.value})}
                      placeholder="Ex: Dr. Roberto Silva"
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-colors shadow-inner text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        WhatsApp <span className="text-red-500">*</span>
                      </label>
                      <input 
                        required
                        type="text" value={newDentist.whatsapp} onChange={(e) => setNewDentist({...newDentist, whatsapp: e.target.value})}
                        placeholder="Ex: (11) 90000-0000"
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-colors shadow-inner text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Especialidade</label>
                      <input 
                        type="text" value={newDentist.teamTag} onChange={(e) => setNewDentist({...newDentist, teamTag: e.target.value})}
                        placeholder="Ex: Ortodontia"
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-colors shadow-inner text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Cidade <span className="text-red-500">*</span>
                      </label>
                      <input 
                        required
                        type="text" value={newDentist.city} onChange={(e) => setNewDentist({...newDentist, city: e.target.value})}
                        placeholder="Ex: Belo Horizonte"
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-colors shadow-inner text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        UF <span className="text-red-500">*</span>
                      </label>
                      <input 
                        required
                        type="text" value={newDentist.state} onChange={(e) => setNewDentist({...newDentist, state: e.target.value.toUpperCase().slice(0, 2)})}
                        placeholder="MG"
                        maxLength={2}
                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 text-center outline-none focus:border-blue-500 transition-colors shadow-inner text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleAddDentist}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-blue-600 transition-all text-sm uppercase tracking-widest shadow-xl shadow-slate-200"
                >
                  CONTRATAR ACESSO <Plus className="w-5 h-5 inline-block ml-2" />
                </button>
                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">Plano {planConfig.tier} - Seats disponíveis: {billingAccount.seatsTotal - billingAccount.seatsUsed}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
  >
    {icon} {label}
  </button>
);

const KPICard = ({ label, value, icon, color = "blue" }: any) => {
  const colors: any = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    red: "text-red-600 bg-red-50 border-red-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100"
  };
  return (
    <div className={`bg-white border-2 p-6 rounded-[2rem] shadow-sm flex items-center gap-4 transition-all hover:shadow-md ${colors[color] ? 'border-transparent' : 'border-slate-50'}`}>
      <div className={`p-4 rounded-2xl ${colors[color] || "text-blue-600 bg-blue-50"}`}>{icon}</div>
      <div>
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
         <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  );
};
