/**
 * Áreas de trabalho da agência. Cada tarefa pode ter uma área (editável a qualquer
 * momento) e, ao escolher a área na criação, o responsável padrão é sugerido.
 * O responsável é identificado pelo e-mail para não depender de ids do banco.
 */

export type AreaValue = "EDICAO" | "CAPTACAO" | "DESIGN" | "OPERACAO";

export const AREAS: { value: AreaValue; label: string; color: string; bar: string; defaultEmail: string }[] = [
  { value: "EDICAO", label: "Edição de vídeo", color: "bg-purple-500/10 text-purple-600", bar: "#8b5cf6", defaultEmail: "alexandre@agenciahadar.com.br" },
  { value: "CAPTACAO", label: "Captação", color: "bg-blue-500/10 text-blue-600", bar: "#3b82f6", defaultEmail: "felipe@agenciahadar.com.br" },
  { value: "DESIGN", label: "Design e programação", color: "bg-amber-500/10 text-amber-600", bar: "#f59e0b", defaultEmail: "luiz@agenciahadar.com.br" },
  { value: "OPERACAO", label: "Operação", color: "bg-emerald-500/10 text-emerald-600", bar: "#10b981", defaultEmail: "felipe@agenciahadar.com.br" },
];

const AREA_BY_TYPE: Record<string, AreaValue> = {
  reels: "EDICAO",
  captacao: "CAPTACAO",
  post_avulso: "DESIGN",
  carrossel: "DESIGN",
  criativo_trafego: "DESIGN",
  landing_page: "DESIGN",
  calendario_editorial: "OPERACAO",
  relatorio_mensal: "OPERACAO",
  onboarding: "OPERACAO",
  reuniao_cliente: "OPERACAO",
  briefing: "OPERACAO",
  google_meu_negocio: "OPERACAO",
};

export function areaForType(type: string | null | undefined): AreaValue | null {
  return (type && AREA_BY_TYPE[type]) || null;
}

export function areaInfo(area: string | null | undefined) {
  return AREAS.find((a) => a.value === area) ?? null;
}

export function defaultAssigneeFor(area: string | null | undefined, users: { id: string; email?: string | null }[]): string | null {
  const email = areaInfo(area)?.defaultEmail;
  if (!email) return null;
  return users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
}
