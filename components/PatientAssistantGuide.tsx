import React, { useMemo, useState } from "react";
import { Bot, ChevronRight, MessageCircle, ShieldCheck, X } from "lucide-react";
import { PublicPatientAssistant, PublicProfessionalProfile } from "../types";

interface PatientAssistantGuideProps {
  profile: PublicProfessionalProfile;
  stage: string;
}

const FAQ = [
  {
    id: "journey",
    label: "Como funciona?",
    answer: "Você envia uma foto somente após autorizar, recebe uma triagem visual informativa e pode escolher se quer conversar com o profissional.",
  },
  {
    id: "photo",
    label: "Como a foto é usada?",
    answer: "A foto é processada temporariamente para a leitura visual. Ela não é exibida para outros pacientes nem enviada para esta assistente.",
  },
  {
    id: "clinical",
    label: "Isso é um diagnóstico?",
    answer: "Não. A triagem do SorvySmile é informativa e não substitui uma avaliação com um profissional de saúde.",
  },
  {
    id: "contact",
    label: "Como falar com a clínica?",
    answer: "Ao final da experiência você poderá abrir o WhatsApp ou pedir para o profissional entrar em contato, sempre com sua autorização.",
  },
] as const;

function publicAssistantFor(profile: PublicProfessionalProfile): PublicPatientAssistant {
  const configured = profile.patientAssistant;
  const professionalName = profile.name.trim() || "o profissional responsável";
  const assistantName = configured?.name?.trim() || "Aury";
  if (configured?.isCustom) {
    return {
      ...configured,
      roleName: `Assistente virtual de ${professionalName}`,
      ctaText: `Falar com ${professionalName}`,
    };
  }
  const tone = configured?.tone ?? "professional_warm";
  const greetingByTone = {
    professional_warm: `Olá, eu sou a Aury, assistente virtual de ${professionalName}. Vou explicar a experiência e ajudar você a seguir com tranquilidade antes de falar com ${professionalName}.`,
    direct_clinical: `Olá, eu sou a Aury, assistente virtual de ${professionalName}. Vou orientar os próximos passos da sua triagem e como falar com ${professionalName}.`,
    empathetic_educational: `Olá, eu sou a Aury, assistente virtual de ${professionalName}. Estou aqui para explicar cada etapa com calma e ajudar você a chegar à conversa com mais clareza.`,
    casual_friendly: `Oi, eu sou a Aury, assistente virtual de ${professionalName}. Posso explicar a experiência e mostrar como falar com ${professionalName} quando você quiser.`,
  }[tone];
  return {
    id: configured?.id ?? `aury-${profile.professionalId ?? profile.slug}`,
    name: assistantName,
    roleName: `Assistente virtual de ${professionalName}`,
    description: configured?.description || `Esta é a experiência de ${professionalName}${profile.specialty ? ` · ${profile.specialty}` : ""}.`,
    greeting: greetingByTone,
    avatarUrl: configured?.avatarUrl ?? "",
    fullImageUrl: configured?.fullImageUrl ?? "",
    primaryColor: configured?.primaryColor ?? "#18AFA5",
    secondaryColor: configured?.secondaryColor ?? "#DDF4F6",
    ctaText: `Falar com ${professionalName}`,
    ctaLink: "",
    isCustom: false,
    tone,
    serviceContext: configured?.serviceContext ?? "",
  };
}

export const PatientAssistantGuide: React.FC<PatientAssistantGuideProps> = ({ profile, stage }) => {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const assistant = useMemo(() => publicAssistantFor(profile), [profile]);

  if (stage === "camera" || stage === "analyzing") return null;

  // The public assistant never routes a patient through a global or custom
  // link. The destination is always the professional identified by this slug.
  const contactLink = profile.whatsapp
    ? `https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`
    : "";
  const serviceContext = assistant.serviceContext?.trim() ?? "";
  const faq = serviceContext
    ? [
        ...FAQ,
        {
          id: "practice",
          label: "Informações do atendimento",
          answer: serviceContext,
        },
      ]
    : FAQ;

  return (
    <div className="fixed bottom-24 right-4 z-[80] sm:bottom-5 sm:right-5">
      {open && (
        <section className="mb-3 w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl">
          <header className="relative overflow-hidden p-5 text-white" style={{ background: `linear-gradient(135deg,${assistant.primaryColor},#123B5D)` }}>
            {assistant.fullImageUrl && <img src={assistant.fullImageUrl} alt="" className="pointer-events-none absolute -bottom-8 right-8 h-36 w-28 object-contain opacity-20" />}
            <button onClick={() => setOpen(false)} aria-label="Fechar assistente" className="float-right rounded-xl bg-white/10 p-2"><X className="h-4 w-4" /></button>
            <div className="relative flex items-center gap-3">
              {assistant.avatarUrl ? <img src={assistant.avatarUrl} alt={assistant.name} className="h-12 w-12 rounded-2xl bg-white/10 object-contain" /> : <span className="rounded-2xl bg-white/15 p-3"><Bot className="h-6 w-6" /></span>}
              <div><p className="font-black">{assistant.name}</p><p className="text-[10px] font-bold uppercase tracking-widest text-white/75">{assistant.roleName}</p></div>
            </div>
            <p className="relative mt-4 max-w-[18rem] text-sm font-medium leading-relaxed text-white/90">{assistant.greeting}</p>
            {assistant.description && <p className="relative mt-2 max-w-[18rem] text-[11px] font-medium leading-relaxed text-white/65">{assistant.description}</p>}
          </header>
          <div className="p-5">
            {answer && <div className="mb-4 rounded-2xl p-4 text-sm font-medium leading-relaxed text-[#183247]" style={{ backgroundColor: assistant.secondaryColor }}><p>{answer}</p><p className="mt-3 flex items-start gap-2 text-[10px] font-bold text-[#607487]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Orientação geral. Não é diagnóstico nem prescrição.</p></div>}
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Como posso ajudar?</p>
            <div className="mt-3 space-y-2">
              {faq.map((item) => <button key={item.id} onClick={() => setAnswer(item.answer)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left text-xs font-black text-slate-700 hover:bg-slate-100"><span>{item.label}</span><ChevronRight className="h-4 w-4 text-slate-400" /></button>)}
            </div>
            {contactLink && <a href={contactLink} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black text-white" style={{ backgroundColor: assistant.primaryColor }}><MessageCircle className="h-4 w-4" />{assistant.ctaText}</a>}
            <button onClick={() => setOpen(false)} className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-xs font-black text-slate-600">Continuar experiência</button>
          </div>
        </section>
      )}
      <button aria-label={`Abrir assistente ${assistant.name}`} onClick={() => setOpen((current) => !current)} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl" style={{ backgroundColor: assistant.primaryColor }}>
        {assistant.avatarUrl ? <img src={assistant.avatarUrl} alt="" className="h-7 w-7 rounded-full bg-white/15 object-contain" /> : <Bot className="h-5 w-5" />}
      </button>
    </div>
  );
};
