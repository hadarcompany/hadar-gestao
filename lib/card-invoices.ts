import { dateKeyFromDate, dateKeyToUTCDate, getTodayKey, toDateKey } from "./dates";
import { toCents } from "./finance-money";

export type InvoicePeriod = { month: number; year: number };
export type CardCycle = { closingDay: number | null; dueDay: number | null };
export type InvoiceLine = { id: string; name: string; amount: number; date: string; source: "FIXED" | "VARIABLE" | "INVESTMENT"; installmentNumber?: number | null; installments?: number | null };

export function validatePeriod(month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 9998) throw new Error("Mês ou ano inválido.");
  return { month, year };
}

export function validateCycle(cycle: CardCycle) {
  if (![cycle.closingDay, cycle.dueDay].every(day => typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 31)) {
    throw new Error("Configure os dias de fechamento e vencimento deste cartão (1 a 31).");
  }
  return { closingDay: cycle.closingDay!, dueDay: cycle.dueDay! };
}

export function shiftPeriod(period: InvoicePeriod, months: number): InvoicePeriod {
  const date = new Date(Date.UTC(period.year, period.month - 1 + months, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function dayInMonth(period: InvoicePeriod, day: number): string {
  const last = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  return dateKeyFromDate(new Date(Date.UTC(period.year, period.month - 1, Math.min(day, last))));
}

export function calendarDate(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) throw new Error("Informe uma data válida.");
  if (typeof value === "string") {
    const raw = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || dateKeyFromDate(dateKeyToUTCDate(raw)) !== raw) throw new Error("Informe uma data válida.");
  }
  const key = toDateKey(value);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKeyFromDate(dateKeyToUTCDate(key)) !== key) throw new Error("Informe uma data válida.");
  validatePeriod(Number(key.slice(5, 7)), Number(key.slice(0, 4)));
  return key;
}

export function addCalendarMonths(value: string | Date, months: number): string {
  const key = calendarDate(value);
  return dayInMonth(shiftPeriod({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) }, months), Number(key.slice(8, 10)));
}

/** Invoice label is its due month. Purchases on closing day belong to that closing. */
export function invoiceForPurchase(value: string | Date, cycle: CardCycle): InvoicePeriod {
  const { closingDay, dueDay } = validateCycle(cycle);
  const key = calendarDate(value);
  let closing = { month: Number(key.slice(5, 7)), year: Number(key.slice(0, 4)) };
  if (key > dayInMonth(closing, closingDay)) closing = shiftPeriod(closing, 1);
  return dueDay <= closingDay ? shiftPeriod(closing, 1) : closing;
}

export function invoiceDates(period: InvoicePeriod, cycle: CardCycle) {
  validatePeriod(period.month, period.year);
  const { closingDay, dueDay } = validateCycle(cycle);
  const closingPeriod = dueDay <= closingDay ? shiftPeriod(period, -1) : period;
  const previousClosing = dayInMonth(shiftPeriod(closingPeriod, -1), closingDay);
  const start = dateKeyToUTCDate(previousClosing);
  start.setUTCDate(start.getUTCDate() + 1);
  return { startsAt: dateKeyFromDate(start), closesAt: dayInMonth(closingPeriod, closingDay), dueAt: dayInMonth(period, dueDay), closingPeriod };
}

export function invoiceSummary(lines: readonly InvoiceLine[], paidAmount: number, closesAt: string, today = getTodayKey()) {
  const unique = [...new Map(lines.map(line => [line.id, line])).values()];
  const totalCents = unique.reduce((sum, line) => sum + toCents(line.amount), 0);
  const paidCents = toCents(paidAmount);
  const status = paidCents > 0 && paidCents >= totalCents ? "PAID" : paidCents > 0 ? "PARTIALLY_PAID" : today > closesAt ? "CLOSED" : "OPEN";
  return { total: totalCents / 100, paid: paidCents / 100, remaining: Math.max(0, totalCents - paidCents) / 100, credit: Math.max(0, paidCents - totalCents) / 100, status, lines: unique };
}
