export type EditorialCategory =
  | "prevention"
  | "aesthetics"
  | "orthodontics"
  | "implants"
  | "pediatric"
  | "periodontics"
  | "urgent_care";

export interface EditorialPoint {
  title: string;
  text: string;
}

export interface EditorialTopic {
  title: string;
  shortText: string;
  points: EditorialPoint[];
  ctaText: string;
  ctaType: "schedule" | "contact" | "learn" | "save" | "share";
  hashtags: string[];
  seoKeywords: string[];
  category: EditorialCategory;
  audience: string[];
  specialties: string[];
}

type TopicDraft = Omit<EditorialTopic, "category" | "audience" | "specialties">;

function group(
  category: EditorialCategory,
  audience: string[],
  specialties: string[],
  drafts: TopicDraft[],
): EditorialTopic[] {
  return drafts.map((draft) => ({ ...draft, category, audience, specialties }));
}

const prevention = group(
  "prevention",
  ["adults", "families", "seniors"],
  ["general_dentistry", "prevention"],
  [
    {
      title: "Escovar com força não limpa melhor",
      shortText: "Pressão excessiva pode machucar a gengiva e desgastar áreas do dente. O que remove a placa é a técnica: movimentos cuidadosos, escova macia e atenção à margem gengival.",
      points: [
        { title: "Prefira", text: "Escova de cerdas macias e cabeça compatível com a sua boca." },
        { title: "Observe", text: "Cerdas abrindo rápido podem indicar força além do necessário." },
        { title: "Complete", text: "Limpe entre os dentes todos os dias, onde a escova não alcança." },
      ],
      ctaText: "Salve para revisar sua técnica hoje",
      ctaType: "save",
      hashtags: ["#Escovacao", "#HigieneBucal", "#PrevencaoOdontologica", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["como escovar os dentes", "escova macia", "higiene bucal"],
    },
    {
      title: "O fio dental não é um detalhe",
      shortText: "A escova limpa muito bem as superfícies visíveis, mas não entra completamente entre os dentes. O fio ou a escova interdental completa a remoção diária do biofilme.",
      points: [
        { title: "Sem força", text: "Deslize suavemente para não ferir a gengiva." },
        { title: "Formato de C", text: "Abrace a lateral de cada dente e faça movimentos delicados." },
        { title: "Sangrou?", text: "Não abandone a higiene; sangramento frequente merece avaliação." },
      ],
      ctaText: "Compartilhe com quem sempre pula o fio dental",
      ctaType: "share",
      hashtags: ["#FioDental", "#GengivaSaudavel", "#HigieneBucal", "#Prevencao", "#Odontologia"],
      seoKeywords: ["como usar fio dental", "limpeza entre os dentes", "gengiva saudável"],
    },
    {
      title: "Flúor: proteção diária contra a cárie",
      shortText: "O creme dental fluoretado ajuda a tornar o esmalte mais resistente aos ácidos produzidos pela placa. Para funcionar, ele precisa fazer parte da rotina — não apenas quando surge sensibilidade.",
      points: [
        { title: "Duas vezes ao dia", text: "Mantenha uma escovação cuidadosa pela manhã e antes de dormir." },
        { title: "Sem exagero", text: "A quantidade deve ser adequada à idade e à orientação profissional." },
        { title: "Constância", text: "Proteção vem do hábito repetido, não de uma aplicação isolada." },
      ],
      ctaText: "Salve este lembrete de prevenção",
      ctaType: "save",
      hashtags: ["#Fluor", "#PrevencaoDaCarie", "#CremeDental", "#SaudeBucal", "#OdontologiaPreventiva"],
      seoKeywords: ["creme dental com flúor", "prevenção da cárie", "esmalte dental"],
    },
    {
      title: "A frequência do açúcar muda o risco",
      shortText: "Não é apenas a quantidade de açúcar que importa. Cada exposição alimenta as bactérias da placa e cria um novo período de acidez; beliscar o dia inteiro prolonga esse desafio para o esmalte.",
      points: [
        { title: "Repare", text: "Café adoçado, balas e goles frequentes também contam como exposições." },
        { title: "Organize", text: "Concentrar alimentos nas refeições reduz ataques repetidos." },
        { title: "Finalize", text: "Água e higiene adequada ajudam a retomar o cuidado." },
      ],
      ctaText: "Envie para alguém que vive beliscando",
      ctaType: "share",
      hashtags: ["#AcucarECaries", "#PrevencaoDaCarie", "#AlimentacaoESaude", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["açúcar e cárie", "frequência alimentar", "prevenção odontológica"],
    },
    {
      title: "Boca seca merece atenção",
      shortText: "A saliva ajuda a limpar a boca, neutralizar ácidos e proteger os dentes. Sensação persistente de secura pode estar ligada a medicamentos, hábitos ou condições de saúde e deve ser investigada.",
      points: [
        { title: "Sinais", text: "Ardência, dificuldade para engolir e lábios ressecados podem acompanhar." },
        { title: "Cuidado", text: "Hidrate-se e evite soluções caseiras irritantes." },
        { title: "Avaliação", text: "O dentista pode identificar riscos e orientar medidas individualizadas." },
      ],
      ctaText: "Percebe secura frequente? Converse com seu dentista",
      ctaType: "contact",
      hashtags: ["#BocaSeca", "#Xerostomia", "#Saliva", "#SaudeBucal", "#CuidadosComABoca"],
      seoKeywords: ["boca seca", "xerostomia", "falta de saliva"],
    },
    {
      title: "Enxaguante não substitui a limpeza",
      shortText: "O enxaguante pode ser indicado em situações específicas, mas não remove sozinho a placa aderida aos dentes. Escova e limpeza interdental continuam sendo a base da higiene.",
      points: [
        { title: "Função", text: "Cada fórmula tem indicação, concentração e tempo de uso próprios." },
        { title: "Atenção", text: "Ardência não significa maior eficiência." },
        { title: "Escolha", text: "Use apenas o produto e o período adequados para o seu caso." },
      ],
      ctaText: "Salve antes de escolher seu próximo enxaguante",
      ctaType: "save",
      hashtags: ["#EnxaguanteBucal", "#HigieneOral", "#SaudeBucal", "#Prevencao", "#DentistaExplica"],
      seoKeywords: ["enxaguante bucal", "higiene oral", "placa bacteriana"],
    },
    {
      title: "Seu vape também passa pela boca",
      shortText: "O aerossol do cigarro eletrônico não é apenas vapor de água. Nicotina e outras substâncias entram em contato com mucosa, gengiva e dentes, enquanto os efeitos de longo prazo ainda são estudados.",
      points: [
        { title: "Pode ocorrer", text: "Ressecamento, irritação e maior exposição a fatores de risco." },
        { title: "Informe", text: "Conte ao dentista sobre vape, tabaco e sachês de nicotina." },
        { title: "Apoio", text: "A consulta também pode ser um ponto de partida para buscar ajuda." },
      ],
      ctaText: "Compartilhe informação, não fumaça",
      ctaType: "share",
      hashtags: ["#VapeESaude", "#CigarroEletronico", "#SaudeBucal", "#Prevencao", "#Odontologia"],
      seoKeywords: ["vape e saúde bucal", "cigarro eletrônico", "nicotina e boca"],
    },
    {
      title: "Hálito persistente pede investigação",
      shortText: "Mau hálito recorrente não deve ser apenas mascarado. Saburra na língua, inflamação gengival, pouca saliva e outros fatores podem participar — e a causa precisa ser identificada.",
      points: [
        { title: "Comece", text: "Higienize dentes, espaços interdentais e língua com delicadeza." },
        { title: "Evite", text: "Usar balas e enxaguantes fortes como solução permanente." },
        { title: "Procure", text: "Avaliação quando o problema persiste mesmo com boa rotina." },
      ],
      ctaText: "Salve e procure a causa, não só um disfarce",
      ctaType: "save",
      hashtags: ["#MauHalito", "#Halitose", "#LimpezaDaLingua", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["mau hálito persistente", "halitose", "limpeza da língua"],
    },
    {
      title: "Ácidos também desgastam o esmalte",
      shortText: "Refrigerantes, energéticos, bebidas cítricas e refluxo podem manter a boca ácida. Com repetição, o esmalte perde minerais e pode ficar mais sensível, fino ou transparente.",
      points: [
        { title: "Reduza", text: "Frequência e tempo de contato com bebidas ácidas." },
        { title: "Não esfregue", text: "Evite escovar imediatamente após episódios de acidez intensa." },
        { title: "Investigue", text: "Sensibilidade e desgaste visível merecem avaliação." },
      ],
      ctaText: "Salve para proteger seu esmalte",
      ctaType: "save",
      hashtags: ["#ErosaoDental", "#EsmalteDental", "#Sensibilidade", "#SaudeBucal", "#Prevencao"],
      seoKeywords: ["erosão dental", "bebidas ácidas", "desgaste do esmalte"],
    },
    {
      title: "Consulta preventiva não tem calendário único",
      shortText: "O intervalo ideal entre consultas depende do risco de cárie, condição gengival, hábitos, tratamentos e saúde geral. Prevenção de verdade é acompanhamento planejado para cada pessoa.",
      points: [
        { title: "Baixo risco", text: "Pode exigir uma frequência diferente de quem tem doença ativa." },
        { title: "Mudanças", text: "Dor, sangramento ou lesão nova não devem esperar a próxima rotina." },
        { title: "Plano", text: "Combine com o profissional quando e por que retornar." },
      ],
      ctaText: "Descubra qual acompanhamento faz sentido para você",
      ctaType: "schedule",
      hashtags: ["#ConsultaOdontologica", "#CheckupDental", "#Prevencao", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["consulta preventiva", "check-up odontológico", "quando ir ao dentista"],
    },
    {
      title: "Saúde bucal acompanha a saúde geral",
      shortText: "Diabetes, gestação, medicamentos e envelhecimento podem mudar o risco de cárie, inflamação gengival e boca seca. Por isso, atualizar seu histórico de saúde faz parte da consulta odontológica.",
      points: [
        { title: "Conte", text: "Diagnósticos, medicamentos e mudanças recentes de saúde." },
        { title: "Integre", text: "O cuidado fica melhor quando profissionais compartilham informações relevantes." },
        { title: "Previna", text: "Acompanhamento individual ajuda a antecipar necessidades." },
      ],
      ctaText: "Compartilhe com quem cuida da família",
      ctaType: "share",
      hashtags: ["#SaudeIntegral", "#SaudeBucal", "#Prevencao", "#QualidadeDeVida", "#Odontologia"],
      seoKeywords: ["saúde bucal e saúde geral", "prevenção odontológica", "histórico de saúde"],
    },
    {
      title: "Trocar a escova é parte do cuidado",
      shortText: "Cerdas deformadas perdem eficiência e podem exigir mais pressão para limpar. A troca deve considerar o estado da escova, episódios de contaminação e a orientação do profissional.",
      points: [
        { title: "Observe", text: "Cerdas abertas, gastas ou com acúmulo de resíduos." },
        { title: "Guarde", text: "Em posição vertical, limpa e com ventilação." },
        { title: "Individualize", text: "Não compartilhe escovas nem encoste cabeças umas nas outras." },
      ],
      ctaText: "Confira agora como estão as suas cerdas",
      ctaType: "learn",
      hashtags: ["#EscovaDeDentes", "#HigieneBucal", "#Prevencao", "#SaudeBucal", "#RotinaSaudavel"],
      seoKeywords: ["quando trocar escova de dentes", "cerdas gastas", "higiene da escova"],
    },
  ],
);

const aesthetics = group(
  "aesthetics",
  ["adults", "young_adults"],
  ["aesthetic_dentistry", "general_dentistry"],
  [
    {
      title: "Clareamento não age em restaurações",
      shortText: "Géis clareadores atuam no dente natural. Resinas, coroas e facetas não mudam de cor da mesma forma — e isso precisa entrar no planejamento para evitar diferença de tons.",
      points: [
        { title: "Mapeie", text: "Quais dentes têm restaurações visíveis antes de começar." },
        { title: "Planeje", text: "A sequência correta pode incluir ajustes após estabilizar a cor." },
        { title: "Alinhe", text: "Expectativas realistas protegem naturalidade e harmonia." },
      ],
      ctaText: "Pensando em clarear? Comece pela avaliação",
      ctaType: "schedule",
      hashtags: ["#ClareamentoDental", "#EsteticaDental", "#RestauracaoEmResina", "#SorrisoNatural", "#Dentista"],
      seoKeywords: ["clareamento e restaurações", "clareamento dental", "cor dos dentes"],
    },
    {
      title: "Carvão clareia ou só desgasta?",
      shortText: "Produtos abrasivos podem remover manchas superficiais, mas isso não significa clarear o dente por dentro. O uso sem orientação pode aumentar desgaste e sensibilidade.",
      points: [
        { title: "Atenção", text: "Antes e depois de internet não mostram a saúde do esmalte." },
        { title: "Diferencie", text: "Remover mancha externa é diferente de clareamento dental." },
        { title: "Proteja", text: "Escolha produtos avaliados e orientação individual." },
      ],
      ctaText: "Salve antes de testar uma receita da internet",
      ctaType: "save",
      hashtags: ["#CarvaoAtivado", "#ClareamentoCaseiro", "#EsmalteDental", "#EsteticaResponsavel", "#SaudeBucal"],
      seoKeywords: ["carvão clareia os dentes", "clareamento caseiro", "desgaste do esmalte"],
    },
    {
      title: "Lentes de contato não são ponto de partida",
      shortText: "Facetas podem ser uma opção em casos bem indicados, mas o plano começa avaliando gengiva, mordida, esmalte, restaurações e alternativas mais conservadoras.",
      points: [
        { title: "Primeiro", text: "Entender o que incomoda e qual função precisa ser preservada." },
        { title: "Depois", text: "Comparar possibilidades, limites e manutenção de cada técnica." },
        { title: "Sempre", text: "Buscar proporção natural, não um sorriso padronizado." },
      ],
      ctaText: "Converse sobre opções antes de decidir pelo procedimento",
      ctaType: "contact",
      hashtags: ["#FacetasDentarias", "#LentesDeContatoDental", "#EsteticaDental", "#SorrisoNatural", "#Odontologia"],
      seoKeywords: ["lentes de contato dental", "facetas dentárias", "planejamento estético"],
    },
    {
      title: "Dente branco não tem um único tom",
      shortText: "Cor natural varia entre pessoas e até entre regiões do mesmo dente. Um planejamento estético responsável considera pele, lábios, translucidez e características do sorriso.",
      points: [
        { title: "Naturalidade", text: "Nem sempre o tom mais claro é o mais harmônico." },
        { title: "Fotografia", text: "Luz e filtros alteram muito a percepção de cor." },
        { title: "Expectativa", text: "Referências ajudam, mas o resultado possível é individual." },
      ],
      ctaText: "Salve para lembrar: harmonia vem antes do filtro",
      ctaType: "save",
      hashtags: ["#SorrisoNatural", "#CorDosDentes", "#EsteticaDental", "#HarmoniaDoSorriso", "#Dentista"],
      seoKeywords: ["cor natural dos dentes", "tom do sorriso", "estética dental natural"],
    },
    {
      title: "Sensibilidade no clareamento tem manejo",
      shortText: "Algumas pessoas sentem sensibilidade temporária durante o clareamento. Intensidade, frequência e produto podem ser ajustados para manter o tratamento dentro de um plano seguro.",
      points: [
        { title: "Avise", text: "Desconforto não precisa ser suportado em silêncio." },
        { title: "Ajuste", text: "Tempo de uso e concentração dependem da resposta individual." },
        { title: "Não improvise", text: "Misturar produtos ou aumentar dose eleva o risco." },
      ],
      ctaText: "Tem sensibilidade? Fale com o profissional que acompanha você",
      ctaType: "contact",
      hashtags: ["#SensibilidadeDental", "#ClareamentoDental", "#EsteticaDental", "#CuidadoIndividual", "#Dentista"],
      seoKeywords: ["sensibilidade no clareamento", "clareamento dental seguro", "dentes sensíveis"],
    },
    {
      title: "Mancha branca também precisa de diagnóstico",
      shortText: "Áreas esbranquiçadas podem ter origens diferentes, como alteração de mineralização, início de lesão de cárie ou fluorose. O tratamento depende da causa, não apenas da aparência.",
      points: [
        { title: "Não cubra", text: "Antes de pensar em resina, é preciso entender a origem." },
        { title: "Compare", text: "Textura, localização e evolução ajudam na avaliação." },
        { title: "Trate", text: "Há opções conservadoras quando corretamente indicadas." },
      ],
      ctaText: "Notou uma mancha? Agende uma avaliação",
      ctaType: "schedule",
      hashtags: ["#ManchaBrancaNoDente", "#EsteticaDental", "#PrevencaoDaCarie", "#DiagnosticoOdontologico", "#SaudeBucal"],
      seoKeywords: ["mancha branca no dente", "fluorose", "cárie inicial"],
    },
    {
      title: "Resina estética também precisa de revisão",
      shortText: "Restaurações podem sofrer pigmentação, perda de brilho, lascas ou mudanças na margem. Revisões ajudam a decidir entre polimento, reparo ou troca — sem substituir tudo automaticamente.",
      points: [
        { title: "Preserve", text: "Reparos conservadores podem ser possíveis em situações selecionadas." },
        { title: "Cuide", text: "Higiene e hábitos influenciam a longevidade." },
        { title: "Avalie", text: "Desconforto, infiltração ou fratura pedem análise clínica." },
      ],
      ctaText: "Salve este checklist para sua próxima revisão",
      ctaType: "save",
      hashtags: ["#ResinaComposta", "#RestauracaoEstetica", "#EsteticaDental", "#ManutencaoDoSorriso", "#Odontologia"],
      seoKeywords: ["manutenção de resina", "restauração estética", "polimento dental"],
    },
    {
      title: "Sorriso gengival tem mais de uma causa",
      shortText: "Aparecer mais gengiva ao sorrir pode estar relacionado a lábio, osso, posição dentária ou tamanho clínico dos dentes. Por isso, a solução não é igual para todo mundo.",
      points: [
        { title: "Diagnóstico", text: "Define qual estrutura participa mais do sorriso." },
        { title: "Equipe", text: "Alguns casos pedem avaliação integrada de especialidades." },
        { title: "Limites", text: "Cada abordagem tem indicações e manutenção próprias." },
      ],
      ctaText: "Entenda a causa antes de escolher o tratamento",
      ctaType: "learn",
      hashtags: ["#SorrisoGengival", "#HarmoniaDoSorriso", "#EsteticaDental", "#Periodontia", "#Dentista"],
      seoKeywords: ["sorriso gengival", "excesso de gengiva", "harmonia do sorriso"],
    },
    {
      title: "Clareamento antes do evento: planeje",
      shortText: "Começar na véspera aumenta a chance de frustração e uso inadequado. Avaliação, tempo de resposta, possível sensibilidade e estabilização da cor precisam entrar no calendário.",
      points: [
        { title: "Antecipe", text: "Reserve tempo para avaliação e ajustes." },
        { title: "Não acelere", text: "Mais produto ou mais horas não significam melhor resultado." },
        { title: "Finalize", text: "Restaurações visíveis podem exigir planejamento posterior." },
      ],
      ctaText: "Tem uma data especial? Planeje com antecedência",
      ctaType: "schedule",
      hashtags: ["#ClareamentoDental", "#Noivas", "#PlanejamentoEstetico", "#Sorriso", "#Dentista"],
      seoKeywords: ["clareamento antes do casamento", "quanto tempo clareamento", "planejamento estético"],
    },
    {
      title: "Filtro não é referência clínica",
      shortText: "Filtros alteram cor, proporção, textura e até o contorno dos dentes. Levar uma imagem como inspiração pode ajudar na conversa, mas o plano deve respeitar anatomia, função e saúde.",
      points: [
        { title: "Converse", text: "Explique o que você gosta na referência." },
        { title: "Compare", text: "Entenda o que é edição e o que é possível clinicamente." },
        { title: "Decida", text: "Priorize soluções proporcionais ao seu sorriso." },
      ],
      ctaText: "Compartilhe com quem vive salvando sorrisos de filtro",
      ctaType: "share",
      hashtags: ["#FiltroDeSorriso", "#EsteticaDental", "#SorrisoNatural", "#ExpectativaReal", "#Odontologia"],
      seoKeywords: ["filtro de sorriso", "estética dental", "sorriso natural"],
    },
  ],
);

const orthodontics = group(
  "orthodontics",
  ["teens", "adults", "parents"],
  ["orthodontics"],
  [
    {
      title: "Alinhador transparente precisa de supervisão",
      shortText: "Mover dentes exige diagnóstico de gengiva, osso, raízes e mordida. A placa transparente é apenas a ferramenta; o tratamento depende de planejamento e acompanhamento profissional.",
      points: [
        { title: "Antes", text: "Exame clínico e registros mostram se os dentes podem ser movimentados." },
        { title: "Durante", text: "Revisões conferem adaptação, higiene e resposta biológica." },
        { title: "Depois", text: "Contenção ajuda a manter o resultado planejado." },
      ],
      ctaText: "Quer usar alinhadores? Comece pelo diagnóstico",
      ctaType: "schedule",
      hashtags: ["#AlinhadoresTransparentes", "#Ortodontia", "#AparelhoInvisivel", "#Mordida", "#Dentista"],
      seoKeywords: ["alinhador transparente", "aparelho invisível", "tratamento ortodôntico"],
    },
    {
      title: "Contenção não é fase opcional",
      shortText: "Depois que os dentes se movimentam, fibras e tecidos precisam se reorganizar. A contenção reduz a tendência de retorno e faz parte do tratamento ortodôntico.",
      points: [
        { title: "Use", text: "Pelo tempo e frequência definidos pelo ortodontista." },
        { title: "Cuide", text: "Higienize sem água quente e guarde no estojo." },
        { title: "Avise", text: "Se quebrar, perder ou deixar de encaixar." },
      ],
      ctaText: "Marque quem precisa reencontrar a contenção",
      ctaType: "share",
      hashtags: ["#ContencaoOrtodôntica", "#Ortodontia", "#AparelhoDental", "#SorrisoAlinhado", "#Dentista"],
      seoKeywords: ["contenção ortodôntica", "dentes voltando", "pós aparelho"],
    },
    {
      title: "Aparelho fixo muda a rotina de higiene",
      shortText: "Bráquetes, fios e acessórios criam novos pontos de retenção de placa. Limpeza detalhada evita manchas, inflamação gengival e interrupções no tratamento.",
      points: [
        { title: "Contorne", text: "Incline a escova acima e abaixo dos bráquetes." },
        { title: "Complete", text: "Use passa-fio ou escova interdental conforme orientação." },
        { title: "Revise", text: "Sangramento e áreas opacas merecem atenção precoce." },
      ],
      ctaText: "Salve este guia para a próxima escovação",
      ctaType: "save",
      hashtags: ["#AparelhoFixo", "#HigieneOrtodontica", "#Ortodontia", "#GengivaSaudavel", "#SaudeBucal"],
      seoKeywords: ["como limpar aparelho fixo", "higiene ortodôntica", "bráquetes"],
    },
    {
      title: "Mordida alinhada vai além da foto",
      shortText: "Ortodontia não busca apenas dentes retos na frente. Encaixe, função, estabilidade e condição dos tecidos precisam ser considerados para um resultado responsável.",
      points: [
        { title: "Função", text: "A mordida distribui forças durante mastigação e fala." },
        { title: "Saúde", text: "Gengiva e osso devem acompanhar a movimentação." },
        { title: "Estética", text: "Harmonia é planejada junto com os limites biológicos." },
      ],
      ctaText: "Entenda o que seu planejamento ortodôntico avalia",
      ctaType: "learn",
      hashtags: ["#Mordida", "#Ortodontia", "#Oclusao", "#SorrisoSaudavel", "#Dentista"],
      seoKeywords: ["mordida correta", "ortodontia", "dentes alinhados"],
    },
    {
      title: "Alinhador fora da boca não movimenta",
      shortText: "O resultado depende do tempo diário de uso indicado. Tirar por longos períodos, pular placas ou avançar sem adaptação pode comprometer o planejamento.",
      points: [
        { title: "Rotina", text: "Associe retirada a refeições e higiene." },
        { title: "Estojo", text: "Nunca envolva o alinhador em guardanapo." },
        { title: "Contato", text: "Se não encaixar, não force a próxima etapa." },
      ],
      ctaText: "Salve para manter a disciplina do tratamento",
      ctaType: "save",
      hashtags: ["#AlinhadorDental", "#Ortodontia", "#AparelhoTransparente", "#RotinaOrtodontica", "#Dentista"],
      seoKeywords: ["tempo de uso do alinhador", "alinhador não encaixa", "aparelho transparente"],
    },
    {
      title: "Bráquete soltou: e agora?",
      shortText: "Nem todo bráquete solto é urgência imediata, mas a equipe precisa ser avisada. Peças móveis podem machucar e o dente pode deixar de receber a força planejada.",
      points: [
        { title: "Não cole", text: "Adesivos domésticos podem causar dano e dificultar o reparo." },
        { title: "Proteja", text: "Cera ortodôntica pode aliviar atrito temporariamente." },
        { title: "Oriente-se", text: "Envie uma mensagem e siga a conduta da equipe." },
      ],
      ctaText: "Compartilhe com quem usa aparelho",
      ctaType: "share",
      hashtags: ["#BraqueteSolto", "#AparelhoFixo", "#Ortodontia", "#UrgenciaOrtodôntica", "#Dentista"],
      seoKeywords: ["bráquete soltou", "urgência ortodôntica", "aparelho quebrado"],
    },
    {
      title: "Ortodontia infantil é avaliação de crescimento",
      shortText: "A consulta na infância observa erupção, respiração, hábitos e desenvolvimento da mordida. Avaliar cedo não significa colocar aparelho imediatamente.",
      points: [
        { title: "Objetivo", text: "Reconhecer alterações no momento em que ainda estão se desenvolvendo." },
        { title: "Conduta", text: "Alguns casos só precisam de acompanhamento." },
        { title: "Tempo", text: "Quando há indicação, o momento certo pode simplificar etapas." },
      ],
      ctaText: "Seu filho já teve a mordida avaliada?",
      ctaType: "schedule",
      hashtags: ["#OrtodontiaInfantil", "#MordidaInfantil", "#Odontopediatria", "#CrescimentoFacial", "#Dentista"],
      seoKeywords: ["primeira avaliação ortodôntica", "mordida infantil", "aparelho em criança"],
    },
    {
      title: "Alinhador também precisa de higiene",
      shortText: "Biofilme e pigmentos se acumulam no alinhador e ficam horas em contato com os dentes. Limpeza adequada protege transparência, odor e saúde bucal.",
      points: [
        { title: "Enxágue", text: "Sempre que retirar e antes de recolocar." },
        { title: "Limpe", text: "Use o método recomendado, sem água quente." },
        { title: "Escove", text: "Nunca recoloque sobre dentes sem higiene após refeições." },
      ],
      ctaText: "Salve esta rotina de três passos",
      ctaType: "save",
      hashtags: ["#HigieneDoAlinhador", "#AlinhadorTransparente", "#Ortodontia", "#SaudeBucal", "#AparelhoInvisivel"],
      seoKeywords: ["como limpar alinhador", "higiene do aparelho invisível", "alinhador transparente"],
    },
  ],
);

const implants = group(
  "implants",
  ["adults", "seniors"],
  ["implant_dentistry", "prosthodontics"],
  [
    {
      title: "Implante não tem cárie, mas pode inflamar",
      shortText: "A coroa sobre o implante não desenvolve cárie, porém placa pode inflamar gengiva e osso ao redor. Higiene e manutenção continuam indispensáveis.",
      points: [
        { title: "Limpe", text: "A região de encontro entre prótese e gengiva todos os dias." },
        { title: "Observe", text: "Sangramento, inchaço, gosto ruim ou mobilidade." },
        { title: "Revise", text: "Consultas acompanham tecido, encaixe e distribuição de força." },
      ],
      ctaText: "Salve para cuidar do implante a longo prazo",
      ctaType: "save",
      hashtags: ["#ImplanteDentario", "#PeriImplantite", "#ProteseDentaria", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["implante dentário inflamado", "limpeza do implante", "peri-implantite"],
    },
    {
      title: "Perder um dente muda mais que o sorriso",
      shortText: "A ausência pode alterar mastigação, fala, posição dos dentes vizinhos e carga sobre outras regiões. Reabilitar é recuperar função dentro das condições de cada pessoa.",
      points: [
        { title: "Avalie", text: "Quantidade de dentes, mordida, gengiva e osso disponível." },
        { title: "Compare", text: "Implante, ponte e prótese removível têm indicações diferentes." },
        { title: "Planeje", text: "A melhor opção equilibra saúde, expectativa e manutenção." },
      ],
      ctaText: "Conheça as opções para o seu caso",
      ctaType: "schedule",
      hashtags: ["#DentePerdido", "#ImplanteDentario", "#ProteseDentaria", "#ReabilitacaoOral", "#Odontologia"],
      seoKeywords: ["perdi um dente", "opções para substituir dente", "reabilitação oral"],
    },
    {
      title: "Planejamento do implante começa antes da cirurgia",
      shortText: "Exame clínico, imagens, saúde gengival, volume ósseo, medicamentos e hábitos ajudam a definir viabilidade, sequência e riscos do tratamento.",
      points: [
        { title: "Histórico", text: "Condições de saúde e medicações devem ser informadas." },
        { title: "Estrutura", text: "Osso e gengiva são avaliados para sustentar a reabilitação." },
        { title: "Prótese", text: "A posição final do dente orienta o planejamento do implante." },
      ],
      ctaText: "Agende uma avaliação completa, não apenas um orçamento",
      ctaType: "schedule",
      hashtags: ["#PlanejamentoDeImplante", "#Implantodontia", "#ReabilitacaoOral", "#ProteseSobreImplante", "#Dentista"],
      seoKeywords: ["planejamento de implante", "exames para implante", "implante dentário"],
    },
    {
      title: "Carga imediata não serve para todo caso",
      shortText: "Colocar um dente provisório logo após o implante depende de estabilidade, osso, posição, mordida e controle de forças. A decisão é clínica, não apenas uma preferência de prazo.",
      points: [
        { title: "Possibilidade", text: "É avaliada durante o planejamento e confirmada no procedimento." },
        { title: "Provisório", text: "Não significa que a integração do implante já terminou." },
        { title: "Proteção", text: "Restrições de mastigação podem ser necessárias." },
      ],
      ctaText: "Entenda se a carga imediata é indicada para você",
      ctaType: "learn",
      hashtags: ["#CargaImediata", "#ImplanteDentario", "#Implantodontia", "#DenteProvisorio", "#Odontologia"],
      seoKeywords: ["implante com carga imediata", "dente no mesmo dia", "implante dentário"],
    },
    {
      title: "Prótese protocolo exige limpeza por baixo",
      shortText: "Mesmo fixa, a prótese acumula resíduos na área próxima à gengiva. Acessórios corretos e técnica diária ajudam a prevenir inflamação e mau odor.",
      points: [
        { title: "Acesso", text: "Passa-fio, escova interdental ou irrigador podem ser indicados." },
        { title: "Técnica", text: "O movimento deve alcançar toda a extensão sob a prótese." },
        { title: "Manutenção", text: "A equipe confere parafusos, adaptação e tecidos." },
      ],
      ctaText: "Salve e peça uma demonstração na próxima consulta",
      ctaType: "save",
      hashtags: ["#ProteseProtocolo", "#ImplanteDentario", "#HigieneDoImplante", "#ReabilitacaoOral", "#SaudeBucal"],
      seoKeywords: ["como limpar prótese protocolo", "higiene sobre implante", "prótese fixa"],
    },
    {
      title: "Gengiva sangrando ao redor do implante",
      shortText: "Sangramento frequente pode ser um sinal inicial de inflamação peri-implantar. Como alterações podem avançar com pouca dor, observar e agir cedo faz diferença.",
      points: [
        { title: "Não ignore", text: "Ausência de dor não significa ausência de problema." },
        { title: "Não suspenda", text: "A higiene deve continuar com delicadeza." },
        { title: "Avalie", text: "O profissional investiga placa, desenho da prótese e suporte ósseo." },
      ],
      ctaText: "Percebeu sangramento? Marque uma revisão",
      ctaType: "schedule",
      hashtags: ["#GengivaSangrando", "#ImplanteDentario", "#MucositePeriImplantar", "#PeriImplantite", "#Dentista"],
      seoKeywords: ["sangramento no implante", "gengiva do implante", "inflamação peri-implantar"],
    },
    {
      title: "Diabetes e implante pedem cuidado integrado",
      shortText: "Controle glicêmico, condição gengival, cicatrização e manutenção entram na avaliação. Ter diabetes não define sozinho o tratamento, mas exige planejamento individual.",
      points: [
        { title: "Informe", text: "Exames, medicamentos e acompanhamento médico atual." },
        { title: "Controle", text: "Saúde periodontal deve estar acompanhada." },
        { title: "Mantenha", text: "Retornos e higiene são parte do sucesso a longo prazo." },
      ],
      ctaText: "Converse com sua equipe de saúde antes de decidir",
      ctaType: "contact",
      hashtags: ["#DiabetesESaudeBucal", "#ImplanteDentario", "#SaudeIntegral", "#Periodontia", "#Odontologia"],
      seoKeywords: ["diabetes e implante", "implante dentário em diabético", "cicatrização oral"],
    },
    {
      title: "Dentadura machucando não deve ser normalizada",
      shortText: "Com o tempo, gengiva e osso mudam e a prótese pode perder adaptação. Feridas, dificuldade para mastigar ou necessidade constante de adesivo merecem revisão.",
      points: [
        { title: "Não ajuste", text: "Desgastar a prótese em casa pode piorar apoio e estabilidade." },
        { title: "Observe", text: "Feridas que não cicatrizam precisam ser examinadas." },
        { title: "Revise", text: "Reembasamento ou nova prótese dependem da condição clínica." },
      ],
      ctaText: "Conforto para mastigar começa com uma boa adaptação",
      ctaType: "schedule",
      hashtags: ["#Dentadura", "#ProteseTotal", "#ProteseDentaria", "#SaudeDoIdoso", "#Dentista"],
      seoKeywords: ["dentadura machucando", "prótese solta", "ajuste de dentadura"],
    },
  ],
);

const pediatric = group(
  "pediatric",
  ["parents", "children", "families"],
  ["pediatric_dentistry", "general_dentistry"],
  [
    {
      title: "Primeiro dente, primeiro cuidado",
      shortText: "A higiene começa assim que o primeiro dente aparece. Uma pequena quantidade de creme dental fluoretado e ajuda de um adulto constroem proteção desde cedo.",
      points: [
        { title: "Quantidade", text: "Para menores de 3 anos, use porção semelhante a um grão de arroz." },
        { title: "Supervisão", text: "O adulto aplica o creme e realiza a escovação." },
        { title: "Rotina", text: "Duas vezes ao dia, com atenção especial antes de dormir." },
      ],
      ctaText: "Envie para quem está vivendo os primeiros dentinhos",
      ctaType: "share",
      hashtags: ["#PrimeiroDentinho", "#Odontopediatria", "#BebeSaudavel", "#HigieneInfantil", "#SaudeBucal"],
      seoKeywords: ["como escovar dente de bebê", "primeiro dentinho", "creme dental infantil"],
    },
    {
      title: "Dente de leite tem trabalho importante",
      shortText: "Ele participa da mastigação, fala, estética e manutenção de espaço para o permanente. Cárie e trauma em dente de leite precisam de avaliação, mesmo que ele vá cair no futuro.",
      points: [
        { title: "Função", text: "Ajuda a criança a comer e falar durante anos importantes." },
        { title: "Espaço", text: "Guia o nascimento do dente permanente." },
        { title: "Saúde", text: "Infecção pode causar dor e afetar qualidade de vida." },
      ],
      ctaText: "Compartilhe: dente de leite também merece cuidado",
      ctaType: "share",
      hashtags: ["#DenteDeLeite", "#Odontopediatria", "#SaudeInfantil", "#PrevencaoDaCarie", "#Dentista"],
      seoKeywords: ["importância do dente de leite", "cárie infantil", "odontopediatra"],
    },
    {
      title: "Mamadeira noturna prolonga o contato com açúcar",
      shortText: "Dormir mamando líquidos açucarados deixa os dentes expostos por mais tempo, justamente quando o fluxo de saliva diminui. Isso aumenta o risco de cárie precoce.",
      points: [
        { title: "Atenção", text: "Leite com açúcar, achocolatado, suco e fórmulas também contam." },
        { title: "Higiene", text: "Escove após a última alimentação sempre que houver dentes." },
        { title: "Transição", text: "Converse com pediatra e dentista sobre a rotina da família." },
      ],
      ctaText: "Salve para organizar a rotina antes de dormir",
      ctaType: "save",
      hashtags: ["#MamadeiraNoturna", "#CarieNaInfancia", "#Odontopediatria", "#BebeSaudavel", "#SaudeBucal"],
      seoKeywords: ["mamadeira causa cárie", "cárie de mamadeira", "higiene do bebê"],
    },
    {
      title: "Trauma no dente: o tempo importa",
      shortText: "Quedas são comuns na infância, mas a conduta muda entre dente de leite e permanente. Avaliação rápida ajuda a proteger o dente e acompanhar possíveis efeitos futuros.",
      points: [
        { title: "Dente de leite", text: "Não tente recolocar no lugar por conta própria." },
        { title: "Dente permanente", text: "Se sair inteiro, segure pela coroa, nunca pela raiz." },
        { title: "Contato", text: "Ligue para o dentista imediatamente para orientação." },
      ],
      ctaText: "Salve este guia para uma emergência",
      ctaType: "save",
      hashtags: ["#TraumaDental", "#DenteQuebrado", "#Odontopediatria", "#PrimeirosSocorros", "#UrgenciaOdontologica"],
      seoKeywords: ["trauma dental infantil", "dente caiu", "dente de leite machucado"],
    },
    {
      title: "Medo de dentista também aprende com os adultos",
      shortText: "A forma como a família fala da consulta influencia a expectativa da criança. Acolhimento, previsibilidade e palavras neutras ajudam a construir confiança.",
      points: [
        { title: "Evite", text: "Ameaças, histórias assustadoras e prometer que nada será sentido." },
        { title: "Prefira", text: "Explique que o dentista vai contar, olhar e cuidar dos dentes." },
        { title: "Valorize", text: "Elogie cooperação, não apenas ausência de choro." },
      ],
      ctaText: "Compartilhe com pais e cuidadores",
      ctaType: "share",
      hashtags: ["#MedoDeDentista", "#Odontopediatria", "#ConsultaInfantil", "#Parentalidade", "#SaudeInfantil"],
      seoKeywords: ["criança com medo de dentista", "primeira consulta infantil", "odontopediatria"],
    },
    {
      title: "Chupeta e dedo: quando observar a mordida",
      shortText: "Frequência, intensidade e duração do hábito influenciam seu efeito. A avaliação considera idade, respiração, fala e desenvolvimento antes de orientar a retirada.",
      points: [
        { title: "Sem culpa", text: "A retirada funciona melhor com estratégia gradual e apoio." },
        { title: "Observe", text: "Mordida aberta, fala alterada ou respiração pela boca." },
        { title: "Integre", text: "Odontopediatra e outros profissionais podem trabalhar em conjunto." },
      ],
      ctaText: "Tem dúvida sobre o hábito? Converse com o odontopediatra",
      ctaType: "contact",
      hashtags: ["#Chupeta", "#ChuparODedo", "#MordidaAberta", "#Odontopediatria", "#DesenvolvimentoInfantil"],
      seoKeywords: ["chupeta e mordida", "chupar dedo", "mordida aberta infantil"],
    },
    {
      title: "Selante protege onde a escova tem dificuldade",
      shortText: "Sulcos profundos dos dentes posteriores podem reter placa. Quando indicado, o selante cria uma barreira física complementar — sem substituir escovação e flúor.",
      points: [
        { title: "Indicação", text: "Depende da anatomia do dente e do risco de cárie." },
        { title: "Aplicação", text: "É feita sobre uma superfície limpa e preparada." },
        { title: "Revisão", text: "O material precisa ser conferido nas consultas." },
      ],
      ctaText: "Pergunte se o selante faz sentido para seu filho",
      ctaType: "learn",
      hashtags: ["#SelanteDental", "#PrevencaoDaCarie", "#Odontopediatria", "#DentePermanente", "#SaudeBucal"],
      seoKeywords: ["selante dental infantil", "prevenção da cárie", "dentes molares"],
    },
    {
      title: "Lancheira também influencia o sorriso",
      shortText: "Alimentos açucarados e pegajosos consumidos várias vezes mantêm exposições frequentes. Uma lancheira equilibrada combina praticidade, água e menor dependência de ultraprocessados.",
      points: [
        { title: "Bebida", text: "Água costuma ser a melhor companhia do lanche." },
        { title: "Frequência", text: "Evite beliscos açucarados durante toda a aula." },
        { title: "Rotina", text: "A higiene diária continua indispensável." },
      ],
      ctaText: "Salve antes de montar a próxima lancheira",
      ctaType: "save",
      hashtags: ["#LancheiraSaudavel", "#SaudeBucalInfantil", "#PrevencaoDaCarie", "#Odontopediatria", "#VoltaAsAulas"],
      seoKeywords: ["lancheira e cárie", "alimentação infantil", "saúde bucal na escola"],
    },
  ],
);

const periodontics = group(
  "periodontics",
  ["adults", "seniors"],
  ["periodontics", "general_dentistry"],
  [
    {
      title: "Gengiva sangrando não é normal",
      shortText: "Sangramento frequente ao escovar ou usar fio dental costuma indicar inflamação. Parar de limpar favorece o acúmulo de placa; o correto é manter cuidado gentil e buscar avaliação.",
      points: [
        { title: "Observe", text: "Frequência, local, inchaço e presença de mau hálito." },
        { title: "Continue", text: "Higiene cuidadosa, sem força excessiva." },
        { title: "Investigue", text: "O dentista avalia placa, tártaro e suporte dos dentes." },
      ],
      ctaText: "Se sua gengiva sangra, agende uma avaliação",
      ctaType: "schedule",
      hashtags: ["#GengivaSangrando", "#Gengivite", "#Periodontia", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["gengiva sangrando", "gengivite", "inflamação gengival"],
    },
    {
      title: "Diabetes e gengiva se influenciam",
      shortText: "Diabetes está associado a maior risco de doença periodontal, e inflamação gengival merece acompanhamento integrado. Controle de saúde, higiene e tratamento profissional caminham juntos.",
      points: [
        { title: "Informe", text: "Diagnóstico, medicamentos e exames recentes." },
        { title: "Observe", text: "Sangramento, inchaço, mobilidade e boca seca." },
        { title: "Integre", text: "A comunicação entre dentista e equipe médica melhora o cuidado." },
      ],
      ctaText: "Compartilhe com quem convive com diabetes",
      ctaType: "share",
      hashtags: ["#DiabetesESaudeBucal", "#DoencaPeriodontal", "#GengivaSaudavel", "#SaudeIntegral", "#Periodontia"],
      seoKeywords: ["diabetes e gengiva", "doença periodontal", "saúde bucal do diabético"],
    },
    {
      title: "Tártaro não sai com mais força na escova",
      shortText: "Quando a placa mineraliza, forma cálculo dental aderido à superfície. Escovar com força não o remove e ainda pode traumatizar a gengiva.",
      points: [
        { title: "Remoção", text: "É feita profissionalmente com instrumentos adequados." },
        { title: "Prevenção", text: "Higiene diária reduz novo acúmulo de placa." },
        { title: "Manutenção", text: "A frequência de retorno depende do risco individual." },
      ],
      ctaText: "Notou tártaro? Procure uma avaliação",
      ctaType: "schedule",
      hashtags: ["#Tartaro", "#CalculoDental", "#LimpezaDental", "#Periodontia", "#SaudeBucal"],
      seoKeywords: ["como remover tártaro", "cálculo dental", "limpeza profissional"],
    },
    {
      title: "Fio dental não cria espaço entre dentes",
      shortText: "Usado corretamente, o fio remove placa de uma região que já existe. A sensação de espaço pode aparecer quando inchaço gengival diminui ou quando havia resíduos acumulados.",
      points: [
        { title: "Técnica", text: "Abrace cada dente sem cortar a papila." },
        { title: "Frequência", text: "Faça parte da rotina diária, não só antes da consulta." },
        { title: "Avaliação", text: "Espaços novos ou mobilidade precisam ser examinados." },
      ],
      ctaText: "Compartilhe este mito com quem evita o fio dental",
      ctaType: "share",
      hashtags: ["#FioDental", "#MitoOdontologico", "#GengivaSaudavel", "#Periodontia", "#HigieneBucal"],
      seoKeywords: ["fio dental abre espaço", "como passar fio dental", "saúde da gengiva"],
    },
    {
      title: "Retração gengival tem causas diferentes",
      shortText: "Gengiva retraída pode estar associada a escovação traumática, posição dentária, inflamação, tecido fino ou sobrecarga. Cobrir a raiz sem identificar a causa limita o resultado.",
      points: [
        { title: "Sinais", text: "Dente mais longo, sensibilidade ou mudança no contorno." },
        { title: "Diagnóstico", text: "Mede a retração e avalia os fatores envolvidos." },
        { title: "Plano", text: "Pode incluir mudança de hábito, controle de inflamação ou cirurgia." },
      ],
      ctaText: "Percebeu a raiz exposta? Agende uma avaliação",
      ctaType: "schedule",
      hashtags: ["#RetracaoGengival", "#RaizExposta", "#SensibilidadeDental", "#Periodontia", "#Dentista"],
      seoKeywords: ["retração gengival", "raiz do dente exposta", "sensibilidade na gengiva"],
    },
    {
      title: "Doença periodontal pode avançar em silêncio",
      shortText: "Perda de suporte ao redor dos dentes nem sempre provoca dor no início. Sangramento, mau hálito, retração e mobilidade são sinais que merecem atenção.",
      points: [
        { title: "Detecte", text: "Exame periodontal mede bolsas e condição do suporte." },
        { title: "Controle", text: "Tratamento remove fatores locais e reduz inflamação." },
        { title: "Mantenha", text: "Retornos periódicos ajudam a evitar progressão." },
      ],
      ctaText: "Salve os sinais e não espere sentir dor",
      ctaType: "save",
      hashtags: ["#DoencaPeriodontal", "#Periodontite", "#GengivaSaudavel", "#PerdaOssea", "#SaudeBucal"],
      seoKeywords: ["doença periodontal", "periodontite", "dente mole"],
    },
  ],
);

const urgentCare = group(
  "urgent_care",
  ["adults", "families", "parents"],
  ["general_dentistry", "emergency_dentistry"],
  [
    {
      title: "Rosto inchado e febre pedem atendimento rápido",
      shortText: "Inchaço que aumenta, febre, dificuldade para engolir ou respirar pode indicar infecção em progressão. Nesses casos, não espere a dor passar sozinha.",
      points: [
        { title: "Não faça", text: "Não fure, aperte ou coloque substâncias sobre a região." },
        { title: "Procure", text: "Atendimento odontológico ou serviço de urgência." },
        { title: "Emergência", text: "Dificuldade respiratória exige assistência imediata." },
      ],
      ctaText: "Compartilhe: reconhecer urgência protege vidas",
      ctaType: "share",
      hashtags: ["#InchacoNoRosto", "#InfeccaoDentaria", "#UrgenciaOdontologica", "#DorDeDente", "#Dentista"],
      seoKeywords: ["rosto inchado por dente", "infecção dentária", "urgência odontológica"],
    },
    {
      title: "Dente permanente caiu: saiba agir",
      shortText: "Quando um dente permanente sai inteiro após trauma, os primeiros minutos importam. Manuseio correto e atendimento imediato aumentam as possibilidades de cuidado.",
      points: [
        { title: "Segure", text: "Pela coroa, a parte branca; não toque na raiz." },
        { title: "Preserve", text: "Se sujo, enxágue brevemente sem esfregar e siga orientação profissional." },
        { title: "Corra", text: "Procure atendimento odontológico imediatamente." },
      ],
      ctaText: "Salve agora — emergência não avisa",
      ctaType: "save",
      hashtags: ["#DenteAvulsionado", "#TraumaDental", "#PrimeirosSocorros", "#UrgenciaOdontologica", "#Dentista"],
      seoKeywords: ["dente permanente caiu", "dente avulsionado", "trauma dental"],
    },
    {
      title: "Dente quebrado: preserve o fragmento",
      shortText: "Fraturas variam de pequenas lascas a exposição da parte interna do dente. Mesmo sem dor, a avaliação identifica profundidade e melhor forma de proteção.",
      points: [
        { title: "Guarde", text: "O fragmento limpo em recipiente adequado e leve à consulta." },
        { title: "Proteja", text: "Evite mastigar no local e extremos de temperatura." },
        { title: "Avalie", text: "Dor, sangramento ou mobilidade aumentam a urgência." },
      ],
      ctaText: "Compartilhe este passo a passo",
      ctaType: "share",
      hashtags: ["#DenteQuebrado", "#FraturaDental", "#TraumaDental", "#UrgenciaOdontologica", "#Odontologia"],
      seoKeywords: ["dente quebrado o que fazer", "fragmento dental", "fratura no dente"],
    },
    {
      title: "Ferida na boca há mais de duas semanas",
      shortText: "Aftas comuns tendem a melhorar, mas lesões que não cicatrizam, endurecem, sangram ou mudam de aparência precisam ser examinadas. Diagnóstico precoce faz parte da prevenção.",
      points: [
        { title: "Observe", text: "Tempo, tamanho, cor, dor e local da lesão." },
        { title: "Evite", text: "Automedicação contínua sem saber a causa." },
        { title: "Procure", text: "Dentista ou estomatologista para avaliação." },
      ],
      ctaText: "Salve o prazo: duas semanas merecem atenção",
      ctaType: "save",
      hashtags: ["#FeridaNaBoca", "#CancerBucal", "#Estomatologia", "#Prevencao", "#SaudeBucal"],
      seoKeywords: ["ferida na boca não cicatriza", "lesão bucal", "câncer de boca sinais"],
    },
    {
      title: "Analgésico pode aliviar, mas não trata a causa",
      shortText: "Dor de dente pode vir de cárie profunda, inflamação, trauma, gengiva ou outras condições. Repetir medicamento sem avaliação pode atrasar o tratamento necessário.",
      points: [
        { title: "Registre", text: "Quando começou, duração, gatilhos e intensidade." },
        { title: "Evite", text: "Colocar comprimido, álcool ou substâncias diretamente no dente." },
        { title: "Avalie", text: "Dor persistente, noturna ou acompanhada de inchaço." },
      ],
      ctaText: "Dor recorrente? Agende uma avaliação",
      ctaType: "schedule",
      hashtags: ["#DorDeDente", "#UrgenciaOdontologica", "#TratamentoDeCanal", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["dor de dente", "analgésico para dente", "urgência dental"],
    },
    {
      title: "Sensibilidade ou dor: a duração ajuda a diferenciar",
      shortText: "Um choque curto ao gelado pode ter causas diferentes de uma dor que permanece, pulsa ou surge sozinha. O padrão do sintoma orienta a investigação, mas não substitui o exame.",
      points: [
        { title: "Anote", text: "Frio, quente, doce, mastigação ou dor espontânea." },
        { title: "Cronometre", text: "Quanto tempo leva para desaparecer." },
        { title: "Procure", text: "Avaliação se piora, persiste ou limita alimentação." },
      ],
      ctaText: "Salve este guia para descrever sua dor com clareza",
      ctaType: "save",
      hashtags: ["#SensibilidadeDental", "#DorDeDente", "#DiagnosticoOdontologico", "#SaudeBucal", "#Dentista"],
      seoKeywords: ["sensibilidade ou dor de dente", "dor ao gelado", "dente pulsando"],
    },
    {
      title: "Siso inflamado não se resolve só com enxaguante",
      shortText: "Gengiva cobrindo parcialmente o siso pode acumular resíduos e inflamar. Dor, gosto ruim, limitação para abrir a boca ou inchaço precisam de avaliação.",
      points: [
        { title: "Higiene", text: "Mantenha limpeza delicada na região, sem objetos pontiagudos." },
        { title: "Não adie", text: "Episódios repetidos indicam necessidade de planejamento." },
        { title: "Urgência", text: "Febre ou inchaço crescente exige atendimento rápido." },
      ],
      ctaText: "Está com o siso incomodando? Procure avaliação",
      ctaType: "schedule",
      hashtags: ["#DenteDoSiso", "#Pericoronarite", "#DorNoSiso", "#UrgenciaOdontologica", "#Dentista"],
      seoKeywords: ["siso inflamado", "dor no siso", "gengiva do siso inchada"],
    },
    {
      title: "Acordar com a mandíbula cansada é um sinal",
      shortText: "Apertamento, bruxismo e tensão muscular podem causar dor ao acordar, desgaste, cefaleia ou sensação de travamento. A origem é multifatorial e precisa de avaliação.",
      points: [
        { title: "Observe", text: "Horário da dor, ruídos, limitação e hábitos de apertamento." },
        { title: "Evite", text: "Comprar placas genéricas sem diagnóstico." },
        { title: "Investigue", text: "Dentes, músculos, articulação, sono e contexto de saúde." },
      ],
      ctaText: "Salve os sinais e converse com seu dentista",
      ctaType: "contact",
      hashtags: ["#Bruxismo", "#DTM", "#DorNaMandibula", "#ApertamentoDental", "#Odontologia"],
      seoKeywords: ["dor na mandíbula ao acordar", "bruxismo", "apertamento dos dentes"],
    },
  ],
);

export const DAILY_POST_TOPICS: EditorialTopic[] = [
  ...prevention,
  ...aesthetics,
  ...orthodontics,
  ...implants,
  ...pediatric,
  ...periodontics,
  ...urgentCare,
];
