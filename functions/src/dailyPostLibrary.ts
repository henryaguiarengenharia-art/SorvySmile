export type DailyPostCategory =
  | "prevention"
  | "aesthetics"
  | "orthodontics"
  | "implants"
  | "pediatric"
  | "periodontics"
  | "urgent_care";

export type DailyPostGoal = "education" | "problem_awareness" | "authority" | "conversion";
export type DailyPostFormat = "single_card" | "carousel" | "qa" | "myth_truth" | "checklist";

export interface SeedDailyPostTemplate {
  id: string;
  title: string;
  hook: string;
  shortText: string;
  caption: string;
  ctaText: string;
  ctaType: "schedule" | "contact" | "learn" | "save" | "share";
  hashtags: string[];
  category: DailyPostCategory;
  communicationGoal: DailyPostGoal;
  targetAudienceTags: string[];
  specialtyTags: string[];
  editorialFormat: DailyPostFormat;
  feedLayoutKey: string;
  storyLayoutKey: string;
  paletteKey: string;
  imageStrategy: "illustration" | "no_photo";
  defaultImageUrl: string;
  carouselSlides: Array<{ title: string; text: string }>;
  status: "published";
  isEvergreen: true;
  priority: number;
  availableFrom: null;
  availableUntil: null;
  version: 1;
  mandatoryDate?: string;
}

interface Topic {
  title: string;
  message: string;
  category: DailyPostCategory;
  audience: string[];
  specialties: string[];
}

