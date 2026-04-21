
import React, { useState, useEffect } from 'react';
import { 
  Smile, 
  Camera, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  ExternalLink,
  XCircle,
  AlertCircle,
  Settings,
  Wallet,
  RotateCcw,
  Check,
  ClipboardList,
  X,
  Clock,
  User,
  MapPin,
  Phone,
  ChevronLeft
} from 'lucide-react';
import { 
  AppView, 
  SmileScores, 
  UserLead, 
  PhotoValidation, 
  LeadRecord, 
  DentistRecord, 
  PlanTier, 
  PlanConfig, 
  BillingAccount,
  ClinicSettings
} from './types';
import { analyzeSmile, validatePhotoQuality } from './services/geminiService';
import { StrategyOnePager } from './components/StrategyOnePager';
import { AdminDashboardView } from './components/AdminDashboardView';
import { DentistPortalView } from './components/DentistPortalView';
import { HQDashboardView } from './components/HQDashboardView';

const STORAGE_KEY = 'SORVY_SMILE_PILOT_DATA_V1.7';
const CONSENT_VERSION = 'Fevereiro/2026';


const formatWhatsApp = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  lite: {
    tier: 'lite',
    price: 149,
    baseMonthlyLeadLimit: 10,
    includedSeats: 1,
    extraSeatPrice: 0,
    features: {
      aiBasic: true, aiFull: false, whatsappTemplates: false,
      funnelSimple: true, funnelFull: false, slaAlerts: false,
      scheduling: false, leadHistoryWithPhoto: false, gamification: false,
      adminDashboard: false, leadAssignment: false, teamManagement: false,
      bioLink: true
    }
  },
  pro: {
    tier: 'pro',
    price: 297,
    baseMonthlyLeadLimit: 9999,
    includedSeats: 1,
    extraSeatPrice: 0,
    features: {
      aiBasic: true, aiFull: true, whatsappTemplates: true,
      funnelSimple: false, funnelFull: true, slaAlerts: true,
      scheduling: true, leadHistoryWithPhoto: true, gamification: true,
      adminDashboard: false, leadAssignment: false, teamManagement: false,
      bioLink: true
    }
  },
  network: {
    tier: 'network',
    price: 497,
    baseMonthlyLeadLimit: 9999,
    includedSeats: 2,
    extraSeatPrice: 79,
    features: {
      aiBasic: true, aiFull: true, whatsappTemplates: true,
      funnelSimple: false, funnelFull: true, slaAlerts: true,
      scheduling: true, leadHistoryWithPhoto: true, gamification: true,
      adminDashboard: true, leadAssignment: true, teamManagement: true,
      bioLink: true
    }
  }
};

const ADMIN_WHATSAPP = '5531994284436';
const PAYMENT_LINKS: Record<PlanTier, string> = {
  lite:    'https://invoice.infinitepay.io/plans/henry-augusto-pinheiro/7f6uzHxoqT',
  pro:     'https://invoice.infinitepay.io/plans/henry-augusto-pinheiro/dakCr5umz',
  network: 'https://invoice.infinitepay.io/plans/henry-augusto-pinheiro/7f70xygLaj',
};

