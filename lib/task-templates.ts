export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface TaskTemplate {
  type: string;
  label: string;
  defaultTitle: string;
  checklist: string[];
  extraFields?: ExtraFieldDef[];
}

export interface ExtraFieldDef {
  key: string;
  label: string;
  type: "number" | "text" | "slides";
}

export const TASK_TYPES = [
  "onboarding",
  "calendario_editorial",
  "captacao",
  "reels",
  "post_avulso",
  "carrossel",
  "criativo_trafego",
  "landing_page",
  "google_meu_negocio",
  "relatorio_mensal",
  "reuniao_cliente",
  "briefing",
  "tarefa_generica",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TEMPLATES: Record<TaskType, TaskTemplate> = {
  onboarding: {
    type: "onboarding",
    label: "Onboarding",
    defaultTitle: "Onboarding",
    checklist: [
      "Coletar dados para contrato",
      "Elaboração de contrato",
      "Envio para assinatura",
      "Contrato assinado",
      "Cadastro do cliente no sistema",
      "Cadastro no ASAAS",
      "Criar grupo WhatsApp",
      "Enviar e coletar Briefing",
      "Iniciar Planejamento Mensal",
    ],
  },
  calendario_editorial: {
    type: "calendario_editorial",
    label: "Calendário Editorial",
    defaultTitle: "Calendário Editorial",
    checklist: [
      "Análise de métricas do mês anterior",
      "Estudo de tendências do mês",
      "Criar planejamento.docx",
      "Enviar para aprovação do cliente",
      "Cliente aprovou",
      "Criar roteiros",
      "Agendar captação",
    ],
    extraFields: [
      { key: "qtd_reels", label: "Qtd Reels", type: "number" },
      { key: "qtd_carrosseis", label: "Qtd Carrosséis", type: "number" },
      { key: "qtd_posts_avulsos", label: "Qtd Posts Avulsos", type: "number" },
      { key: "qtd_criativos_trafego", label: "Qtd Criativos Tráfego", type: "number" },
    ],
  },
  captacao: {
    type: "captacao",
    label: "Captação",
    defaultTitle: "Captação",
    checklist: [
      "Carregar equipamentos",
      "Check: Câmera",
      "Check: Lente",
      "Check: Microfone",
      "Check: Tripé",
      "Check: Teleprompter",
      "Check: Cartão SD",
      "Check: Baterias",
      "Check: Luz",
      "Revisar roteiros do planejamento",
      "Captação concluída",
      "Subir arquivos no Drive",
      "Organizar em pastas",
      "Criar tarefas individuais com datas",
    ],
  },
  reels: {
    type: "reels",
    label: "Reels",
    defaultTitle: "Reels",
    checklist: [
      "Edição",
      "Subir no Drive",
      "Fazer capa",
      "Aprovação",
      "Programação",
    ],
  },
  post_avulso: {
    type: "post_avulso",
    label: "Post Avulso",
    defaultTitle: "Post Avulso",
    checklist: [
      "Criação da arte",
      "Subir no Drive",
      "Aprovação",
      "Programação",
    ],
  },
  carrossel: {
    type: "carrossel",
    label: "Carrossel",
    defaultTitle: "Carrossel",
    checklist: [
      "Criação das artes",
      "Subir no Drive",
      "Aprovação",
      "Programação",
    ],
    extraFields: [
      { key: "qtd_slides", label: "Qtd de Slides", type: "number" },
      { key: "ideias_slides", label: "Ideia por Slide", type: "slides" },
    ],
  },
  criativo_trafego: {
    type: "criativo_trafego",
    label: "Criativo de Tráfego",
    defaultTitle: "Criativo de Tráfego",
    checklist: [
      "Briefing do que precisa",
      "Criação",
      "Aprovação",
      "Subir no Gerenciador de Anúncios",
    ],
  },
  landing_page: {
    type: "landing_page",
    label: "Landing Page",
    defaultTitle: "Landing Page",
    checklist: [
      "Briefing",
      "Acesso ao domínio",
      "Criação",
      "Otimização multi-dispositivos",
      "Aprovação",
    ],
  },
  google_meu_negocio: {
    type: "google_meu_negocio",
    label: "Google Meu Negócio",
    defaultTitle: "Google Meu Negócio",
    checklist: [
      "Briefing",
      "Acesso à conta",
      "Fotos/Vídeos",
      "Configuração SEO",
      "Aprovação",
      "Avaliações",
    ],
  },
  relatorio_mensal: {
    type: "relatorio_mensal",
    label: "Relatório Mensal",
    defaultTitle: "Relatório Mensal",
    checklist: [
      "Coletar métricas redes sociais",
      "Coletar métricas tráfego pago",
      "Analisar resultados",
      "Montar relatório",
      "Enviar ao cliente",
    ],
  },
  reuniao_cliente: {
    type: "reuniao_cliente",
    label: "Reunião com Cliente",
    defaultTitle: "Reunião com Cliente",
    checklist: [
      "Preparar pauta",
      "Realizar reunião",
      "Registrar pontos principais",
      "Criar tarefas se necessário",
    ],
  },
  briefing: {
    type: "briefing",
    label: "Briefing",
    defaultTitle: "Briefing",
    checklist: [
      "Enviar formulário de perguntas",
      "Cliente respondeu",
      "Resumir e organizar",
      "Salvar no cadastro do cliente",
    ],
  },
  tarefa_generica: {
    type: "tarefa_generica",
    label: "Tarefa Genérica",
    defaultTitle: "Nova Tarefa",
    checklist: [],
  },
};

export function generateChecklist(items: string[]): ChecklistItem[] {
  return items.map((text, i) => ({
    id: `item-${i}-${Date.now()}`,
    text,
    checked: false,
  }));
}

export const STATUS_OPTIONS = [
  { value: "PENDING", label: "A Fazer", color: "bg-zinc-500/20 text-zinc-400" },
  { value: "IN_PROGRESS", label: "Em Progresso", color: "bg-blue-500/20 text-blue-400" },
  { value: "IN_REVIEW", label: "Aguardando Aprovação", color: "bg-purple-500/20 text-purple-400" },
  { value: "COMPLETED", label: "Concluída", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "CANCELLED", label: "Cancelada", color: "bg-red-500/20 text-red-400" },
];

export const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Baixa", color: "text-zinc-400" },
  { value: "MEDIUM", label: "Média", color: "text-amber-400" },
  { value: "HIGH", label: "Alta", color: "text-orange-500" },
  { value: "URGENT", label: "Urgente", color: "text-red-500" },
];