const topics: Topic[] = [
  ...[
    ["Escovação sem pressa", "Dois minutos de escovação cuidadosa alcançam áreas que a pressa costuma esquecer."],
    ["O fio dental completa a limpeza", "A escova não alcança bem os espaços entre os dentes; o fio dental faz parte da rotina."],
    ["Troque sua escova no tempo certo", "Cerdas abertas limpam menos e indicam que chegou a hora da troca."],
    ["Língua limpa, hálito mais fresco", "A limpeza suave da língua ajuda a remover resíduos e a manter o hálito agradável."],
    ["Água também cuida do sorriso", "Boa hidratação favorece a saliva, uma proteção natural importante da boca."],
    ["Açúcar: frequência importa", "Beliscar alimentos açucarados muitas vezes expõe os dentes repetidamente aos ácidos."],
    ["Consulta preventiva evita surpresas", "A avaliação periódica pode identificar alterações antes que causem incômodo."],
    ["Cuidado bucal durante viagens", "Levar um kit compacto ajuda a manter a rotina mesmo fora de casa."],
    ["Depois das refeições", "Espere alguns minutos e faça a higiene com movimentos suaves, sem força excessiva."],
    ["Sua escova precisa respirar", "Guarde a escova em posição vertical e em local ventilado após o uso."],
    ["Rotina noturna é indispensável", "A higiene antes de dormir merece atenção porque o fluxo de saliva diminui à noite."],
    ["Prevenção em todas as idades", "Hábitos simples e acompanhamento profissional protegem o sorriso ao longo da vida."],
  ].map(([title, message]) => ({ title, message, category: "prevention" as const, audience: ["adults", "families"], specialties: ["general_dentistry", "prevention"] })),
  ...[
    ["Clareamento começa com avaliação", "Cada sorriso tem características próprias; a avaliação orienta uma opção segura e realista."],
    ["Manchas externas e internas", "Nem toda alteração de cor tem a mesma origem, por isso o cuidado deve ser individualizado."],
    ["Café e o tom dos dentes", "Bebidas pigmentadas podem contribuir para manchas externas, especialmente com consumo frequente."],
    ["Natural também é bonito", "Estética dental busca harmonia com o rosto, sem exigir um padrão artificial de sorriso."],
    ["Lentes não são para todos", "A indicação depende da saúde bucal, estrutura dental e objetivo de cada pessoa."],
    ["Cuidados após o clareamento", "Higiene adequada e orientação profissional ajudam a conservar o resultado obtido."],
    ["Restaurações estéticas", "Materiais atuais podem recuperar forma e função mantendo uma aparência natural."],
    ["Contorno do sorriso", "Pequenos ajustes podem ser considerados somente após análise funcional e periodontal."],
    ["Sensibilidade no clareamento", "A sensibilidade pode ocorrer e deve ser acompanhada para ajustar o tratamento com segurança."],
    ["Seu sorriso, sua identidade", "Um plano estético responsável respeita traços pessoais, saúde e expectativas possíveis."],
  ].map(([title, message]) => ({ title, message, category: "aesthetics" as const, audience: ["adults", "young_adults"], specialties: ["aesthetic_dentistry", "general_dentistry"] })),
  ...[
    ["Alinhamento vai além da estética", "Dentes bem posicionados podem facilitar a higiene e contribuir para uma mordida equilibrada."],
    ["Aparelho precisa de higiene extra", "Bráquetes e fios criam áreas de retenção que pedem atenção especial na limpeza."],
    ["Alinhadores exigem disciplina", "O tempo de uso orientado e a higiene correta são essenciais para acompanhar o planejamento."],
    ["Contenção faz parte do tratamento", "Depois do alinhamento, a contenção ajuda a preservar a nova posição dos dentes."],
    ["Primeira avaliação ortodôntica", "Observar crescimento e mordida cedo pode ajudar no planejamento do momento adequado."],
    ["Aparelho e alimentação", "Evitar alimentos muito duros ou pegajosos reduz o risco de danos ao aparelho."],
    ["Mordida cruzada merece atenção", "Alterações na mordida devem ser avaliadas presencialmente para entender suas causas."],
    ["Manutenção ortodôntica em dia", "Consultas regulares permitem acompanhar movimentos e ajustar o plano com segurança."],
  ].map(([title, message]) => ({ title, message, category: "orthodontics" as const, audience: ["teens", "adults"], specialties: ["orthodontics"] })),
  ...[
    ["Implante precisa de manutenção", "Mesmo sem cárie, implantes precisam de higiene e acompanhamento dos tecidos ao redor."],
    ["Prótese bem cuidada dura melhor", "Limpeza diária e revisões ajudam a preservar conforto, função e adaptação."],
    ["Perder um dente muda o equilíbrio", "A ausência dental pode afetar mastigação e posição dos dentes vizinhos."],
    ["Osso e planejamento do implante", "Exames e avaliação clínica mostram as condições individuais para o tratamento."],
    ["Prótese móvel também exige revisão", "Mudanças na boca podem alterar a adaptação e causar pontos de desconforto."],
    ["Mastigar com confiança", "A reabilitação busca recuperar função com um planejamento compatível com cada caso."],
    ["Higiene sob a prótese", "Escovas e acessórios específicos ajudam a limpar regiões de difícil acesso."],
    ["Implante não substitui prevenção", "Cuidar da gengiva e manter consultas periódicas continua sendo indispensável."],
  ].map(([title, message]) => ({ title, message, category: "implants" as const, audience: ["adults", "seniors"], specialties: ["implant_dentistry", "prosthodontics"] })),
  ...[
    ["Primeiro dentinho, primeiros cuidados", "A higiene começa quando o primeiro dente aparece, com orientação adequada à idade."],
    ["Consulta infantil sem medo", "Visitas preventivas e acolhedoras ajudam a criança a construir uma relação positiva com o dentista."],
    ["Mamadeira durante a noite", "Líquidos açucarados em contato prolongado com os dentes aumentam o risco de cárie."],
    ["Dente de leite importa", "Ele participa da mastigação, fala e guarda espaço para o dente permanente."],
    ["Escovação com supervisão", "Crianças precisam de ajuda de um adulto até desenvolver coordenação suficiente."],
    ["Queda e trauma dental", "Em caso de acidente, procure orientação odontológica rapidamente e evite receitas caseiras."],
    ["Lancheira amiga do sorriso", "Água e alimentos menos açucarados ajudam a reduzir exposições frequentes ao açúcar."],
    ["Selante: proteção complementar", "Em casos indicados, o selante pode proteger sulcos profundos dos dentes posteriores."],
  ].map(([title, message]) => ({ title, message, category: "pediatric" as const, audience: ["parents", "children", "families"], specialties: ["pediatric_dentistry", "general_dentistry"] })),
  ...[
    ["Sangramento gengival é um sinal", "Sangrar com frequência durante a higiene merece avaliação; não é motivo para abandonar a limpeza."],
    ["Gengiva saudável não chama atenção", "Cor, firmeza e ausência de sangramento ajudam a indicar equilíbrio dos tecidos."],
    ["Tártaro não sai com escovação", "Depois de endurecido, o cálculo dental precisa de remoção profissional."],
    ["Saúde da gengiva e saúde geral", "Inflamações bucais persistentes merecem acompanhamento como parte do cuidado integral."],
    ["Retração gengival", "Sensibilidade e aparência de dente alongado podem estar relacionadas à retração e precisam de avaliação."],
    ["Limpeza entre dentes protege a gengiva", "Fio ou escovas interdentais removem biofilme onde a escova comum não alcança."],
  ].map(([title, message]) => ({ title, message, category: "periodontics" as const, audience: ["adults", "seniors"], specialties: ["periodontics", "general_dentistry"] })),
  ...[
    ["Dor de dente não deve esperar", "Dor persistente é um aviso para procurar avaliação; analgésico não trata a causa."],
    ["Sensibilidade ao gelado", "Desconforto frequente pode ter diferentes causas e merece investigação profissional."],
    ["Dente quebrado: o que fazer", "Guarde o fragmento, evite mastigar no local e procure atendimento o quanto antes."],
    ["Inchaço no rosto é urgência", "Inchaço associado a dor ou febre precisa de avaliação rápida, especialmente se estiver aumentando."],
    ["Mau hálito persistente", "Quando não melhora com higiene e hidratação, é importante investigar fatores bucais e gerais."],
    ["Afta recorrente", "Lesões que demoram a cicatrizar ou voltam com frequência devem ser examinadas."],
    ["Bruxismo deixa sinais", "Desgaste, tensão e dor ao acordar podem indicar sobrecarga, mas o diagnóstico é presencial."],
    ["Nunca coloque remédio no dente", "Substâncias sobre a gengiva podem causar queimaduras e atrasar o cuidado adequado."],
  ].map(([title, message]) => ({ title, message, category: "urgent_care" as const, audience: ["adults", "families"], specialties: ["general_dentistry", "emergency_dentistry"] })),
];

