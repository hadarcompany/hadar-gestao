import type { Investment } from "@prisma/client";
import { addCalendarMonths, calendarDate } from "./card-invoices";
import { moneyInput, splitInstallments } from "./finance-money";

export class InvestmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function investmentData(body: Record<string, unknown>, existing?: Investment) {
  const input = { ...existing, ...body };
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description || description.length > 500) throw new InvestmentError("Informe um nome ou descrição de até 500 caracteres.");
  const amount = moneyInput(input.amount);
  const paymentMethod = input.paymentMethod ?? "A_VISTA";
  if (paymentMethod !== "A_VISTA" && paymentMethod !== "PARCELADO") throw new InvestmentError("Forma de pagamento inválida.");
  const installments = paymentMethod === "PARCELADO" ? Number(input.installments) : null;
  if (paymentMethod === "PARCELADO" && (!Number.isInteger(installments) || installments! < 2 || installments! > 600)) throw new InvestmentError("Informe de 2 a 600 parcelas.");
  splitInstallments(amount, installments ?? 1);
  const date = new Date(calendarDate(input.date) + "T00:00:00.000Z");
  if (typeof (input.paidWithCash ?? false) !== "boolean" || typeof (input.autoCreateExpenses ?? false) !== "boolean") throw new InvestmentError("Opções de pagamento inválidas.");
  const creditCardId = input.creditCardId === "" || input.creditCardId == null ? null : input.creditCardId;
  if (creditCardId !== null && (typeof creditCardId !== "string" || !creditCardId.trim())) throw new InvestmentError("Cartão inválido.");
  return { description, amount, paymentMethod, installments, date, paidWithCash: input.paidWithCash ?? false, creditCardId: creditCardId as string | null, autoCreateExpenses: !!creditCardId || (input.autoCreateExpenses ?? false) };
}

export function investmentInstallments(investment: Pick<Investment, "description" | "amount" | "paymentMethod" | "installments" | "date">) {
  const amounts = splitInstallments(investment.amount, investment.paymentMethod === "PARCELADO" ? investment.installments ?? 1 : 1);
  return amounts.map((amount, index) => ({
    installmentNumber: index + 1,
    name: amounts.length > 1 ? `${investment.description} (${index + 1}/${amounts.length})` : investment.description,
    amount,
    date: new Date(addCalendarMonths(investment.date, index) + "T00:00:00.000Z"),
  }));
}