const ADMIN_EMAIL = 'admin@sorvy.com.br';
const ADMIN_PASSWORD = 'sorvy@hq2026';
const DENTIST_PILOT_PASSWORD = 'sorvy123';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('landing');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scores, setScores] = useState<SmileScores | null>(null);
  const [validation, setValidation] = useState<PhotoValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [leadRecords, setLeadRecords] = useState<LeadRecord[]>([]);
  const [actualDentistRecords, setActualDentistRecords] = useState<DentistRecord[]>([]);
  const [billingAccounts, setBillingAccounts] = useState<Record<string, BillingAccount>>({});
  const [usageByAccount, setUsageByAccount] = useState<Record<string, Record<string, number>>>({});
  const [clinicSettings, setClinicSettings] = useState<Record<string, ClinicSettings>>({});
  const [currentDentistId, setCurrentDentistId] = useState<string | null>(null);

  // Referral Context
  const [referralContext, setReferralContext] = useState<{
    ownerType: 'dentist' | 'clinic';
    ownerId: string;
  } | null>(null);
  
  // Checkout States
  const [selectedPlanId, setSelectedPlanId] = useState<PlanTier | null>(null);
  const [checkoutData, setCheckoutData] = useState({
    name: '',
    whatsapp: '',
    email: '',
    specialty: '',
    accountType: 'dentist' as 'dentist' | 'clinic'
  });

  const [lead, setLead] = useState<UserLead>({ 
    name: '', 
    whatsapp: '', 
    email: '', 
    location: '' 
  });
  const [isLeadCaptured, setIsLeadCaptured] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'searching' | 'matched' | 'idle'>('idle');

  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.leadRecords) setLeadRecords(parsed.leadRecords);
        if (parsed.dentistRecords) setActualDentistRecords(parsed.dentistRecords);
        if (parsed.billingAccounts) setBillingAccounts(parsed.billingAccounts);
        if (parsed.usageByAccount) setUsageByAccount(parsed.usageByAccount);
        if (parsed.clinicSettings) setClinicSettings(parsed.clinicSettings);
        if (parsed.currentDentistId) setCurrentDentistId(parsed.currentDentistId);
      } catch (_e) {
        generateVolumeSeed();
      }
    } else {
      generateVolumeSeed();
    }
  }, []);

  useEffect(() => {
    if (Object.keys(billingAccounts).length === 0) return;
    
    const params = new URLSearchParams(window.location.search);
    const clinicSlug = params.get('c');
    const dentistSlug = params.get('d');
    
    if (clinicSlug) {
      const clinicAcc = (Object.values(billingAccounts) as BillingAccount[]).find(a => a.ownerType === 'clinic' && clinicSettings[a.id]?.publicSlug === clinicSlug);
      if (clinicAcc && referralContext?.ownerId !== clinicAcc.id) {
        setReferralContext({ ownerType: 'clinic', ownerId: clinicAcc.id });
      }
    } else if (dentistSlug) {
      const dentist = actualDentistRecords.find(d => d.publicSlug === dentistSlug);
      if (dentist && referralContext?.ownerId !== dentist.id) {
        setReferralContext({ ownerType: 'dentist', ownerId: dentist.id });
      }
    }
  }, [billingAccounts, clinicSettings, actualDentistRecords, referralContext?.ownerId]);

  useEffect(() => {
    if (Object.keys(billingAccounts).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        leadRecords, dentistRecords: actualDentistRecords, billingAccounts, usageByAccount, clinicSettings, currentDentistId
      }));
    }
  }, [leadRecords, actualDentistRecords, billingAccounts, usageByAccount, clinicSettings, currentDentistId]);

  useEffect(() => {
    if (view === 'validation' && !capturedImage) setView('capture');
    if (view === 'results' && !scores) setView('landing');
  }, [view, capturedImage, scores]);

  const generateVolumeSeed = () => {
    const accounts: Record<string, BillingAccount> = {};
    const dentists: DentistRecord[] = [];
    const settings: Record<string, ClinicSettings> = {};
    const now = Date.now();
    const DAY = 24 * 3600 * 1000;

    const planTiers: PlanTier[] = ['lite', 'pro', 'pro', 'network', 'pro'];
    for (let i = 1; i <= 5; i++) {
      const id = `acc_${i}`;
      const tier = planTiers[i - 1];
      accounts[id] = {
        id, ownerType: 'clinic', ownerId: `o_${i}`, tier, addOnLeads: 0,
        seatsTotal: 5, seatsUsed: 1, isActive: true, startAt: now, renewAt: now + 30 * DAY,
        status: 'active', riskLevel: 'ok', accountName: `Clínica Sorvy ${i}`
      };
      settings[id] = { slaMinutes: 120, clinicName: `Sorvy Clinic ${i}`, receptionistWhatsapp: '5511999999999', publicSlug: `clinic-${i}` };
      dentists.push({
        id: `d_${i}`,
        name: tier === 'network' ? `Clínica Sorriso ${i}` : `Dr. Roberto ${i}`,
        email: tier === 'network' ? `clinica${i}@sorvy.com.br` : `dentista${i}@sorvy.com.br`,
        whatsapp: '5511999999999',
        plan: tier,
        role: tier === 'network' ? 'clinic' : 'dentist',
        billingAccountId: id,
        isActive: true,
        createdAt: now,
        city: 'São Paulo',
        state: 'SP',
        publicSlug: tier === 'network' ? `clinica-sorriso-${i}` : `dr-roberto-${i}`
      });
    }

    const seedNames = ['Maria Silva', 'João Santos', 'Ana Costa', 'Carlos Lima', 'Fernanda Rocha', 'Pedro Alves', 'Juliana Melo', 'Rafael Souza', 'Camila Dias', 'Marcelo Neto'];
    const seedStatuses: Array<'new' | 'in_chat' | 'scheduled' | 'closed' | 'lost'> = ['new', 'in_chat', 'scheduled', 'closed', 'new', 'new', 'in_chat', 'scheduled', 'lost', 'new'];
    const seedVita = ['A1', 'A2', 'B1', 'A3', 'B2'];
    const seedIntent = ['Clareamento', 'Ortodontia', 'Lentes/Facetas', 'Preventivo', 'Implantes'];
    const seedSpecialty = ['Estética', 'Ortodontia', 'Estética', 'Clínico Geral', 'Implantodontia'];

    const seedLeads: LeadRecord[] = seedNames.map((name, i) => {
      const dentist = dentists[i % 5];
      const status = seedStatuses[i];
      const hadContact = status !== 'new';
      const isScheduled = status === 'scheduled' || status === 'closed';
      return {
        id: `lead_seed_${i + 1}`,
        createdAt: now - ((i + 1) * 2 * DAY),
        lead: { name, whatsapp: `5511${9 * 100000000 + i * 1111111}`, email: `${name.toLowerCase().replace(' ', '.')}@email.com`, location: 'São Paulo, SP' },
        scores: {
          harmonyIndex: 55 + i * 4,
          brightnessIndex: 60 + i * 3,
          vitaShade: seedVita[i % 5],
          status: i < 3 ? 'Prioridade' : i < 7 ? 'Atenção' : 'Bom',
          benchmarkText: 'Score compatível com a média para a faixa etária.',
          technicalInsights: { symmetry: 63 + i * 3, alignment: 58 + i * 4, reflectivity: 68 + i * 2 },
          observations: ['Oportunidade de harmonização estética', 'Simetria pode ser otimizada', 'Croma dentro do esperado'],
          recommendation: 'Avaliação para clareamento e análise de oclusão indicada.',
          intentCategory: seedIntent[i % 5],
          ticketLikely: i < 3 ? 'Alto' : i < 7 ? 'Médio' : 'Baixo',
          recommendedSpecialty: seedSpecialty[i % 5]
        },
        photoAdequate: true,
        matchStatus: 'matched',
        status,
        dentistId: dentist.id,
        ownerType: 'clinic',
        ownerId: dentist.billingAccountId,
        consentTimestamp: now - ((i + 1) * 2 * DAY),
        consentVersion: CONSENT_VERSION,
        consentPatient: true,
        source: 'direct',
        firstContactAt: hadContact ? now - (i * 3600 * 1000) : undefined,
        scheduledAt: isScheduled ? now + (i * DAY) : undefined,
      };
    });

    setBillingAccounts(accounts);
    setActualDentistRecords(dentists);
    setClinicSettings(settings);
    setLeadRecords(seedLeads);
    if (dentists.length > 0) setCurrentDentistId(dentists[0].id);
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        setCapturedImage(result);
        setView('validation');
        setIsValidating(true);
        try {
          const val = await validatePhotoQuality(result.split(',')[1]);
          setValidation(val);
        } catch (err: any) {
          setErrorMessage(err.message);
        } finally {
          setIsValidating(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setCapturedImage(null);
    setValidation(null);
  };

  const startAnalysis = async () => {
    if (!capturedImage) return;
    const base64 = capturedImage.split(',')[1];
    setView('analyzing');
    try {
      const result = await analyzeSmile(base64);
      setScores(result);
      clearImage(); // CRITICAL: Photo is discarded here
      setView('results');
    } catch (err: any) {
      setErrorMessage(err.message);
      setView('validation');
    }
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLeadWpp = lead.whatsapp.replace(/\D/g, '');
    if (!lead.name || cleanLeadWpp.length < 10) return;

    const newId = `lead_${Date.now()}`;
    const newRecord: LeadRecord = {
      id: newId,
      createdAt: Date.now(),
      lead: { ...lead },
      scores: scores,
      photoAdequate: true,
      matchStatus: 'searching',
      status: 'new',
      dentistId: referralContext?.ownerType === 'dentist' ? referralContext.ownerId : (currentDentistId || null),
      ownerType: referralContext?.ownerType || 'clinic',
      ownerId: referralContext?.ownerId || Object.keys(billingAccounts)[0],
      consentTimestamp: Date.now(),
      consentVersion: CONSENT_VERSION,
      consentPatient: true,
      source: referralContext ? 'bio' : 'direct'
    };

    setLeadRecords(prev => [...prev, newRecord]);
    setIsLeadCaptured(true);
    setMatchStatus('searching');

    setTimeout(() => {
      setMatchStatus('matched');
    }, 1500);
  };

  const openWhatsApp = (number: string, message: string) => {
    window.open(`https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Passo 1 do checkout: valida + cria conta pendente + avança para pagamento
  const handleCheckoutSubmit = () => {
    if (!checkoutData.name || !checkoutData.whatsapp || !checkoutData.email) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    const cleanWpp = checkoutData.whatsapp.replace(/\D/g, '');
    if (cleanWpp.length < 10 || cleanWpp.length > 15) {
      alert("WhatsApp inválido. Use formato com DDD (ex: 11999999999).");
      return;
    }
    if (!selectedPlanId) return;

    const ts = Date.now();
    const newAccId = `acc_pending_${ts}`;
    const generatedSlug = checkoutData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const newAcc: BillingAccount = {
      id: newAccId,
      ownerType: checkoutData.accountType,
      ownerId: `o_pending_${ts}`,
      tier: selectedPlanId,
      addOnLeads: 0,
      seatsTotal: PLAN_CONFIGS[selectedPlanId].includedSeats,
      seatsUsed: 1,
      isActive: false,
      status: 'pending',
      startAt: ts,
      renewAt: ts + 30 * 24 * 3600 * 1000,
      accountName: checkoutData.name,
      requestedPlan: selectedPlanId,
      requestedAccountType: checkoutData.accountType,
      checkoutName: checkoutData.name,
      checkoutEmail: checkoutData.email,
      checkoutWhatsapp: checkoutData.whatsapp
    };

    const newDentist: DentistRecord = {
      id: `d_pending_${ts}`,
      name: checkoutData.name,
      whatsapp: checkoutData.whatsapp.replace(/\D/g, ''),
      email: checkoutData.email,
      specialty: checkoutData.specialty,
      plan: selectedPlanId,
      role: selectedPlanId === 'network' ? 'clinic' : 'dentist',
      billingAccountId: newAccId,
      isActive: false,
      createdAt: ts,
      publicSlug: generatedSlug
    };

    setBillingAccounts(prev => ({ ...prev, [newAccId]: newAcc }));
    setActualDentistRecords(prev => [...prev, newDentist]);
    setView('checkout-confirm');
  };

  // Passo 2 do checkout: envia comprovante via WhatsApp + finaliza
  const handleSendComprovante = () => {
    if (!selectedPlanId) return;
    const planName = selectedPlanId.toUpperCase();
    const waMsg = `Olá! Acabei de assinar o plano ${planName} da Sorvy Smile.\n\nNome: ${checkoutData.name}\nEmail: ${checkoutData.email}\nWhatsApp: ${checkoutData.whatsapp}\n\nSegue meu comprovante de pagamento.`;
    openWhatsApp(ADMIN_WHATSAPP, waMsg);
    setView('checkout-done');
  };

  const handleFinalCTA = () => {
    if (!lead.whatsapp || !scores) return;

    if (referralContext) {
      let targetWhatsapp = '5511999999999';
      if (referralContext.ownerType === 'dentist') {
        const dentist = actualDentistRecords.find(d => d.id === referralContext.ownerId);
        if (dentist) targetWhatsapp = dentist.whatsapp;
      } else {
        const settings = clinicSettings[referralContext.ownerId];
        if (settings?.receptionistWhatsapp) targetWhatsapp = settings.receptionistWhatsapp;
      }
      const msg = `Olá! Finalizei minha triagem na Sorvy Smile.\nNome: ${lead.name}\nScore de Harmonia: ${scores.harmonyIndex}%\nRecomendação: ${scores.recommendation}`;
      openWhatsApp(targetWhatsapp, msg);
      return;
    }

    // No referral context — show the network list so the patient can pick a clinic/dentist
    setView('network-list');
  };

  const handleNetworkContact = (dentistId: string) => {
    if (!scores) return;
    const dentist = actualDentistRecords.find(d => d.id === dentistId);
    if (!dentist) return;
    const msg = `Olá ${dentist.name.split(' ')[0]}! Finalizei minha triagem na Sorvy Smile.\nNome: ${lead.name}\nScore de Harmonia: ${scores.harmonyIndex}%\nRecomendação: ${scores.recommendation}\n\nGostaria de agendar uma avaliação.`;
    openWhatsApp(dentist.whatsapp, msg);
  };

  const handleLogin = (email: string, password: string) => {
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setView('hq-dashboard');
      return 'success';
    }
    const dentist = actualDentistRecords.find(d => d.email?.toLowerCase() === email.trim().toLowerCase());
    if (!dentist) return 'wrong_credentials';
    if (!dentist.isActive) {
      const acc = billingAccounts[dentist.billingAccountId];
      return acc?.status === 'pending' ? 'pending' : 'inactive';
    }
    if (password !== DENTIST_PILOT_PASSWORD) return 'wrong_credentials';
    setCurrentDentistId(dentist.id);
    setView(dentist.role === 'clinic' ? 'admin-dashboard' : 'dentist-portal');
    return 'success';
  };

  const handleLogout = () => {
    setCurrentDentistId(null);
    setView('landing');
  };

  // Hide the public top nav on full-screen login, B2B dashboards, and during the active triagem flow
  const fullScreenViews: AppView[] = ['login', 'hq-dashboard', 'admin-dashboard', 'dentist-portal'];
  const triagemFlowViews: AppView[] = ['consent', 'capture', 'validation', 'analyzing', 'results', 'dispatch'];
  const showPublicNav = !fullScreenViews.includes(view) && !triagemFlowViews.includes(view);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-40">
      {showPublicNav && (
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Smile className="w-6 h-6" /></div>
            <span className="font-bold text-xl tracking-tight uppercase">Sorvy Smile</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setView('landing')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${view === 'landing' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Como funciona
            </button>
            <button
              onClick={() => setView('pricing')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${view === 'pricing' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Planos
            </button>
            <span className="hidden sm:inline-block w-px h-5 bg-slate-200 mx-1" />
            <button
              onClick={() => setView('login')}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black text-slate-900 hover:text-blue-600 transition-colors"
            >
              Acesso Pro
            </button>
            <button
              onClick={() => setView('login')}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:text-blue-600 transition-colors"
            >
              Admin
            </button>
          </div>
        </nav>
      )}

      <main className={fullScreenViews.includes(view) ? '' : 'max-w-screen-xl mx-auto'}>
        {view === 'login' && (
          <LoginView
            onLogin={handleLogin}
            onContinueAsPatient={() => setView('landing')}
          />
        )}
        {view === 'landing' && <LandingView onStart={() => setView('consent')} />}
        {view === 'consent' && <ConsentView onAccept={() => setView('capture')} onBack={() => setView('landing')} />}
        {view === 'capture' && <CaptureView onUpload={handleFileUpload} onBack={() => setView('consent')} />}
        {view === 'validation' && capturedImage && (
          <ValidationView 
            image={capturedImage} validation={validation} isLoading={isValidating} 
            onRetry={() => setView('capture')} onConfirm={startAnalysis}
          />
        )}
        {view === 'analyzing' && <AnalyzingView />}
        {view === 'results' && scores && (
          <ResultsView scores={scores} onNext={() => setView('dispatch')} />
        )}
        {view === 'dispatch' && (
          <DispatchView 
            lead={lead} setLead={setLead} isCaptured={isLeadCaptured} 
            scores={scores} status={matchStatus} onSubmit={handleLeadSubmit} 
            onFinalCTA={handleFinalCTA}
            hasReferral={!!referralContext}
          />
        )}
        {view === 'network-list' && scores && (
          <NetworkListView
            dentists={actualDentistRecords.filter(d => d.isActive)}
            billingAccounts={billingAccounts}
            scores={scores}
            patientName={lead.name}
            onContact={handleNetworkContact}
            onBack={() => setView('dispatch')}
          />
        )}

        {/* Checkout Flow */}
        {view === 'checkout-pix' && selectedPlanId && (
          <CheckoutPixView 
            plan={PLAN_CONFIGS[selectedPlanId]} 
            data={checkoutData} 
            setData={setCheckoutData} 
            onSubmit={handleCheckoutSubmit} 
          />
        )}
        {view === 'checkout-confirm' && selectedPlanId && (
          <CheckoutConfirmView 
            plan={PLAN_CONFIGS[selectedPlanId]}
            planMeta={PLAN_META[selectedPlanId]}
            paymentLink={PAYMENT_LINKS[selectedPlanId]}
            data={checkoutData} 
            onSendComprovante={handleSendComprovante}
            onBack={() => setView('checkout-pix')}
          />
        )}
        {view === 'checkout-done' && (
          <CheckoutDoneView data={checkoutData} onBackToLogin={() => setView('landing')} />
        )}

        {/* B2B Views */}
        {view === 'hq-dashboard' && (
          <HQDashboardView 
            leadRecords={leadRecords} 
            dentistRecords={actualDentistRecords} 
            billingAccounts={billingAccounts} 
            usageByAccount={usageByAccount} 
            planConfigs={PLAN_CONFIGS} 
            onUpdateDentist={(id, patch) => setActualDentistRecords(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))} 
            onUpdateLead={(id, patch) => setLeadRecords(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))} 
            onUpdateBilling={(id, patch) => setBillingAccounts(prev => ({ ...prev, [id]: { ...prev[id], ...patch }}))} 
            onOpenWhatsApp={openWhatsApp} 
            onResolveBacklog={()=>{}} 
            onPrioritizeCriticalIA={()=>{}} 
            onReassignInactivePortfolio={()=>{}} 
          />
        )}
        {view === 'admin-dashboard' && currentDentistId && (
          (() => {
            const dentist = actualDentistRecords.find(d => d.id === currentDentistId);
            if (!dentist) return null;
            const account = billingAccounts[dentist.billingAccountId];
            if (!account) return null;
            return (
              <AdminDashboardView 
                leadRecords={leadRecords} 
                dentistRecords={actualDentistRecords} 
                billingAccount={account} 
                planConfig={PLAN_CONFIGS[account.tier]} 
                currentUsage={leadRecords.filter(l => l.ownerId === account.id).length} 
                clinicSettings={clinicSettings[account.id] || { slaMinutes: 120 }} 
                onUpdateDentist={(id, patch) => setActualDentistRecords(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))} 
                onAddDentist={(newD) => setActualDentistRecords(prev => [...prev, newD])}
                onUpdateLead={(id, patch) => setLeadRecords(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))} 
                onUpdateBilling={(id, patch) => setBillingAccounts(prev => ({ ...prev, [id]: { ...prev[id], ...patch }}))} 
                onUpdateClinicSettings={(patch) => setClinicSettings(prev => ({ ...prev, [account.id]: { ...prev[account.id], ...patch }}))} 
                onOpenWhatsApp={openWhatsApp} 
              />
            );
          })()
        )}
        {view === 'dentist-portal' && currentDentistId && (
          (() => {
            const portalDentist = actualDentistRecords.find(d => d.id === currentDentistId);
            const portalAccount = portalDentist
              ? (billingAccounts[portalDentist.billingAccountId] || Object.values(billingAccounts)[0])
              : Object.values(billingAccounts)[0];
            if (!portalAccount) return null;
            return (
              <DentistPortalView 
                leadRecords={leadRecords} 
                dentistRecords={actualDentistRecords} 
                currentDentistId={currentDentistId} 
                planConfig={PLAN_CONFIGS[portalDentist?.plan || 'pro']}
                billingAccount={portalAccount}
                onUpdateLead={(id, patch) => setLeadRecords(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))} 
                onUpdateDentist={(id, patch) => setActualDentistRecords(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))} 
                onSendMessage={()=>{}} 
                dentistPoints={0} 
                onChangeDentist={setCurrentDentistId}
              />
            );
          })()
        )}
        {view === 'pricing' && (
          <PricingView 
            configs={PLAN_CONFIGS} 
            onSelect={(tier: PlanTier) => {
              setSelectedPlanId(tier);
              setCheckoutData(prev => ({ ...prev, accountType: tier === 'network' ? 'clinic' : 'dentist' }));
              setView('checkout-pix');
            }} 
          />
        )}
        {view === 'strategy' && <StrategyOnePager />}
        {(view === 'clinic-portal' || view === 'partner-clinics') && (
          <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-6">
            <div className="text-6xl mb-4">🔧</div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Em Breve</h2>
            <p className="text-slate-500 font-bold text-lg">Esta funcionalidade está sendo preparada para o próximo ciclo de lançamento.</p>
            <button onClick={() => setView('landing')} className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-sm hover:bg-blue-600 transition-colors">← Voltar ao Início</button>
          </div>
        )}
      </main>

      {/* DEV MODE NAVIGATION BAR — hidden for launch. Toggle SHOW_DEV_BAR to re-enable. */}
      {false && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#1E293B] backdrop-blur-xl border border-white/10 p-2 rounded-[2rem] shadow-2xl flex items-center gap-1 max-w-[95vw] overflow-x-auto no-scrollbar">
        <div className="px-5 py-2 text-white/40 font-black text-[9px] uppercase tracking-widest border-r border-white/10 mr-2 flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" /> DEV MODE
        </div>
        {[
          { id: 'landing', label: 'INÍCIO' },
          { id: 'pricing', label: 'PLANOS' },
          { id: 'dentist-portal', label: 'DENTISTA' },
          { id: 'admin-dashboard', label: 'ADMIN (CLÍNICA)' },
          { id: 'hq-dashboard', label: 'HQ (DONO)' },
          { id: 'strategy', label: 'GROWTH' },
        ].map((item) => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id as AppView)}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center justify-center ${view === item.id ? 'bg-[#2563EB] text-white shadow-lg' : 'text-white/60 hover:bg-white/5'}`}
          >
            {item.label}
          </button>
        ))}
        <button 
          onClick={resetDemoData}
          className="ml-4 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#EF4444] hover:bg-red-500/10 transition-all whitespace-nowrap flex items-center gap-2 border border-red-500/20"
        >
          <RotateCcw className="w-3.5 h-3.5" /> RESET DEMO DATA
        </button>
        <button
          onClick={handleLogout}
          className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-400/10 transition-all whitespace-nowrap flex items-center gap-2 border border-amber-400/20"
        >
          ⏻ SAIR
        </button>
      </div>}

      {errorMessage && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-2xl font-bold z-[200] shadow-xl flex items-center gap-4">
          <AlertCircle className="w-5 h-5" /> {errorMessage}
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded-lg"><XCircle className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const SubscriberTermsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
        <div className="p-8 border-b flex justify-between items-center">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Termos do Assinante — Sorvy Smile (v1.0)</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
        </div>
        <div className="p-8 overflow-y-auto space-y-8 text-sm font-medium text-slate-600 leading-relaxed scrollbar-thin">
          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">1. Objeto do Serviço</h4>
            <p>A Sorvy Smile fornece uma plataforma de triagem visual automatizada (IA) e gestão de leads para profissionais e clínicas odontológicas. O serviço é uma ferramenta de triagem estética informativa, não constituindo diagnóstico médico, não substituindo a consulta presencial e não sendo indicado para casos de urgência.</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">2. Responsabilidade do Assinante</h4>
            <p>O Assinante (dentista ou clínica) é o único responsável pelo atendimento clínico, diagnósticos e tratamentos propostos aos pacientes encaminhados. A Sorvy Smile não intervém na relação médico-paciente nem se responsabiliza por condutas técnicas ou profissionais.</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">3. Proteção de Dados e LGPD</h4>
            <p>O Assinante declara estar em conformidade com a LGPD. A Sorvy Smile atua como operadora dos dados para fins de triagem. A imagem do paciente é processada exclusivamente para gerar o score e insights, sendo descartada imediatamente após o processamento. Somente o resumo textual e dados de contato são compartilhados com o Assinante. O Assinante é responsável pela guarda e tratamento dos dados recebidos após o encaminhamento inicial.</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">4. Comunicação via WhatsApp</h4>
            <p>O Assinante é responsável pelo uso ético do WhatsApp para contato com os leads. O envio de mensagens deve respeitar as normas do Conselho Federal de Odontologia (CFO) e as políticas da plataforma WhatsApp Business.</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">5. Assinaturas e Cotas</h4>
            <p>Os planos possuem limites mensais de leads (cotas). A renovação é mensal e automática conforme o plano escolhido. Em caso de inadimplência, o acesso aos serviços de triagem e ao painel de gestão será suspenso imediatamente até a regularização.</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">6. Segurança de Acesso</h4>
            <p>As credenciais de acesso são de uso pessoal e intransferível. O Assinante compromete-se a manter a segurança de sua conta e a notificar a Sorvy imediatamente em caso de uso não autorizado.</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">7. Limitação de Responsabilidade</h4>
            <p>A Sorvy Smile não garante conversão de leads em tratamentos fechados. O serviço é fornecido "como está", podendo sofrer instabilidades técnicas inerentes a sistemas de nuvem e inteligência artificial.</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">8. Suporte</h4>
            <p>O suporte técnico é realizado via canais digitais oficiais (WhatsApp/Email) em horário comercial, sem garantia de SLA contratual nesta fase de lançamento (MVP).</p>
          </section>

          <section className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">9. Atualização dos Termos</h4>
            <p>Estes termos podem ser atualizados periodicamente para refletir melhorias no serviço ou mudanças regulatórias. O uso continuado da plataforma após a atualização implica aceite tácito da nova versão.</p>
          </section>

          <section className="space-y-3 border-t pt-4">
            <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">10. Contato Oficial</h4>
            <p>Para solicitações relacionadas à privacidade de dados ou suporte, entre em contato pelo email: <strong>contato@sorvy.com.br</strong></p>
          </section>

          <p className="text-[10px] font-black text-slate-400 uppercase text-right pt-4">Última atualização: Fevereiro de 2026</p>
        </div>
        <div className="p-8 bg-slate-50 border-t flex justify-end">
          <button onClick={onClose} className="bg-slate-900 text-white font-black px-12 py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-colors">Fechar</button>
        </div>
      </div>
    </div>
  );
};