const goals: DailyPostGoal[] = [
  ...Array<DailyPostGoal>(24).fill("education"),
  ...Array<DailyPostGoal>(15).fill("problem_awareness"),
  ...Array<DailyPostGoal>(12).fill("authority"),
  ...Array<DailyPostGoal>(9).fill("conversion"),
];
const formats: DailyPostFormat[] = [
  ...Array<DailyPostFormat>(24).fill("single_card"),
  ...Array<DailyPostFormat>(18).fill("carousel"),
  ...Array<DailyPostFormat>(6).fill("qa"),
  ...Array<DailyPostFormat>(6).fill("myth_truth"),
  ...Array<DailyPostFormat>(6).fill("checklist"),
];
const palettes: Record<DailyPostCategory, string> = {
  prevention: "#18AFA5", aesthetics: "#7B6FF0", orthodontics: "#2F80ED",
  implants: "#536B7A", pediatric: "#F4A261", periodontics: "#E76F78", urgent_care: "#E45756",
};

const ctas = [
  ["Salve este conteúdo", "save"], ["Compartilhe com alguém", "share"],
  ["Cuide hoje da saúde do seu sorriso", "learn"], ["Envie sua dúvida", "contact"],
  ["Converse com nossa equipe", "contact"], ["Saiba mais", "learn"],
  ["Agende sua avaliação", "schedule"],
] as const;

