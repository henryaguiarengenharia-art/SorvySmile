
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Trophy, 
  Phone, 
  Clock, 
  Zap,
  Eye,
  X,
  FileText,
  User,
  LayoutDashboard,
  Settings,
  Save,
  Instagram,
  Copy,
  Sparkles,
  Target,
  Camera,
  MapPin,
  ChevronRight,
  Activity,
  Lightbulb
} from 'lucide-react';
import { LeadRecord, DentistRecord, LeadStatus, PlanConfig, BillingAccount } from '../types';

const formatPhone = (val: string): string => {
  const d = val.replace(/\D/g, '').slice(0, 11);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
};

interface DentistPortalViewProps {
  leadRecords: LeadRecord[];
  dentistRecords: DentistRecord[];
  currentDentistId: string;
  planConfig: PlanConfig;
  billingAccount: BillingAccount;
  onChangeDentist: (id: string) => void;
  onUpdateLead: (id: string, patch: Partial<LeadRecord>) => void;
  onUpdateDentist: (id: string, patch: Partial<DentistRecord>) => void;
  onSendMessage: (leadId: string, text: string, from: 'dentist' | 'lead') => void;
  dentistPoints: number;
}

type PortalTab = 'dashboard' | 'leads' | 'profile';

export const DentistPortalView: React.FC<DentistPortalViewProps> = ({
  leadRecords,
  dentistRecords,
  currentDentistId,
  planConfig,
  billingAccount,
  onUpdateLead,
  onUpdateDentist,
  dentistPoints
}) => {
  const [currentTab, setCurrentTab] = useState<PortalTab>('dashboard');
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [schedulingLeadId, setSchedulingLeadId] = useState<string | null>(null);
  const [tempScheduleDate, setTempScheduleDate] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDentist = useMemo(() => 
    dentistRecords.find(d => d.id === currentDentistId), 
  [dentistRecords, currentDentistId]);

  const [profileWhatsapp, setProfileWhatsapp] = useState("");
  const [profileBioLink, setProfileBioLink] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profilePublicSlug, setProfilePublicSlug] = useState("");
  const [profileStandardMessage, setProfileStandardMessage] = useState("");
  const [profileTemplates, setProfileTemplates] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (currentDentist) {
      setProfileWhatsapp(formatPhone(currentDentist.whatsapp || ""));
      setProfileBioLink(currentDentist.bioLink || "");
      setProfileCity(currentDentist.city || "");
      setProfileState(currentDentist.state || "");
      setProfilePublicSlug(currentDentist.publicSlug || "");
      setProfileStandardMessage(currentDentist.standardMessage || 'Olá! Vi seu resultado na Sorvy Smile. Vamos agendar uma avaliação?');
      setProfileTemplates(currentDentist.templates || [
        'Olá [NOME], vi seu score de harmonia dental ([SCORE]). Podemos conversar sobre seu clareamento?',
        'Seu resultado da triagem Sorvy Smile está pronto! Quando seria um bom horário para uma breve avaliação presencial?',
        'Notei que seu sorriso está em estado de [STATUS]. Gostaria de priorizar seu atendimento para esta semana.'
      ]);
      setProfileImage(currentDentist.profileImage);
    }
  }, [currentDentistId, currentDentist]);

  const hasGamification = planConfig.features.gamification;

  const handleSaveProfile = () => {
    if (!profileCity.trim() || !profileState.trim()) {
      alert("Cidade e UF de atendimento são obrigatórios.");
      return;
    }
    onUpdateDentist(currentDentistId, {
      whatsapp: profileWhatsapp,
      bioLink: profileBioLink,
      city: profileCity,
      state: profileState,
      publicSlug: profilePublicSlug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      standardMessage: profileStandardMessage,
      templates: profileTemplates,
      profileImage: profileImage
    });
    alert("Perfil salvo com sucesso!");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        alert("A imagem deve ter no máximo 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const bioTriagemUrl = `${window.location.origin}${window.location.pathname}?d=${profilePublicSlug}`;

  const dentistLeads = useMemo(() => 
    leadRecords.filter(r => r.dentistId === currentDentistId), 
  [leadRecords, currentDentistId]);

  const filteredLeads = useMemo(() => {
    return dentistLeads.filter(l => {
      const nameMatch = l.lead.name.toLowerCase().includes(searchTerm.toLowerCase());
      const whatsappMatch = l.lead.whatsapp.includes(searchTerm);
      return (nameMatch || whatsappMatch) && (statusFilter === 'all' || l.status === statusFilter);
    });
  }, [dentistLeads, searchTerm, statusFilter]);

  const sortedLeads = useMemo(() => {
    const now = Date.now();
    const criticalThreshold = 120 * 60 * 1000;
    return [...filteredLeads].sort((a, b) => {
      const aIsCrit = !a.firstContactAt && (now - a.createdAt > criticalThreshold);
      const bIsCrit = !b.firstContactAt && (now - b.createdAt > criticalThreshold);
      if (aIsCrit && !bIsCrit) return -1;
      if (!aIsCrit && bIsCrit) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [filteredLeads]);

  const evolutionMetrics = useMemo(() => {
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * msInDay;
    const fourteenDaysAgo = now - 14 * msInDay;

    const calculateSet = (leads: LeadRecord[]) => {
      const responded = leads.filter(l => l.firstContactAt);
      const avgResponse = responded.length > 0 
        ? Math.round(responded.reduce((acc, l) => acc + (l.firstContactAt! - l.createdAt), 0) / (responded.length * 60000))
        : 0;
      
      const terminal = leads.filter(l => l.status === 'closed' || l.status === 'lost');
      const closed = terminal.filter(l => l.status === 'closed').length;
      const convRate = terminal.length > 0 ? (closed / terminal.length) * 100 : 0;

      const withinSLA = responded.filter(l => (l.firstContactAt! - l.createdAt) <= 120 * 60 * 1000).length;
      const slaCompliance = responded.length > 0 ? (withinSLA / responded.length) * 100 : 0;

      return { avgResponse, convRate, slaCompliance };
    };

    const currentPeriodLeads = dentistLeads.filter(l => l.createdAt >= sevenDaysAgo);
    const previousPeriodLeads = dentistLeads.filter(l => l.createdAt >= fourteenDaysAgo && l.createdAt < sevenDaysAgo);

    const curr = calculateSet(currentPeriodLeads);
    const prev = calculateSet(previousPeriodLeads);

    return {
      curr,
      prev,
      deltas: {
        response: prev.avgResponse > 0 ? ((curr.avgResponse - prev.avgResponse) / prev.avgResponse) * 100 : 0,
        conv: curr.convRate - prev.convRate,
        sla: curr.slaCompliance - prev.slaCompliance
      }
    };
  }, [dentistLeads]);

  const kpis = {
    new: dentistLeads.filter(l => l.status === 'new').length,
    in_chat: dentistLeads.filter(l => l.status === 'in_chat').length,
    scheduled: dentistLeads.filter(l => l.status === 'scheduled').length,
    closed: dentistLeads.filter(l => l.status === 'closed').length,
    lost: dentistLeads.filter(l => l.status === 'lost').length,
  };

  const totalTerminal = kpis.closed + kpis.lost;
  const globalConversionRate = totalTerminal > 0 ? ((kpis.closed / totalTerminal) * 100).toFixed(1) : "0";

  const urgencyLead = useMemo(() => {
    const newLeads = dentistLeads.filter(l => l.status === 'new');
    if (newLeads.length === 0) return null;
    return newLeads.sort((a, b) => a.createdAt - b.createdAt)[0];
  }, [dentistLeads]);

  const nextAppointment = dentistLeads
    .filter(l => l.status === 'scheduled' && l.scheduledAt && l.scheduledAt > Date.now())
    .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0))[0];

  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    dentistLeads.forEach(l => {
      const cat = l.intentCategory || 'Geral';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, percent: Math.round((count / (dentistLeads.length || 1)) * 100) || 0 }));
  }, [dentistLeads]);

  const handleWhatsAppClick = (lead: LeadRecord) => {
    let msg = profileStandardMessage;
    msg = msg.replace('[NOME]', lead.lead.name)
             .replace('[SCORE]', lead.scores?.harmonyIndex?.toString() || '0')
             .replace('[STATUS]', lead.scores?.status || '');
    window.open(`https://wa.me/${lead.lead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    
    if (!lead.firstContactAt) {
      onUpdateLead(lead.id, {
        firstContactAt: Date.now(),
        status: lead.status === 'new' ? 'in_chat' : lead.status,
        dentistPoints: (lead.dentistPoints || 0) + 5
      });
    }
  };

  const handleStatusUpdate = (id: string, newStatus: LeadStatus) => {
    if (newStatus === 'scheduled') {
      setSchedulingLeadId(id);
      return;
    }
    const lead = dentistLeads.find(l => l.id === id);
    const patch: Partial<LeadRecord> = { status: newStatus };
    if (newStatus !== 'new' && lead && !lead.firstContactAt) {
      patch.firstContactAt = Date.now();
    }
    onUpdateLead(id, patch);
  };

  const confirmSchedule = () => {
    if (!schedulingLeadId || !tempScheduleDate) return;
    const scheduledAt = new Date(tempScheduleDate).getTime();
    const lead = dentistLeads.find(l => l.id === schedulingLeadId);
    const patch: Partial<LeadRecord> = { status: 'scheduled', scheduledAt };
    if (lead && !lead.firstContactAt) {
      patch.firstContactAt = Date.now();
    }
    onUpdateLead(schedulingLeadId, patch);
    setSchedulingLeadId(null);
    setTempScheduleDate("");
  };

  const daysLeft = Math.ceil((billingAccount.renewAt - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="px-6 py-12 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-200">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Portal do Dentista</h2>
            {hasGamification && (
              <div className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-200">
                <Trophy className="w-3.5 h-3.5" /> Score: {dentistPoints} pts
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2 shadow-sm">
               {profileImage ? (
                 <img src={profileImage} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-100" alt="Perfil" />
               ) : (
                 <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center"><User className="w-4 h-4 text-blue-600" /></div>
               )}
               <span className="text-sm font-black text-slate-700">{currentDentist?.name || 'Dr(a). Dentista'}</span>
               <span className="text-xs text-slate-400 font-bold ml-1">• {profileCity || '...'}, {profileState || '...'}</span>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 px-6 py-3 rounded-2xl flex items-center gap-3">
           <Zap className="w-5 h-5 text-blue-600" />
           <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Plano {planConfig.tier.toUpperCase()}</p>
              <p className="text-sm font-black text-blue-700">{daysLeft > 0 ? `${daysLeft} dias restantes` : 'Vencido'}</p>
           </div>
        </div>
      </header>

      <nav className="flex gap-2">
        <TabButton active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} />
        <TabButton active={currentTab === 'leads'} onClick={() => setCurrentTab('leads')} label="Leads" icon={<Users className="w-4 h-4" />} />
        <TabButton active={currentTab === 'profile'} onClick={() => setCurrentTab('profile')} label="Perfil" icon={<Settings className="w-4 h-4" />} />
      </nav>

      {currentTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPIMini label="Novos" value={kpis.new} color="blue" onClick={() => {setStatusFilter('new'); setCurrentTab('leads');}} />
            <KPIMini label="Conversa" value={kpis.in_chat} color="indigo" onClick={() => {setStatusFilter('in_chat'); setCurrentTab('leads');}} />
            <KPIMini label="Agendados" value={kpis.scheduled} color="emerald" onClick={() => {setStatusFilter('scheduled'); setCurrentTab('leads');}} />
            <KPIMini label="Fechados" value={kpis.closed} color="purple" onClick={() => {setStatusFilter('closed'); setCurrentTab('leads');}} />
            <KPIMini label="Perdidos" value={kpis.lost} color="red" onClick={() => {setStatusFilter('lost'); setCurrentTab('leads');}} />
            <div className="bg-slate-900 p-4 rounded-[1.5rem] flex flex-col justify-center">
              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Taxa Conversão</p>
              <p className="text-xl font-black text-green-400">{globalConversionRate}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-200 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black mb-4 flex items-center gap-2"><Instagram className="w-5 h-5" /> Post do Dia</h3>
                <p className="text-[11px] font-medium text-blue-5 leading-relaxed mb-6 bg-blue-700/30 p-4 rounded-2xl italic">
                  "Cuidar do seu sorriso ficou mais digital! 🦷✨ Faça agora sua triagem rápida clicando no link oficial da minha bio!"
                </p>
              </div>
              <button 
                onClick={() => { navigator.clipboard.writeText("Cuidar do seu sorriso ficou mais digital! 🦷✨ Faça agora sua triagem rápida clicando no link oficial da minha bio!"); alert("Legenda copiada!"); }}
                className="w-full bg-white text-blue-600 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar Legenda
              </button>
            </div>

            <div className="bg-white border p-8 rounded-[2.5rem] shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><Target className="w-5 h-5 text-blue-600" /> Público Alvo</h3>
              <div className="space-y-4">
                {topCategories.map((cat, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                      <span>{cat.label}</span>
                      <span>{cat.percent}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${cat.percent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-orange-500 fill-orange-500" /> Urgência</h3>
                {urgencyLead ? (
                  <div className="space-y-2">
                    <p className="text-xl font-black text-slate-900 truncate leading-tight">{urgencyLead.lead.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Score: {urgencyLead.scores?.harmonyIndex}%</span>
                      <span className="text-[10px] font-bold text-slate-400">Há {Math.floor((Date.now() - urgencyLead.createdAt)/60000)} min</span>
                    </div>
                  </div>
                ) : <p className="py-4 text-center text-slate-400 font-medium">Sem leads pendentes.</p>}
              </div>
              {urgencyLead && (
                <button onClick={() => handleWhatsAppClick(urgencyLead)} className="w-full mt-4 bg-green-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 transition-colors">
                  <Phone className="w-4 h-4" /> Chamar Whats
                </button>
              )}
            </div>

            <div className="bg-white border p-8 rounded-[2.5rem] shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" /> Agenda</h3>
              {nextAppointment ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-black text-slate-900 mb-1">{nextAppointment.lead.name}</p>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      {new Date(nextAppointment.scheduledAt!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => {setStatusFilter('scheduled'); setCurrentTab('leads');}} className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:text-blue-600">
                    Ver agenda completa <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ) : <p className="py-8 text-center text-slate-400 font-medium">Sem consultas hoje.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem]">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Ganhar Pontos</h3>
              <p className="text-[11px] text-slate-500 font-medium mb-6">Mantenha sua performance alta para subir no ranking da rede.</p>
              <div className="space-y-3">
                {[
                  { act: 'Contato em < 15min', pts: '+10' },
                  { act: 'Lead Agendado', pts: '+15' },
                  { act: 'Tratamento Fechado', pts: '+50' },
                  { act: 'Foto de Perfil Ativa', pts: '+5' }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-slate-50">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{item.act}</span>
                    <span className="text-[10px] font-black text-green-600">{item.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem]">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-600" /> Sua Evolução</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                    <span>Tempo Resposta (Avg)</span>
                    <span className={`font-black ${evolutionMetrics.deltas.response <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {evolutionMetrics.deltas.response <= 0 ? '↓' : '↑'} {Math.abs(Math.round(evolutionMetrics.deltas.response))}% vs 7D ant.
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{evolutionMetrics.curr.avgResponse} min</p>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                    <span>Conversão</span>
                    <span className={`font-black ${evolutionMetrics.deltas.conv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {evolutionMetrics.deltas.conv >= 0 ? '+' : ''} {evolutionMetrics.deltas.conv.toFixed(1)} pp vs 7D ant.
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{evolutionMetrics.curr.convRate.toFixed(1)}%</p>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                    <span>Atendidos &lt;120min</span>
                    <span className="text-blue-600 font-black">Meta: 95%</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{Math.round(evolutionMetrics.curr.slaCompliance)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col justify-center">
              <Sparkles className="absolute -top-4 -right-4 w-24 h-24 text-white/5" />
              <h3 className="text-lg font-black mb-4 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-400" /> Dica de Performance</h3>
              <p className="text-sm font-medium leading-relaxed text-white/70 italic">
                {evolutionMetrics.curr.avgResponse > 15 
                  ? "Leads que recebem contato nos primeiros 15 minutos têm uma taxa de agendamento 4x maior. Tente baixar seu tempo médio!"
                  : "Sua agilidade de resposta é excelente! Continue assim para garantir a maior taxa de conversão da rede."}
              </p>
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Status Operacional</p>
                <div className={`flex items-center gap-2 ${evolutionMetrics.curr.slaCompliance > 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-black">{evolutionMetrics.curr.slaCompliance > 90 ? 'Performance Excelente' : 'Abaixo da Meta'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'leads' && (
        <div className="bg-white border rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="px-8 py-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
            <h3 className="font-black text-lg text-slate-900">Gestão de Leads</h3>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input 
                type="text" placeholder="Nome ou WhatsApp..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 bg-white border rounded-xl pl-4 pr-4 py-2 text-sm font-medium outline-none shadow-sm"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-white border rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none shadow-sm">
                <option value="all">Todos Status</option>
                <option value="new">Novo</option>
                <option value="in_chat">Conversa</option>
                <option value="scheduled">Agendado</option>
                <option value="closed">Fechado</option>
                <option value="lost">Perdido</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <th className="px-8 py-4">Data</th>
                  <th className="px-8 py-4">Paciente</th>
                  <th className="px-8 py-4">Origem</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Tempo</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedLeads.map((record) => {
                  const now = Date.now();
                  const diffMin = Math.floor((record.firstContactAt ? (record.firstContactAt - record.createdAt) : (now - record.createdAt)) / 60000);
                  const isCritical = !record.firstContactAt && diffMin > 120;
                  return (
                    <tr key={record.id} className="text-sm font-medium hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 text-slate-400">{new Date(record.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-8 py-4 font-bold text-slate-900">{record.lead.name}</td>
                      <td className="px-8 py-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${record.source === 'bio' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                          {record.source === 'bio' ? 'Instagram' : 'Direto'}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <select value={record.status} onChange={(e) => handleStatusUpdate(record.id, e.target.value as LeadStatus)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer ${getStatusStyle(record.status)}`}>
                          <option value="new">Novo</option>
                          <option value="in_chat">Conversa</option>
                          <option value="scheduled">Agendado</option>
                          <option value="closed">Fechado</option>
                          <option value="lost">Perdido</option>
                        </select>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`text-[10px] font-black uppercase ${isCritical ? 'text-red-600' : diffMin > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                          {record.firstContactAt ? `${diffMin} min` : `Há ${diffMin} min`}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setSelectedLead(record)} className="p-2 border rounded-xl hover:bg-blue-50 text-blue-600"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleWhatsAppClick(record)} className="p-2 border rounded-xl hover:bg-green-50 text-green-600"><Phone className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'profile' && (
        <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="lg:col-span-2 space-y-8">
              <section className="bg-white border rounded-[3rem] p-10 shadow-sm space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white"><User className="w-6 h-6" /></div>
                    <h3 className="text-2xl font-black text-slate-900">Perfil Profissional</h3>
                 </div>

                 <div className="flex flex-col md:flex-row items-center gap-8 py-6 border-b border-slate-50">
                    <div className="relative group">
                       <div className="w-32 h-32 rounded-[2rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                          {profileImage ? <img src={profileImage} className="w-full h-full object-cover" alt="Avatar" /> : <User className="w-12 h-12 text-slate-300" />}
                       </div>
                       <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-3 rounded-xl shadow-lg border-4 border-white hover:scale-110 transition-transform">
                         <Camera className="w-4 h-4" />
                       </button>
                       <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    </div>
                    <div>
                       <h4 className="text-xl font-black text-slate-900">{currentDentist?.name}</h4>
                       <p className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {profileCity || 'Cidade não informada'}, {profileState || 'UF'}</p>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Direct</label>
                       <input type="text" value={profileWhatsapp} onChange={(e) => setProfileWhatsapp(formatPhone(e.target.value))} placeholder="(11) 99999-9999" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 font-bold text-slate-900 outline-none" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bio Slug (Personalizado)</label>
                       <div className="flex gap-2">
                         <span className="flex items-center text-[10px] font-black text-slate-400 bg-slate-100 px-3 rounded-xl">@</span>
                         <input type="text" value={profilePublicSlug} onChange={(e) => setProfilePublicSlug(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 font-bold text-slate-900 outline-none" />
                       </div>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         Cidade de Atendimento <span className="text-red-500">*</span>
                       </label>
                       <input required type="text" value={profileCity} onChange={(e) => setProfileCity(e.target.value)} placeholder="Ex: Belo Horizonte" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 font-bold text-slate-900 outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         UF <span className="text-red-500">*</span>
                       </label>
                       <input required type="text" value={profileState} onChange={(e) => setProfileState(e.target.value.toUpperCase().slice(0, 2))} placeholder="MG" maxLength={2} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 font-bold text-slate-900 text-center outline-none focus:border-blue-500" />
                    </div>
                 </div>

                 <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Link da Bio (Triagem Oficial)</label>
                    <div className="flex gap-2">
                       <div className="flex-1 bg-white border-2 border-slate-100 rounded-xl p-4 font-bold text-slate-400 truncate text-xs flex items-center gap-2">
                          <Instagram className="w-3.5 h-3.5" />
                          <span>{bioTriagemUrl}</span>
                       </div>
                       <button 
                         onClick={() => {
                           navigator.clipboard.writeText(bioTriagemUrl);
                           alert("Link da Bio copiado!");
                         }}
                         className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors"
                        >
                          Copiar
                        </button>
                    </div>
                 </div>

                 <div className="pt-6">
                    <button onClick={handleSaveProfile} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-blue-600 transition-colors">
                       <Save className="w-5 h-5" /> SALVAR PERFIL
                    </button>
                 </div>
              </section>
           </div>
        </div>
      )}

      {schedulingLeadId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm p-8">
            <h3 className="text-2xl font-black text-slate-900 mb-6">Agendar Consulta</h3>
            <input type="datetime-local" value={tempScheduleDate} onChange={(e) => setTempScheduleDate(e.target.value)} className="w-full bg-slate-50 border-2 rounded-xl p-4 font-bold mb-6" />
            <div className="flex gap-2">
              <button onClick={() => setSchedulingLeadId(null)} className="flex-1 py-4 font-black text-xs uppercase text-slate-400">Voltar</button>
              <button onClick={confirmSchedule} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black text-xs uppercase">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-10 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setSelectedLead(null)} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-2xl"><X className="w-6 h-6 text-slate-400" /></button>
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-blue-600 p-3 rounded-2xl"><FileText className="w-8 h-8 text-white" /></div>
              <div>
                <h3 className="text-3xl font-black text-slate-900">Resumo da Triagem</h3>
                <p className="text-slate-500 font-medium">{selectedLead.lead.name}</p>
              </div>
            </div>
            {selectedLead.scores && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Harmonia</p><p className="text-3xl font-black text-blue-600">{selectedLead.scores.harmonyIndex}%</p></div>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Brilho Estimado</p><p className="text-3xl font-black text-yellow-500">{selectedLead.scores.brightnessIndex}%</p></div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
                  <p className="text-lg font-bold leading-relaxed mb-6 italic text-blue-400">"{selectedLead.scores.recommendation}"</p>
                  <ul className="space-y-3">
                    {selectedLead.scores.observations.map((obs, i) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />{obs}</li>
                    ))}
                  </ul>
                  <p className="mt-8 text-[9px] text-white/40 font-bold uppercase tracking-widest">A foto do paciente foi permanentemente descartada por segurança.</p>
                </div>
                <button onClick={() => handleWhatsAppClick(selectedLead)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl">
                  <Phone className="w-5 h-5" /> ENTRAR EM CONTATO NO WHATSAPP
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${active ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border text-slate-400 hover:text-slate-600'}`}>
    {icon} {label}
  </button>
);

const KPIMini = ({ label, value, color, onClick }: any) => {
  const colors: any = { blue: 'text-blue-600', indigo: 'text-indigo-600', emerald: 'text-emerald-600', purple: 'text-purple-600', red: 'text-red-600' };
  return (
    <button onClick={onClick} className="text-left p-4 rounded-3xl bg-white border hover:border-blue-200 transition-all shadow-sm">
      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
      <p className={`text-2xl font-black ${colors[color] || 'text-slate-900'}`}>{value}</p>
    </button>
  );
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-600';
    case 'in_chat': return 'bg-indigo-100 text-indigo-600';
    case 'scheduled': return 'bg-emerald-100 text-emerald-600';
    case 'closed': return 'bg-purple-100 text-purple-600';
    case 'lost': return 'bg-red-100 text-red-600';
    default: return 'bg-slate-100 text-slate-600';
  }
};
