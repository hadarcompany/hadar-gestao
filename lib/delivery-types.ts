/**
 * Tipos de entrega de conteúdo reconhecidos pelo calendário e pela demanda semanal.
 * Reaproveita os mesmos valores já usados em `Task.type` (lib/task-templates.ts),
 * para não criar um vocabulário paralelo.
 */
export const DELIVERY_TYPES = [
  { value: "reels", label: "Reel" },
  { value: "post_avulso", label: "Post" },
  { value: "carrossel", label: "Carrossel" },
  { value: "criativo_trafego", label: "Criativo de Tráfego" },
] as const;

export type DeliveryTypeValue = (typeof DELIVERY_TYPES)[number]["value"];

export function isDeliveryType(type: string | null | undefined): type is DeliveryTypeValue {
  return !!type && DELIVERY_TYPES.some((d) => d.value === type);
}

export function deliveryTypeLabel(value: string): string {
  return DELIVERY_TYPES.find((d) => d.value === value)?.label ?? value;
}