export const DAILY_POST_TEMPLATES: SeedDailyPostTemplate[] = topics.map((topic, index) => {
  const editorialFormat = formats[index];
  const [ctaText, ctaType] = ctas[index % ctas.length];
  const slideCount = editorialFormat === "carousel" ? 4 + (index % 4) : 0;
  return {
    id: `sorvy-post-${String(index + 1).padStart(2, "0")}`,
    title: topic.title,
    hook: topic.title,
    shortText: topic.message,
    caption: `${topic.message}\n\nInformação geral não substitui uma avaliação odontológica individual. Cada sorriso precisa de um cuidado próprio.`,
    ctaText,
    ctaType,
    hashtags: ["#SaudeBucal", "#Odontologia", "#SorvySmile"],
    category: topic.category,
    communicationGoal: goals[index],
    targetAudienceTags: topic.audience,
    specialtyTags: topic.specialties,
    editorialFormat,
    feedLayoutKey: `feed-${editorialFormat}`,
    storyLayoutKey: `story-${editorialFormat}`,
    paletteKey: palettes[topic.category],
    imageStrategy: index % 3 === 0 ? "illustration" : "no_photo",
    defaultImageUrl: "",
    carouselSlides: Array.from({ length: slideCount }, (_, slideIndex) => ({
      title: slideIndex === 0 ? topic.title : slideIndex === slideCount - 1 ? ctaText : `Ponto ${slideIndex}`,
      text: slideIndex === 0 ? topic.message : slideIndex === slideCount - 1 ? "Procure orientação individual para cuidar do seu sorriso." : `${topic.message} Informação objetiva para uma decisão mais consciente.`,
    })),
    status: "published",
    isEvergreen: true,
    priority: 100 - index,
    availableFrom: null,
    availableUntil: null,
    version: 1,
  };
});

export function localDateKey(nowMs: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(nowMs));
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${read("year")}-${read("month")}-${read("day")}`;
  } catch {
    return localDateKey(nowMs, "America/Sao_Paulo");
  }
}

export function scoreDailyPostTemplate(template: SeedDailyPostTemplate, input: {
  specialties: string[];
  targetAudiences: string[];
  preferredCategories: string[];
}): number {
  const matches = (left: string[], right: string[]) => left.some((item) => right.includes(item));
  return template.priority
    + (matches(template.specialtyTags, input.specialties) ? 40 : 0)
    + (matches(template.targetAudienceTags, input.targetAudiences) ? 30 : 0)
    + (input.preferredCategories.includes(template.category) ? 20 : 0);
}

export function chooseDailyPostTemplate<T extends SeedDailyPostTemplate>(templates: T[], input: {
  specialties: string[];
  targetAudiences: string[];
  preferredCategories: string[];
  blockedCategories: string[];
  usedTemplateIds: string[];
  previousCategory?: string;
}): { template: T; reason: string } | null {
  const available = templates.filter((item) => !input.blockedCategories.includes(item.category));
  if (!available.length) return null;
  const unused = available.filter((item) => !input.usedTemplateIds.includes(item.id));
  const cycle = unused.length ? unused : available;
  const withoutPrevious = cycle.filter((item) => item.category !== input.previousCategory);
  const candidates = withoutPrevious.length ? withoutPrevious : cycle;
  const ranked = [...candidates].sort((a, b) => scoreDailyPostTemplate(b, input) - scoreDailyPostTemplate(a, input) || a.id.localeCompare(b.id));
  const template = ranked[0];
  const specific = template.specialtyTags.some((item) => input.specialties.includes(item));
  const audience = template.targetAudienceTags.some((item) => input.targetAudiences.includes(item));
  const preferred = input.preferredCategories.includes(template.category);
  return { template, reason: specific ? "specialty_match" : audience ? "audience_match" : preferred ? "preferred_category" : "evergreen_fallback" };
}
