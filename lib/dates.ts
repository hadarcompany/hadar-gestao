/**
 * Regra central de datas do sistema. Datas de prazo/entrega são tratadas como
 * datas de calendário (sem horário) e comparadas por chave "YYYY-MM-DD" para
 * evitar deslocamentos causados por fuso horário. "Hoje" é calculado no fuso
 * de operação configurado (America/Sao_Paulo por padrão).
 *
 * Use estas funções em qualquer lugar que precise classificar uma tarefa por
 * prazo (dashboard, tarefas, meu trabalho, calendário) para que o resultado
 * seja sempre o mesmo.
 */

export function getOperationTimeZone(): string {
  return process.env.NEXT_PUBLIC_OPERATION_TIMEZONE || process.env.OPERATION_TIMEZONE || "America/Sao_Paulo";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extrai a chave de calendário (YYYY-MM-DD) de um Date usando os componentes UTC,
 * já que datas "sem horário" são persistidas como meia-noite UTC (new Date("YYYY-MM-DD")). */
export function dateKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Converte qualquer entrada de data (Date, ISO string, ou já uma chave YYYY-MM-DD) em chave de calendário. */
export function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return dateKeyFromDate(d);
}

/** Chave de calendário (YYYY-MM-DD) para "hoje" no fuso de operação. */
export function getTodayKey(tz: string = getOperationTimeZone()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Constrói um Date em meia-noite UTC a partir de uma chave YYYY-MM-DD (mesma convenção usada ao salvar). */
export function dateKeyToUTCDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Fim do dia (23:59:59.999 UTC) para uma chave YYYY-MM-DD — útil em filtros de range `lte`. */
export function dateKeyToUTCEndOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

export function addDaysToKey(dateKey: string, days: number): string {
  const dt = dateKeyToUTCDate(dateKey);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dateKeyFromDate(dt);
}

/** Segunda-feira (YYYY-MM-DD) da semana que contém a chave informada. */
export function getMondayOfWeek(dateKey: string): string {
  const dt = dateKeyToUTCDate(dateKey);
  const dow = dt.getUTCDay(); // 0=domingo..6=sábado
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dateKeyFromDate(dt);
}

/** Semana atual (segunda a domingo) no fuso de operação. */
export function getCurrentWeekRange(tz: string = getOperationTimeZone()): { start: string; end: string } {
  const start = getMondayOfWeek(getTodayKey(tz));
  return { start, end: addDaysToKey(start, 6) };
}

export function formatDateKeyBR(dateKey: string | null | undefined): string {
  if (!dateKey) return "—";
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

/** DD/MM/AAAA de uma data de calendário. Use no lugar de `toLocaleDateString`,
 * que desloca um dia por interpretar a meia-noite UTC no fuso local. */
export function formatDateBR(value: string | Date | null | undefined): string {
  return formatDateKeyBR(toDateKey(value));
}

/** DD/MM de uma data de calendário, sem deslocamento de fuso. */
export function formatDayMonthBR(value: string | Date | null | undefined): string {
  const key = toDateKey(value);
  if (!key) return "—";
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export type TaskDateBucket = "OVERDUE" | "TODAY" | "UPCOMING" | "NO_DATE";

/** Classifica um prazo (ignorando status) em atrasado / hoje / próximo / sem data. */
export function classifyDueDate(dueDate: string | Date | null | undefined, tz: string = getOperationTimeZone()): TaskDateBucket {
  const dueKey = toDateKey(dueDate ?? null);
  if (!dueKey) return "NO_DATE";
  const todayKey = getTodayKey(tz);
  if (dueKey < todayKey) return "OVERDUE";
  if (dueKey === todayKey) return "TODAY";
  return "UPCOMING";
}

export type TaskStatusBucket = "COMPLETED" | "CANCELLED" | TaskDateBucket;

/** Classificação completa de uma tarefa: concluída/cancelada têm prioridade sobre a data.
 * Regra: atrasada = não concluída com entrega < hoje; hoje = não concluída com entrega = hoje;
 * próxima = não concluída com entrega > hoje; sem data = sem prazo definido. */
export function getTaskBucket(task: { status: string; dueDate: string | Date | null }, tz: string = getOperationTimeZone()): TaskStatusBucket {
  if (task.status === "COMPLETED") return "COMPLETED";
  if (task.status === "CANCELLED") return "CANCELLED";
  return classifyDueDate(task.dueDate, tz);
}

export function isOverdue(task: { status: string; dueDate: string | Date | null }, tz: string = getOperationTimeZone()): boolean {
  return getTaskBucket(task, tz) === "OVERDUE";
}
