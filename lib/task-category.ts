import { TASK_TEMPLATES } from "./task-templates";

export const TASK_CATEGORIES = [
  { value: "criacao", label: "Criação" },
  { value: "demanda_clientes", label: "Demanda dos clientes" },
  { value: "adm_financeiro", label: "Adm. financeiro" },
  { value: "gestao_projetos", label: "Gestão de projetos" },
  { value: "trafego_pago", label: "Tráfego pago" },
  { value: "recorrentes", label: "Recorrentes" },
  { value: "onboarding", label: "Onboarding" },
  { value: "comercial", label: "Comercial" },
  { value: "operacao", label: "Operação" },
  { value: "geral", label: "Geral" },
] as const;

interface CategorizedTask { type?: string | null; area?: string | null; extraFields?: Record<string, unknown> | null }
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const mondayCategories: Record<string, string> = {
  criacao: "criacao", "demanda dos clientes": "demanda_clientes", "adm financeiro": "adm_financeiro",
  "gestao de projetos": "gestao_projetos", "trafego pago": "trafego_pago", recorrentes: "recorrentes",
};
export function explicitTaskCategory(task: CategorizedTask): string {
  const value = task.extraFields?.taskCategory;
  return TASK_CATEGORIES.some(c => c.value === value) ? String(value) : "";
}
export function taskCategory(task: CategorizedTask): string {
  const explicit = explicitTaskCategory(task);
  if (explicit) return explicit;
  if (task.extraFields?.materialSubmission) return "demanda_clientes";
  const monday = task.extraFields?.monday as { group?: unknown; sourceFile?: unknown } | undefined;
  if (typeof monday?.group === "string" && mondayCategories[normalize(monday.group)]) return mondayCategories[normalize(monday.group)];
  if (typeof monday?.sourceFile === "string" && normalize(monday.sourceFile).includes("onboardings")) return "onboarding";
  if (task.type === "onboarding") return "onboarding";
  if (["captacao", "reels", "post_avulso", "carrossel", "criativo_trafego", "landing_page", "calendario_editorial"].includes(task.type || "")) return "criacao";
  if (normalize(task.area || "") === "financeiro") return "adm_financeiro";
  return "geral";
}
export function taskCategoryLabel(task: CategorizedTask): string {
  return TASK_CATEGORIES.find(c => c.value === taskCategory(task))!.label;
}
export function taskTypeLabel(task: CategorizedTask): string | null {
  if (!task.type || task.type === "tarefa_generica") return null;
  return TASK_TEMPLATES[task.type as keyof typeof TASK_TEMPLATES]?.label || task.type.replace(/_/g, " ");
}
export function taskContextLabel(task: CategorizedTask): string {
  const monday = task.extraFields?.monday as { sourceFile?: unknown } | undefined;
  const source = typeof monday?.sourceFile === "string" ? normalize(monday.sourceFile) : "";
  const board = source.includes("tarefas di") ? "Tarefas diárias" : source.includes("onboardings") ? "Projetos / Onboardings" : "";
  return [board, taskCategoryLabel(task)].filter(Boolean).join(" › ");
}