const CheckoutPixView = ({ plan, data, setData, onSubmit }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);

  const handleFinalSubmit = () => {
    if (!termsAccepted) {
      setShowValidationError(true);
      return;
    }
    onSubmit();
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <SubscriberTermsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Step indicator */}
      <div className="flex items-center gap-3 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">1</div>
          <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Cadastro</span>
        </div>
        <div className="h-px w-10 bg-slate-200" />
        <div className="flex items-center gap-2 opacity-40">
          <div className="w-7 h-7 rounded-full bg-slate-300 text-white text-xs font-black flex items-center justify-center">2</div>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Pagamento</span>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Criar sua conta</h2>
        <p className="text-slate-500 font-medium text-sm">Plano <span className="font-black text-slate-700 uppercase">{plan.tier}</span> — R$ {plan.price}/mês</p>
      </div>

      <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm space-y-5">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo *</label>
          <input
            required
            value={data.name}
            onChange={e => setData({...data, name: e.target.value})}
            placeholder="Dr. João Silva"
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email *</label>
          <input
            required
            type="email"
            value={data.email}
            onChange={e => setData({...data, email: e.target.value})}
            placeholder="joao@clinica.com.br"
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp *</label>
          <input
            required
            value={data.whatsapp}
            onChange={e => setData({...data, whatsapp: formatWhatsApp(e.target.value)})}
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Especialidade</label>
          <input
            value={data.specialty}
            onChange={e => setData({...data, specialty: e.target.value})}
            placeholder="Ex: Ortodontia, Estética..."
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-colors"
          />
        </div>

        <label className="flex gap-3 items-start cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => { setTermsAccepted(e.target.checked); if (e.target.checked) setShowValidationError(false); }}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
          />
          <p className="text-[11px] font-bold text-slate-600 leading-snug">
            Li e concordo com os{' '}
            <button onClick={() => setIsModalOpen(true)} className="text-blue-600 hover:underline">Termos do Assinante</button>.
          </p>
        </label>
        {showValidationError && (
          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest animate-pulse">Aceite os Termos para continuar.</p>
        )}
      </div>

      <button
        onClick={handleFinalSubmit}
        className="w-full bg-blue-600 text-white font-black py-6 rounded-3xl text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
      >
        Avançar para Pagamento <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

