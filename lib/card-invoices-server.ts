import type { Prisma } from "@prisma/client";
import { dayInMonth, invoiceDates, invoiceForPurchase, invoiceSummary, shiftPeriod, type InvoiceLine, type InvoicePeriod } from "./card-invoices";
import { toDateKey } from "./dates";

export async function loadCardInvoice(db: Prisma.TransactionClient, creditCardId: string, period: InvoicePeriod) {
  const card = await db.creditCard.findUnique({ where: { id: creditCardId } });
  if (!card) return null;
  const dates = invoiceDates(period, card);
  const [expenses, fixed, payment] = await Promise.all([
    db.variableExpense.findMany({ where: { creditCardId, paymentMethod: "CREDIT_CARD" }, include: { investment: true }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    db.fixedExpense.findMany({ where: { creditCardId, paymentMethod: "CREDIT_CARD" }, orderBy: { name: "asc" } }),
    db.creditCardInvoice.findUnique({ where: { creditCardId_year_month: { creditCardId, ...period } } }),
  ]);
  const lines: InvoiceLine[] = [];
  for (const expense of expenses) {
    const linked = expense.investment && expense.installmentNumber;
    // Shift the first invoice, NOT a clamped purchase day: Jan 30 / Feb 28 must not collide.
    const target = linked ? shiftPeriod(invoiceForPurchase(expense.investment!.date, card), expense.installmentNumber! - 1)
      : expense.cardInvoiceMonth && expense.cardInvoiceYear ? { month: expense.cardInvoiceMonth, year: expense.cardInvoiceYear }
      : invoiceForPurchase(expense.date, card);
    if (target.month !== period.month || target.year !== period.year) continue;
    lines.push({ id: `expense:${expense.id}`, name: expense.name, amount: expense.amount, date: toDateKey(expense.date)!, source: linked ? "INVESTMENT" : "VARIABLE", installmentNumber: expense.installmentNumber, installments: expense.investment?.installments });
  }
  // Fixed expenses already recur monthly in this app. One charge per closing cycle;
  // their legacy month/year metadata is not a purchase date and must not be expanded twice.
  for (const expense of fixed) lines.push({ id: `fixed:${expense.id}:${period.year}-${period.month}`, name: expense.name, amount: expense.amount, date: dayInMonth(dates.closingPeriod, 1), source: "FIXED" });
  return { card, ...period, ...dates, ...invoiceSummary(lines, Number(payment?.paidAmount ?? 0), dates.closesAt) };
}
