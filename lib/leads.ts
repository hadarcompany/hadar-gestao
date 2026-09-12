/**
 * Etapas do funil comercial. A ordem deste array é a ordem das colunas do pipeline
 * e do funil de conversão na dashboard. FECHADO e PERDIDO encerram o lead: os dois
 * saem da contagem de "em aberto", mas só FECHADO conta como venda.
 */

export type LeadStage =
  | "NOVO"
  | "FOLLOW_UP"
  | "PROSPECCAO_ATIVA"
  | "REUNIAO_AGENDADA"
  | "PROPOSTA_ENVIADA"
  | "FECHADO"
  | "PERDIDO";

export const LEAD_STAGES: { value: LeadStage; label: string; color: string; dot: string }[] = [
  { value: "NOVO", label: "Novo", color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  { value: "FOLLOW_UP", label: "Follow up", color: "bg-blue-500/10 text-blue-600", dot: "bg-blue-500" },
  { value: "PROSPECCAO_ATIVA", label: "Prospecção ativa", color: "bg-purple-500/10 text-purple-600", dot: "bg-purple-500" },
  { value: "REUNIAO_AGENDADA", label: "Reunião agendada", color: "bg-amber-500/10 text-amber-600", dot: "bg-amber-500" },
  { value: "PROPOSTA_ENVIADA", label: "Proposta enviada", color: "bg-accent/10 text-accent-dark", dot: "bg-accent" },
  { value: "FECHADO", label: "Fechado", color: "bg-emerald-500/10 text-emerald-600", dot: "bg-emerald-500" },
  { value: "PERDIDO", label: "Perdido", color: "bg-red-500/10 text-red-600", dot: "bg-red-500" },
];

/** Etapas que ainda contam como negociação viva. */
export const OPEN_STAGES: LeadStage[] = [
  "NOVO", "FOLLOW_UP", "PROSPECCAO_ATIVA", "REUNIAO_AGENDADA", "PROPOSTA_ENVIADA",
];

/** Etapas do funil de conversão, na ordem em que um lead avança. */
export const FUNNEL_STAGES: LeadStage[] = [...OPEN_STAGES, "FECHADO"];

export const LEAD_ORIGINS = [
  "Indicação", "Instagram", "Google", "Prospecção ativa",
  "Site", "WhatsApp", "Evento", "Outro",
];

export function leadStageLabel(stage: string): string {
  return LEAD_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

export function leadStageColor(stage: string): string {
  return LEAD_STAGES.find((s) => s.value === stage)?.color ?? "bg-gray-100 text-gray-600";
}

export interface LeadData {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  origin: string | null;
  product: string | null;
  stage: LeadStage;
  value: number | null;
  notes: string | null;
  lostReason: string | null;
  ownerId: string | null;
  owner: { id: string; name: string; image: string | null } | null;
  stageChangedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
