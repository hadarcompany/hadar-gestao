import { SocialError } from "./core";
export function dayDate(value: unknown): string {
  const parsed =
    typeof value === "string" ? new Date(value + "T12:00:00Z") : new Date(NaN);
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new SocialError("Data inválida.");
  return value;
}
export type Recurrence = {
  weekdays: number[];
  time: string;
  startDate: string;
  endDate: string | null;
};
export function validateRecurrence(input: unknown): Recurrence | null {
  if (!input) return null;
  if (typeof input !== "object" || Array.isArray(input))
    throw new SocialError("Repetição inválida.");
  const r = input as Record<string, unknown>;
  if (
    !Array.isArray(r.weekdays) ||
    !r.weekdays.length ||
    r.weekdays.length > 7 ||
    r.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    typeof r.time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)
  )
    throw new SocialError("Selecione dias da semana e horário válidos.");
  const startDate = dayDate(r.startDate),
    endDate = r.endDate ? dayDate(r.endDate) : null;
  if (endDate && endDate < startDate)
    throw new SocialError(
      "A data final deve ser igual ou posterior à inicial.",
    );
  const start = new Date(startDate + "T00:00:00-03:00");
  if (
    start.getTime() > Date.now() + 366 * 86400000 ||
    start.getTime() < Date.now() - 86400000
  )
    throw new SocialError(
      "Escolha uma data inicial entre hoje e um ano à frente.",
    );
  return {
    weekdays: [...new Set(r.weekdays as number[])],
    time: r.time,
    startDate,
    endDate,
  };
}
export function occurrences(r: Recurrence, now = new Date(), horizon = 60) {
  const result: Date[] = [];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  let day = new Date(
    (r.startDate > today ? r.startDate : today) + "T12:00:00Z",
  );
  const limit = new Date(now.getTime() + horizon * 86400000);
  for (
    let i = 0;
    i <= horizon && day <= limit;
    i++, day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const key = day.toISOString().slice(0, 10);
    if (r.endDate && key > r.endDate) break;
    const date = new Date(`${key}T${r.time}:00-03:00`);
    if (
      r.weekdays.includes(day.getUTCDay()) &&
      date.getTime() >= now.getTime() + 60000
    )
      result.push(date);
  }
  return result;
}