const CheckoutConfirmView = ({ plan, planMeta, paymentLink, data, onSendComprovante, onBack }: any) => (
  <div className="max-w-xl mx-auto px-6 py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4">

    {/* Step indicator */}
    <div className="flex items-center gap-3 justify-center">
      <div className="flex items-center gap-2 opacity-40">
        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center"><Check className="w-4 h-4" /></div>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cadastro</span>
      </div>
      <div className="h-px w-10 bg-slate-200" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">2</div>
        <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Pagamento</span>
      </div>
    </div>

    <div className="text-center space-y-2">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pagar Assinatura</h2>
      <p className="text-slate-500 font-medium text-sm">Olá, <span className="font-bold text-slate-700">{data.name}</span>. Sua conta está criada e aguardando pagamento.</p>
    </div>

    {/* Plan summary */}
    <div className="bg-slate-900 rounded-[3rem] p-8 text-white space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Plano escolhido</p>
          <p className="text-2xl font-black text-blue-400 uppercase">{planMeta?.label || plan.tier}</p>
          <p className="text-sm font-bold text-white/60">{planMeta?.tagline}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black">R$ {plan.price}</p>
          <p className="text-xs font-bold text-white/40">/mês</p>
        </div>
      </div>
      <div className="border-t border-white/10 pt-4 space-y-2">
        <div className="flex justify-between text-xs font-bold text-white/60">
          <span>Capacidade de leads</span>
          <span className="text-white">{planMeta?.leadCapacity}</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-white/60">
          <span>Análise de IA</span>
          <span className="text-white">{planMeta?.aiDepth}</span>
        </div>
      </div>
    </div>

    {/* Payment CTA */}
    <div className="space-y-3">
      <a
        href={paymentLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-blue-600 text-white font-black py-6 rounded-3xl text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
      >
        <Wallet className="w-5 h-5" /> Pagar Assinatura Agora
      </a>

      <p className="text-center text-xs font-medium text-slate-400">Você será redirecionado para a página de pagamento seguro.</p>

      <button
        onClick={onSendComprovante}
        className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl text-sm uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
      >
        <Check className="w-5 h-5" /> Já Paguei! Enviar Comprovante
      </button>

      <p className="text-center text-[10px] font-medium text-slate-400">
        Clique acima para abrir o WhatsApp e enviar o comprovante ao nosso suporte. Ativamos sua conta em até 24h.
      </p>
    </div>

    <button onClick={onBack} className="w-full py-2 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600">
      ← Voltar ao Cadastro
    </button>
  </div>
);

const CheckoutDoneView = ({ onBackToLogin }: any) => (
  <div className="max-w-xl mx-auto px-6 py-12 text-center space-y-8 animate-in fade-in slide-in-from-bottom-6">
    <div className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-2xl space-y-8">

      <div className="w-20 h-20 rounded-[2rem] bg-amber-50 flex items-center justify-center mx-auto text-amber-500">
        <Clock className="w-10 h-10" />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Aguardando Ativação</p>
        <h2 className="text-4xl font-black tracking-tight text-slate-900">Comprovante enviado!</h2>
        <p className="text-slate-500 font-medium leading-relaxed">
          Recebemos sua solicitação de ativação para o plano. Nossa equipe verificará o pagamento e ativará sua conta em até <strong className="text-slate-700">24 horas</strong>.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 text-left space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O que acontece agora?</p>
        <div className="space-y-2.5">
          {[
            'Nossa equipe recebe seu comprovante pelo WhatsApp',
            'Verificamos o pagamento e ativamos sua conta',
            'Você recebe uma mensagem de confirmação com seus dados de acesso',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-sm font-medium text-slate-600">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-400">
          Dúvidas? Fale direto com nosso suporte pelo WhatsApp.
        </p>
        <button
          onClick={onBackToLogin}
          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-colors"
        >
          Voltar ao Início
        </button>
      </div>
    </div>
  </div>
);

const LandingView = ({ onStart }: any) => (
  <div className="animate-in fade-in duration-700">
    {/* Hero */}
    <div className="px-6 py-20 flex flex-col items-center text-center space-y-10 max-w-5xl mx-auto">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
        <Sparkles className="w-3.5 h-3.5" /> Triagem Estética com IA — 100% Gratuita
      </div>
      <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9]">
        Descubra o potencial real do seu <span className="text-blue-600">Sorriso</span> em 30 segundos.
      </h1>
      <p className="text-slate-500 font-medium text-xl max-w-2xl leading-relaxed">
        Nossa IA analisa simetria, croma e alinhamento — e entrega um relatório técnico personalizado. Sem cadastro, sem compromisso.
      </p>
      <button onClick={onStart} className="bg-slate-900 text-white px-12 py-7 rounded-[2.5rem] font-black text-xl flex items-center gap-4 hover:scale-105 hover:bg-blue-600 transition-all shadow-2xl">
        Iniciar Minha Triagem <ArrowRight className="w-6 h-6" />
      </button>
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-slate-400">
        <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Foto descartada imediatamente</span>
        <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> LGPD Compliant</span>
        <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Resultado em segundos</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-500">
          <span className="text-2xl">📸</span>
          <span>1 foto — análise completa</span>
        </div>
        <div className="w-px h-5 bg-slate-200 hidden sm:block"/>
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-500">
          <span className="text-2xl">🔬</span>
          <span>6 métricas em tempo real</span>
        </div>
        <div className="w-px h-5 bg-slate-200 hidden sm:block"/>
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-500">
          <span className="text-2xl">🗑️</span>
          <span>Foto apagada após análise</span>
        </div>
      </div>
    </div>

    {/* How it works */}
    <div className="bg-slate-50 border-t border-slate-100 py-16 px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Como Funciona</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Simples. Rápido. Revelador.</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { n: '01', icon: '📸', title: 'Foto do Sorriso', desc: 'Guia visual te ajuda a posicionar os dentes corretamente.' },
            { n: '02', icon: '🤖', title: 'IA Analisa', desc: 'Detecta simetria, refletividade e tom VITA em segundos.' },
            { n: '03', icon: '📊', title: 'Preview Parcial', desc: 'Receba seus scores sem fornecer nenhum dado. Sem compromisso.' },
            { n: '04', icon: '📋', title: 'Relatório Completo', desc: 'Forneça seu contato e desbloqueie o relatório técnico detalhado.' },
          ].map(step => (
            <div key={step.n} className="bg-white rounded-[2rem] p-6 space-y-4 border border-slate-100 shadow-sm text-center">
              <div className="text-3xl">{step.icon}</div>
              <div className="space-y-1.5">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{step.n}</p>
                <p className="font-black text-slate-900 text-sm">{step.title}</p>
                <p className="text-[11px] font-medium text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <button onClick={onStart} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-xl shadow-blue-100">
            Começar agora — é grátis <ArrowRight className="w-4 h-4 inline-block ml-2" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ConsentView = ({ onAccept, onBack }: any) => {
  const [isChecked, setIsChecked] = useState(false);
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div className="bg-white border p-10 rounded-[3rem] shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 font-black text-sm shrink-0">← Voltar</button>
          )}
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Termos de Triagem & Privacidade</h2>
        </div>
        <div className="max-h-80 overflow-y-auto pr-4 space-y-6 text-sm font-medium text-slate-600 leading-relaxed scrollbar-thin">
          <section className="space-y-3">
            <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Termos do Paciente (v1.0)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Finalidade informativa:</strong> a triagem é uma análise estética automatizada para orientação e organização do atendimento. Não é diagnóstico, não substitui consulta odontológica e não deve ser usada para urgências.</li>
              <li><strong>Uso temporário da imagem:</strong> sua imagem é usada apenas durante a triagem para gerar o resultado e é descartada em seguida. A Sorvy não armazena nem compartilha a foto com a clínica/dentista.</li>
              <li><strong>Encaminhamento para agendamento:</strong> ao continuar, você autoriza o envio do seu resumo (scores/insights/recomendação) e dos seus dados de contato (nome e WhatsApp) para a clínica/dentista do link utilizado, exclusivamente para contato e agendamento.</li>
              <li><strong>Responsabilidade profissional:</strong> decisões clínicas e condutas são de responsabilidade do profissional.</li>
              <li><strong>Direitos do titular:</strong> você pode solicitar acesso, correção ou exclusão dos seus dados pelo e-mail contato@sorvy.com.br.</li>
            </ul>
          </section>
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Política de Privacidade (v1.0)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Dados coletados:</strong> nome (se informado), WhatsApp, scores/insights e informações derivadas da triagem, e data/hora.</li>
              <li><strong>Imagem:</strong> a foto é utilizada somente para gerar o resultado e não é armazenada nem compartilhada.</li>
              <li><strong>Finalidades:</strong> gerar seu resultado, encaminhar seu resumo e contato ao profissional do link, e melhorar o serviço.</li>
              <li><strong>Compartilhamento:</strong> compartilhamos apenas com a clínica/dentista do link e somente para contato/agendamento. Não vendemos dados.</li>
              <li><strong>Retenção:</strong> mantemos seus dados pelo tempo necessário para contato e operação; você pode solicitar exclusão a qualquer momento.</li>
            </ul>
          </section>
          <p className="text-[10px] font-black text-slate-400 uppercase text-right pt-4">Última atualização: {CONSENT_VERSION}</p>
        </div>
        <label className="flex gap-4 cursor-pointer p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
          <input type="checkbox" checked={isChecked} onChange={e => setIsChecked(e.target.checked)} className="w-6 h-6 rounded border-2 border-slate-300 text-blue-600 focus:ring-blue-500" />
          <p className="text-slate-700 font-bold text-sm leading-tight">Li e concordo com os Termos e com a Política de Privacidade.</p>
        </label>
        <button disabled={!isChecked} onClick={onAccept} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl disabled:opacity-30 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">CONCORDO E CONTINUAR</button>
      </div>
    </div>
  );
};

const CaptureView = ({ onUpload, onBack }: any) => (
  <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
    {onBack && (
      <div className="flex justify-start">
        <button onClick={onBack} className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 font-black text-sm">← Voltar</button>
      </div>
    )}

    <div className="text-center space-y-2">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Foto do Sorriso</h2>
      <p className="text-slate-400 font-medium">Encaixe seus dentes no guia abaixo e toque para fotografar.</p>
    </div>

    {/* Camera frame with visual guide */}
    <div className="relative bg-slate-900 rounded-[3rem] overflow-hidden cursor-pointer shadow-2xl" style={{ paddingBottom: '82%' }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-5">

        {/* SVG mouth framing guide */}
        <svg viewBox="0 0 320 175" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[320px]">
          {/* Subtle center crosshairs */}
          <line x1="160" y1="8" x2="160" y2="167" stroke="#334155" strokeWidth="1" strokeDasharray="3,6"/>
          <line x1="8" y1="87" x2="312" y2="87" stroke="#334155" strokeWidth="1" strokeDasharray="3,6"/>

          {/* Corner alignment markers — blue, camera-viewfinder style */}
          <path d="M14,48 L14,14 L48,14" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M306,48 L306,14 L272,14" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14,127 L14,161 L48,161" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M306,127 L306,161 L272,161" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>

          {/* Mouth oval — positioning guide */}
          <ellipse cx="160" cy="90" rx="108" ry="48" fill="rgba(59,130,246,0.07)" stroke="#3B82F6" strokeWidth="2" strokeDasharray="9,5"/>

          {/* Gum line */}
          <line x1="58" y1="90" x2="262" y2="90" stroke="#475569" strokeWidth="1"/>

          {/* Upper teeth — 7 simplified tooth shapes */}
          <rect x="68" y="72" width="17" height="17" rx="4" fill="white" stroke="#94A3B8" strokeWidth="1.5"/>
          <rect x="87" y="69" width="21" height="20" rx="4" fill="white" stroke="#94A3B8" strokeWidth="1.5"/>
          <rect x="110" y="68" width="23" height="21" rx="4" fill="white" stroke="#CBD5E1" strokeWidth="1.5"/>
          <rect x="135" y="67" width="24" height="22" rx="4" fill="white" stroke="#CBD5E1" strokeWidth="1.5"/>
          <rect x="161" y="67" width="24" height="22" rx="4" fill="white" stroke="#CBD5E1" strokeWidth="1.5"/>
          <rect x="187" y="68" width="23" height="21" rx="4" fill="white" stroke="#94A3B8" strokeWidth="1.5"/>
          <rect x="212" y="69" width="21" height="20" rx="4" fill="white" stroke="#94A3B8" strokeWidth="1.5"/>
          <rect x="235" y="72" width="17" height="17" rx="4" fill="white" stroke="#94A3B8" strokeWidth="1.5"/>

          {/* "Posicione seu sorriso aqui" label */}
          <text x="160" y="154" textAnchor="middle" fill="#64748B" fontSize="9.5" fontWeight="bold" letterSpacing="2.5">POSICIONE SEU SORRISO AQUI</text>
        </svg>

        {/* Camera button indicator */}
        <div className="flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl">
          <Camera className="w-5 h-5" /> Toque para Fotografar
        </div>
      </div>

      {/* Invisible full-overlay input */}
      <input type="file" accept="image/*" capture="user" onChange={onUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
    </div>

    {/* 3-step guide */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { icon: '☀️', title: 'Boa iluminação', desc: 'Luz frontal, sem sombras' },
        { icon: '😁', title: 'Sorriso aberto', desc: 'Dentes totalmente visíveis' },
        { icon: '📱', title: 'Câmera reta', desc: 'Na altura dos olhos' },
      ].map(step => (
        <div key={step.title} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center space-y-1.5">
          <div className="text-2xl">{step.icon}</div>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-wider leading-tight">{step.title}</p>
          <p className="text-[10px] font-medium text-slate-400 leading-tight">{step.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

const ValidationView = ({ image, validation, isLoading, onRetry, onConfirm }: any) => (
  <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
    <div className="relative rounded-[3.5rem] overflow-hidden border-8 border-white shadow-2xl">
      <img src={image} className="w-full aspect-square object-cover" />
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full border-t-blue-500 animate-spin" />
          <p className="text-white font-black text-sm uppercase tracking-widest">Validando qualidade...</p>
        </div>
      )}
      {!validation?.isAdequate && !isLoading && (
        <div className="absolute inset-0 bg-red-500/25 flex flex-col items-center justify-center gap-4 backdrop-blur-[1px]">
          <div className="bg-red-600 rounded-full p-4 shadow-2xl">
            <XCircle className="w-10 h-10 text-white" />
          </div>
          <div className="bg-white/95 rounded-2xl px-6 py-4 max-w-[80%] text-center shadow-xl">
            <p className="text-red-600 font-black text-sm leading-snug">{validation?.feedback || 'Foto não adequada para análise.'}</p>
            <p className="text-slate-500 font-bold text-xs mt-1">Toque em "Repetir Foto" para tentar novamente.</p>
          </div>
        </div>
      )}
      {validation?.isAdequate && !isLoading && (
        <div className="absolute top-5 right-5">
          <div className="bg-emerald-500 rounded-full p-2.5 shadow-xl">
            <Check className="w-5 h-5 text-white" />
          </div>
        </div>
      )}
    </div>
    <div className="flex gap-4">
      <button onClick={onRetry} className="flex-1 bg-white border-2 border-slate-200 py-6 rounded-[2rem] font-black uppercase text-xs hover:bg-slate-50 transition-colors">REPETIR FOTO</button>
      <button disabled={!validation?.isAdequate || isLoading} onClick={onConfirm} className="flex-1 bg-blue-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors">
        USAR ESTA FOTO
      </button>
    </div>
  </div>
);

const ANALYZING_STAGES = [
  'Detectando pontos de simetria facial...',
  'Analisando refletividade do esmalte...',
  'Estimando tom VITA e croma...',
  'Mapeando alinhamento oclusal...',
  'Gerando seu relatório personalizado...',
];

const AnalyzingView = () => {
  const [stageIdx, setStageIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStageIdx(i => (i + 1) % ANALYZING_STAGES.length), 2200);
    return () => clearInterval(interval);
  }, []);
  const progress = Math.round(((stageIdx + 1) / ANALYZING_STAGES.length) * 100);
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-10 text-center px-6">
      <div className="relative w-40 h-40">
        <div className="w-40 h-40 border-[10px] border-blue-50 rounded-full border-t-blue-600 animate-spin shadow-inner" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-blue-600 opacity-40" />
        </div>
      </div>
      <div className="space-y-4 max-w-sm">
        <h2 className="text-4xl font-black tracking-tight">Triagem Digital em Curso...</h2>
        <p className="text-blue-600 font-black text-sm uppercase tracking-widest animate-pulse min-h-[1.5rem]">
          {ANALYZING_STAGES[stageIdx]}
        </p>
      </div>
      <div className="w-64 space-y-2">
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-[2200ms]" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{progress}%</p>
      </div>
      <p className="text-slate-400 font-bold text-sm max-w-xs">Sua foto será deletada permanentemente ao final da análise.</p>
    </div>
  );
};

const ResultsView = ({ scores, onNext }: any) => {
  const avgHealth = Math.round((scores.harmonyIndex + scores.brightnessIndex + scores.technicalInsights.symmetry + scores.technicalInsights.alignment) / 4);
  const rawUrgency = 100 - avgHealth;
  const urgencyScore = scores.status === 'Prioridade'
    ? Math.max(rawUrgency, 68)
    : scores.status === 'Atenção'
    ? Math.min(Math.max(rawUrgency, 38), 65)
    : Math.min(rawUrgency, 35);

  const isUrgent = scores.status === 'Prioridade';
  const isAttention = scores.status === 'Atenção';
  const urgencyLabel = isUrgent ? 'Tratamento Urgente' : isAttention ? 'Avaliação Recomendada' : 'Manutenção Preventiva';
  const urgencyWindow = isUrgent ? '2 a 4 semanas' : isAttention ? '4 a 8 semanas' : '3 a 6 meses';
  const urgencyBg = isUrgent ? 'bg-red-50 border-red-100' : isAttention ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100';
  const urgencyTextColor = isUrgent ? 'text-red-600' : isAttention ? 'text-amber-600' : 'text-emerald-600';
  const urgencyCircleBg = isUrgent ? 'bg-red-100 border-red-200' : isAttention ? 'bg-amber-100 border-amber-200' : 'bg-emerald-100 border-emerald-200';
  const urgencyBarColor = isUrgent ? 'bg-red-500' : isAttention ? 'bg-amber-500' : 'bg-emerald-500';
  const urgencyDesc = isUrgent
    ? 'Nossa IA identificou padrões que requerem atenção profissional em breve.'
    : isAttention
    ? 'Há oportunidade de melhora significativa dentro de uma janela favorável.'
    : 'Seu perfil indica saúde estética satisfatória. Manutenção preventiva recomendada.';

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100">
          <ShieldCheck className="w-4 h-4" /> Foto Descartada com Segurança
        </div>
        <h2 className="text-4xl font-black">Seu Resumo de Saúde & Estética</h2>
        <p className="text-slate-400 font-bold">Preview parcial da sua triagem inteligente.</p>
      </div>

      {/* Urgency Score Card */}
      <div className={`w-full border rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-8 ${urgencyBg}`}>
        <div className={`shrink-0 w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center ${urgencyCircleBg}`}>
          <span className={`text-5xl font-black leading-none ${urgencyTextColor}`}>{urgencyScore}</span>
          <span className={`text-[9px] font-black uppercase tracking-widest mt-1 ${urgencyTextColor} opacity-70`}>/ 100</span>
        </div>
        <div className="flex-1 text-left space-y-3">
          <div className="flex items-center gap-3">
            {isUrgent && <span className="relative flex h-3 w-3 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"/></span>}
            <span className={`font-black text-2xl tracking-tight ${urgencyTextColor}`}>{urgencyLabel}</span>
          </div>
          <p className={`text-sm font-bold ${urgencyTextColor} opacity-80`}>{urgencyDesc}</p>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-widest ${urgencyTextColor} opacity-60`}>Janela de Intervenção Ideal</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${urgencyTextColor}`}>{urgencyWindow}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/60">
              <div className={`h-2 rounded-full ${urgencyBarColor}`} style={{ width: `${urgencyScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-[2.5rem] p-6 text-center shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Harmonia de Arco</p>
          <p className="text-4xl font-black text-blue-600">{scores.technicalInsights.symmetry}%</p>
        </div>
        <div className="bg-white border rounded-[2.5rem] p-6 text-center shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Refletividade</p>
          <p className="text-4xl font-black text-yellow-500">{scores.technicalInsights.reflectivity}%</p>
        </div>
        <div className="bg-white border rounded-[2.5rem] p-6 text-center shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Tom VITA (Est.)</p>
          <p className="text-4xl font-black text-slate-900">{scores.vitaShade}</p>
        </div>
        <div className="bg-slate-900 rounded-[2.5rem] p-6 text-center shadow-xl">
          <p className="text-[10px] font-black text-white/40 uppercase mb-2">Brilho Geral</p>
          <p className="text-4xl font-black text-green-400">{scores.brightnessIndex}%</p>
        </div>
      </div>

      {/* CTA block */}
      <div className="bg-blue-600 rounded-[3rem] p-10 text-white text-center space-y-8 shadow-2xl">
        <Sparkles className="w-12 h-12 mx-auto text-blue-200" />
        <h3 className="text-3xl font-black">Insights Técnicos Detectados</h3>
        <p className="text-lg font-bold text-blue-100 leading-relaxed italic">"Análise de visagismo sugere potencial imediato para realce estético baseado em croma e alinhamento."</p>
        <button onClick={onNext} className="w-full bg-white text-blue-600 py-6 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all text-sm">
          LIBERAR RELATÓRIO COMPLETO <ArrowRight className="w-5 h-5 inline-block ml-2" />
        </button>
      </div>
    </div>
  );
};

const DispatchView = ({ lead, setLead, isCaptured, scores, onSubmit, onFinalCTA, hasReferral }: any) => {
  if (!isCaptured) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <form onSubmit={onSubmit} className="bg-white border p-12 rounded-[4rem] shadow-2xl space-y-10 border-slate-100">
          <div className="text-center space-y-4">
            <div className="bg-blue-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-blue-600 mb-2">
               <User className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">Desbloqueio de Relatório</h2>
            <p className="text-slate-500 font-medium">Informe seus dados para salvar sua triagem e receber o plano de ação personalizado.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome Completo</label>
               <input required value={lead.name} onChange={e => setLead({...lead, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl font-bold outline-none focus:border-blue-500 transition-colors" placeholder="Seu nome" />
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">WhatsApp</label>
               <input required value={lead.whatsapp} onChange={e => setLead({...lead, whatsapp: formatWhatsApp(e.target.value)})} inputMode="numeric" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl font-bold outline-none focus:border-blue-500 transition-colors" placeholder="(11) 99999-9999" />
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl">
             <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Ao clicar, você confirma seu consentimento para envio do resumo técnico à clínica/dentista do link, conforme nossa Política de Privacidade.</p>
          </div>

          <button type="submit" className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-colors">ACESSAR RECOMENDAÇÕES</button>
        </form>
      </div>
    );
  }
  const avgHealthD = scores ? Math.round((scores.harmonyIndex + scores.brightnessIndex + scores.technicalInsights.symmetry + scores.technicalInsights.alignment) / 4) : 50;
  const rawUrgencyD = 100 - avgHealthD;
  const urgencyScoreD = scores?.status === 'Prioridade' ? Math.max(rawUrgencyD, 68) : scores?.status === 'Atenção' ? Math.min(Math.max(rawUrgencyD, 38), 65) : Math.min(rawUrgencyD, 35);
  const isUrgentD = scores?.status === 'Prioridade';
  const isAttentionD = scores?.status === 'Atenção';
  const urgencyWindowD = isUrgentD ? '2 a 4 semanas' : isAttentionD ? '4 a 8 semanas' : '3 a 6 meses';
  const statusBadgeCls = isUrgentD ? 'bg-red-100 text-red-700' : isAttentionD ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  const urgencyBarD = isUrgentD ? 'bg-red-500' : isAttentionD ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-0 animate-in fade-in zoom-in-95 duration-500">
      {/* Document header */}
      <div className="bg-slate-900 rounded-t-[3rem] px-10 py-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shrink-0"><Smile className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Sorvy Smile — Relatório de Triagem</p>
            <p className="text-white font-black text-lg leading-tight">{lead.name}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Gerado em</p>
          <p className="text-white font-bold text-sm">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white border border-slate-100 rounded-b-[3rem] shadow-2xl divide-y divide-slate-100">

        {/* Section 1: Sumário executivo */}
        <div className="p-8 space-y-5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sumário Executivo</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
              <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-1">Índice Geral</p>
              <p className="text-5xl font-black text-blue-400 leading-none">{scores?.harmonyIndex}</p>
              <p className="text-[8px] font-black text-white/30 mt-1">/ 100</p>
              <div className={`mt-2 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${statusBadgeCls}`}>{scores?.status}</div>
            </div>
            <div className="col-span-2 grid grid-rows-2 gap-3">
              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-[7px] font-black text-blue-500 uppercase tracking-widest mb-1">Especialidade Indicada</p>
                <p className="text-xl font-black text-slate-900 leading-tight">{scores?.recommendedSpecialty}</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4">
                <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest mb-1">Ticket Estimado de Tratamento</p>
                <p className="text-xl font-black text-slate-900 leading-tight">{scores?.ticketLikely} <span className="text-sm font-bold text-amber-600">• {scores?.intentCategory}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Análise técnica */}
        <div className="p-8 space-y-5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Análise Técnica Detalhada</p>
          <div className="space-y-4">
            {[
              { label: 'Harmonia de Arco', value: scores?.technicalInsights.symmetry, sub: 'Distribuição e simetria da arcada', color: 'bg-blue-500' },
              { label: 'Alinhamento Oclusal', value: scores?.technicalInsights.alignment, sub: 'Relação entre arcadas superior e inferior', color: 'bg-violet-500' },
              { label: 'Refletividade do Esmalte', value: scores?.technicalInsights.reflectivity, sub: 'Luminosidade e saúde superficial', color: 'bg-yellow-500' },
              { label: 'Índice de Brilho (Croma)', value: scores?.brightnessIndex, sub: 'Saturação de cor e vitalidade geral', color: 'bg-emerald-500' },
            ].map(m => (
              <div key={m.label} className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-black text-slate-800">{m.label}</span>
                    <span className="text-[10px] font-medium text-slate-400 ml-2">{m.sub}</span>
                  </div>
                  <span className="text-xl font-black text-slate-900 shrink-0 ml-4">{m.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full">
                  <div className={`h-2 rounded-full ${m.color}`} style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tom VITA Estimado</p>
              <p className="text-4xl font-black text-slate-900">{scores?.vitaShade}</p>
              <p className="text-[9px] font-medium text-slate-400 mt-1">Referência Vita Classical Scale</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Benchmark Comparativo</p>
              <p className="text-sm font-bold text-slate-700 leading-snug">{scores?.benchmarkText}</p>
            </div>
          </div>
        </div>

        {/* Section 3: Janela de intervenção */}
        <div className="p-8 space-y-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Janela de Intervenção</p>
          <div className="flex items-center gap-6 bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div className="shrink-0 text-center w-20">
              <p className={`text-4xl font-black ${isUrgentD ? 'text-red-600' : isAttentionD ? 'text-amber-600' : 'text-emerald-600'}`}>{urgencyScoreD}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">/ 100</p>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                {isUrgentD && <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"/></span>}
                <span className={`font-black text-lg ${isUrgentD ? 'text-red-600' : isAttentionD ? 'text-amber-600' : 'text-emerald-600'}`}>{scores?.status === 'Prioridade' ? 'Tratamento Urgente' : scores?.status === 'Atenção' ? 'Avaliação Recomendada' : 'Manutenção Preventiva'}</span>
              </div>
              <div className="w-full h-1.5 bg-white rounded-full border border-slate-200">
                <div className={`h-1.5 rounded-full ${urgencyBarD}`} style={{ width: `${urgencyScoreD}%` }} />
              </div>
              <p className="text-[10px] font-bold text-slate-500">Janela ideal de intervenção: <strong className="text-slate-800">{urgencyWindowD}</strong></p>
            </div>
          </div>
        </div>

        {/* Section 4: Recomendação da IA */}
        <div className="p-8 space-y-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5" /> Recomendação da Inteligência Artificial</p>
          <div className="bg-blue-600 rounded-2xl p-7">
            <p className="text-xl font-black text-white leading-snug">{scores?.recommendation || 'Análise de triagem concluída com sucesso.'}</p>
          </div>
        </div>

        {/* Section 5: Observações clínicas */}
        <div className="p-8 space-y-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Observações Clínicas Identificadas</p>
          <div className="space-y-2">
            {scores?.observations.map((obs: string, i: number) => (
              <div key={i} className="flex gap-3 items-start p-4 bg-slate-50 rounded-xl border border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-slate-700">{obs}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 6: Plano de ação */}
        <div className="p-8 space-y-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plano de Ação Recomendado</p>
          <div className="space-y-3">
            {[
              { n: '01', title: 'Consulta de Avaliação', desc: `Agendar avaliação presencial com especialista em ${scores?.recommendedSpecialty || 'Estética Dental'}.` },
              { n: '02', title: 'Plano de Tratamento Personalizado', desc: 'Definição do protocolo com base nos insights técnicos desta triagem.' },
              { n: '03', title: 'Início e Acompanhamento', desc: 'Execução com monitoramento profissional e resultados mensuráveis ao longo do tempo.' },
            ].map(s => (
              <div key={s.n} className="flex gap-4 items-start p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <span className="text-2xl font-black text-slate-200 shrink-0 w-10 text-center leading-none pt-1">{s.n}</span>
                <div>
                  <p className="font-black text-slate-900 text-sm">{s.title}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div className="p-8 space-y-4">
          <p className="text-[10px] font-medium text-slate-400 text-center leading-relaxed">
            {hasReferral
              ? 'Relatório encaminhado ao profissional parceiro. Inicie o agendamento ou aguarde o contato por WhatsApp.'
              : 'Relatório pronto. Escolha um profissional da nossa rede para agendar sua consulta.'}
          </p>
          <button onClick={onFinalCTA} className="w-full bg-green-600 text-white font-black py-6 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-green-700 transition-all uppercase tracking-widest text-sm">
            {hasReferral ? <>AGENDAR CONSULTA AGORA <ExternalLink className="w-5 h-5" /></> : <>VER PROFISSIONAIS DA REDE <ExternalLink className="w-5 h-5" /></>}
          </button>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Sorvy Smile — Foto descartada imediatamente. LGPD Compliant.</p>
        </div>
      </div>
    </div>
  );
};

const NetworkListView = ({
  dentists,
  billingAccounts,
  scores,
  patientName,
  onContact,
  onBack,
}: {
  dentists: any[];
  billingAccounts: Record<string, any>;
  scores: SmileScores;
  patientName: string;
  onContact: (dentistId: string) => void;
  onBack: () => void;
}) => {
  const [cityFilter, setCityFilter] = React.useState<string>('all');
  const cities = Array.from(new Set(dentists.map(d => d.city).filter(Boolean))).sort();
  const filtered = cityFilter === 'all' ? dentists : dentists.filter(d => d.city === cityFilter);

  const planBadge = (plan: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      lite: { label: 'Parceiro', cls: 'bg-slate-100 text-slate-600' },
      pro: { label: 'Pro', cls: 'bg-blue-50 text-blue-600' },
      network: { label: 'Network', cls: 'bg-emerald-50 text-emerald-600' },
    };
    const b = map[plan] || map.lite;
    return <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${b.cls}`}>{b.label}</span>;
  };

  return (
    <div className="px-6 py-12 space-y-10">
      <div className="max-w-3xl mx-auto text-center space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar ao relatório
        </button>
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
          <CheckCircle2 className="w-3.5 h-3.5" /> Triagem concluída — {scores.harmonyIndex}% de harmonia
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
          Olá {patientName?.split(' ')[0] || 'paciente'},<br />
          escolha um <span className="text-blue-600">profissional da rede</span>.
        </h1>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">
          Ao clicar em um dentista, abrimos o WhatsApp com seu resultado já preenchido. O profissional retorna o contato para agendar sua avaliação.
        </p>
      </div>

      {cities.length > 1 && (
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar por cidade:</span>
          <button
            onClick={() => setCityFilter('all')}
            className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors ${cityFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}
          >
            Todas
          </button>
          {cities.map(c => (
            <button
              key={c}
              onClick={() => setCityFilter(c)}
              className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors ${cityFilter === c ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-12 text-center space-y-4">
            <Sparkles className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-slate-500 font-bold">Nenhum profissional encontrado nessa cidade.</p>
            <button onClick={() => setCityFilter('all')} className="text-blue-600 font-black text-sm uppercase tracking-widest">Ver todos</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(d => {
              const acc = billingAccounts[d.billingAccountId];
              const ownerType = acc?.ownerType === 'clinic' ? 'Clínica' : 'Consultório';
              return (
                <div key={d.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all flex flex-col">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-white shadow overflow-hidden flex items-center justify-center shrink-0">
                      {d.profileImage ? (
                        <img src={d.profileImage} alt={d.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-7 h-7 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {planBadge(d.plan)}
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ownerType}</span>
                      </div>
                      <h3 className="font-black text-slate-900 text-base leading-tight truncate">{d.name}</h3>
                      <p className="text-[11px] font-bold text-slate-400 mt-1">{d.teamTag || 'Especialista'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mb-5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{d.city || 'Cidade'}{d.state ? ` • ${d.state}` : ''}</span>
                  </div>
                  <button
                    onClick={() => onContact(d.id)}
                    className="mt-auto w-full bg-emerald-600 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors text-xs uppercase tracking-widest"
                  >
                    <Phone className="w-4 h-4" /> Falar no WhatsApp
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

type LoginResult = 'success' | 'wrong_credentials' | 'pending' | 'inactive';

const LoginView = ({
  onLogin,
  onContinueAsPatient,
}: {
  onLogin: (email: string, password: string) => LoginResult;
  onContinueAsPatient: () => void;
}) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<Exclude<LoginResult, 'success'> | null>(null);
  const [loading, setLoading] = React.useState(false);

  const errorMessages: Record<Exclude<LoginResult, 'success'>, string> = {
    wrong_credentials: 'Email ou senha incorretos. Verifique suas credenciais.',
    pending: 'Sua conta está aguardando ativação. Você receberá uma confirmação via WhatsApp em breve.',
    inactive: 'Conta inativa. Entre em contato com o suporte pelo WhatsApp.',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTimeout(() => {
      const result = onLogin(email, password);
      if (result !== 'success') setError(result);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="bg-blue-600 p-4 rounded-3xl shadow-2xl shadow-blue-500/30">
          <Smile className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <span className="text-white font-black text-3xl uppercase tracking-tight">Sorvy Smile</span>
          <p className="text-slate-400 text-sm font-medium mt-1">Plataforma de Triagem Odontológica</p>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-10 py-8 text-center">
          <ShieldCheck className="w-8 h-8 text-blue-400 mx-auto mb-3" />
          <h2 className="text-white font-black text-2xl">Acesso de Profissional</h2>
          <p className="text-slate-400 text-sm mt-2">Dentistas, clínicas e administradores</p>
        </div>

        <form onSubmit={handleSubmit} className="px-10 py-8 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-900 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && (
            <div className={`rounded-2xl px-5 py-4 text-sm font-bold flex items-start gap-3 ${error === 'pending' ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              <span className="text-lg leading-none">{error === 'pending' ? '⏳' : '✕'}</span>
              <span>{errorMessages[error]}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-black py-5 rounded-2xl transition-colors flex items-center justify-center gap-3 text-base uppercase tracking-widest shadow-lg shadow-blue-500/25"
          >
            {loading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verificando...
              </>
            ) : (
              'Entrar →'
            )}
          </button>

          <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest pt-1">
            Plano ativo • senha padrão: <span className="text-blue-500">sorvy123</span>
          </p>
        </form>

        <div className="border-t border-slate-100 px-10 py-6">
          <button
            onClick={onContinueAsPatient}
            className="w-full text-center text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 py-2"
          >
            <Smile className="w-4 h-4" />
            Sou paciente — iniciar triagem gratuita
          </button>
        </div>
      </div>

      <p className="text-slate-600 text-xs font-medium mt-8">
        Ainda não tem conta?{' '}
        <button
          className="text-blue-400 font-black hover:text-blue-300 transition-colors"
          onClick={onContinueAsPatient}
        >
          Ver planos →
        </button>
      </p>
    </div>
  );
};

const PLAN_META: Record<string, { label: string; tagline: string; for: string; aiDepth: string; aiDetail: string; leadCapacity: string; leadCapacityDetail: string }> = {
  lite: {
    label: 'Lite',
    tagline: 'Para começar a captar',
    for: 'Ideal para dentistas validando a captação digital.',
    aiDepth: 'Análise básica',
    aiDetail: 'Simetria e brilho — o paciente recebe um score parcial.',
    leadCapacity: 'Até 10 leads ativos',
    leadCapacityDetail: 'gerencie até 10 leads no portal ao mesmo tempo',
  },
  pro: {
    label: 'Pro',
    tagline: 'Para escalar a captação',
    for: 'Acelere seu consultório com dados e relatório completo.',
    aiDepth: 'Análise completa',
    aiDetail: 'Tom VITA, alinhamento, croma e refletividade — relatório técnico detalhado.',
    leadCapacity: 'Leads ilimitados',
    leadCapacityDetail: 'sem teto — gerencie toda a sua base de pacientes',
  },
  network: {
    label: 'Network',
    tagline: 'Para clínicas com equipe',
    for: 'Máximo posicionamento e gestão com múltiplos dentistas.',
    aiDepth: 'Análise completa',
    aiDetail: 'Tom VITA, alinhamento, croma e refletividade — relatório técnico detalhado.',
    leadCapacity: 'Leads ilimitados',
    leadCapacityDetail: 'sem teto — distribua leads entre toda a equipe',
  },
};

const PricingView = ({ configs, onSelect }: any) => (
  <div className="max-w-5xl mx-auto px-6 py-24 space-y-16">
    <div className="text-center space-y-5">
      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Planos</p>
      <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900">
        Quantos leads você quer<br/>manter na plataforma?
      </h2>
      <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
        O plano define quantos leads ficam ativos no seu portal e a profundidade da análise de IA — quanto mais completo o relatório, maior a conversão do paciente.
      </p>
    </div>

    <div className="grid md:grid-cols-3 gap-6 items-stretch">
      {(Object.values(configs) as PlanConfig[]).map((plan) => {
        const meta = PLAN_META[plan.tier];
        const isPro = plan.tier === 'pro';
        const isNetwork = plan.tier === 'network';
        return (
          <div key={plan.tier} className={`flex flex-col rounded-[3rem] overflow-hidden transition-all hover:shadow-2xl ${isPro ? 'ring-2 ring-blue-600 shadow-xl shadow-blue-100' : 'border border-slate-100'}`}>
            {/* Card header */}
            <div className={`px-8 py-7 ${isPro ? 'bg-blue-600' : 'bg-slate-900'}`}>
              {isPro && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-widest mb-3">
                  ✦ Mais escolhido
                </div>
              )}
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isPro ? 'text-blue-200' : 'text-white/40'}`}>{meta.label}</p>
              <p className={`text-xl font-black leading-tight ${isPro || isNetwork ? 'text-white' : 'text-white'}`}>{meta.tagline}</p>
            </div>

            {/* Card body */}
            <div className="flex-1 bg-white p-8 space-y-7">
              {/* Price */}
              <div>
                <p className="text-4xl font-black text-slate-900">R$ {plan.price}<span className="text-base font-bold text-slate-400">/mês</span></p>
              </div>

              {/* Who it's for */}
              <p className="text-sm font-medium text-slate-500 leading-relaxed border-l-2 border-slate-100 pl-4">{meta.for}</p>

              {/* Core specs */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-black text-lg leading-none mt-0.5">→</span>
                  <div>
                    <p className="text-sm font-black text-slate-900">{meta.leadCapacity}</p>
                    <p className="text-[10px] font-medium text-slate-400">{meta.leadCapacityDetail}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-black text-lg leading-none mt-0.5">→</span>
                  <div>
                    <p className="text-sm font-black text-slate-900">{meta.aiDepth}</p>
                    <p className="text-[10px] font-medium text-slate-400">{meta.aiDetail}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-black text-lg leading-none mt-0.5">→</span>
                  <div>
                    <p className="text-sm font-black text-slate-900">Bio Link de captação</p>
                    <p className="text-[10px] font-medium text-slate-400">link público para compartilhar com pacientes</p>
                  </div>
                </div>
                {isNetwork && (
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 font-black text-lg leading-none mt-0.5">→</span>
                    <div>
                      <p className="text-sm font-black text-slate-900">Painel da clínica + 2 usuários</p>
                      <p className="text-[10px] font-medium text-slate-400">distribua leads entre dentistas da equipe (+R$79/usuário extra)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className={`px-8 pb-8 bg-white`}>
              <button
                onClick={() => onSelect(plan.tier)}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg text-sm ${isPro ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' : 'bg-slate-900 text-white hover:bg-blue-600'}`}
              >
                Começar com {meta.label}
              </button>
            </div>
          </div>
        );
      })}
    </div>

    {/* Footnote */}
    <p className="text-center text-sm font-medium text-slate-400">
      Todos os planos incluem painel de gestão de leads, agendamento e contato via WhatsApp com os pacientes.
    </p>
  </div>
);

export default App;
