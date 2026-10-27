import type { Investment, Prisma } from "@prisma/client";
import { syncExpenseCash } from "./expense-cash";
import { investmentInstallments, InvestmentError } from "./investments";
import { calendarDate, invoiceDates, invoiceForPurchase, shiftPeriod, validateCycle } from "./card-invoices";
import { toCents } from "./finance-money";

function calendarDayRange(date: Date) {
  const start = new Date(calendarDate(date) + "T00:00:00.000Z");
  return { gte: start, lt: new Date(start.getTime() + 86400000) };
}

export async function validateInvestmentCard(db: Prisma.TransactionClient, cardId: string | null, previousCardId?: string | null) {
  if (!cardId) return;
  const card = await db.creditCard.findUnique({ where: { id: cardId } });
  if (!card) throw new InvestmentError("Cartão não encontrado.");
  if (!card.isActive && previousCardId !== cardId) throw new InvestmentError("Selecione um cartão ativo.");
  try { validateCycle(card); }
  catch (error) { throw new InvestmentError((error as Error).message); }
}

/** Reuse stable row IDs; changing cards never creates a second batch. */
export async function syncInvestmentExpenses(db: Prisma.TransactionClient, investment: Investment) {
  if (!investment.autoCreateExpenses) return;
  const schedule = investmentInstallments(investment);
  const card = investment.creditCardId ? await db.creditCard.findUniqueOrThrow({ where: { id: investment.creditCardId } }) : null;
  const firstInvoice = card ? invoiceForPurchase(investment.date, card) : null;
  const hasLinkedExpenses = await db.variableExpense.count({ where: { investmentId: investment.id } });
  if (!hasLinkedExpenses) {
    for (const installment of schedule) {
      const dueDate = card && firstInvoice ? new Date(invoiceDates(shiftPeriod(firstInvoice, installment.installmentNumber - 1), card).dueAt + "T00:00:00.000Z") : installment.date;
      const candidates = await db.variableExpense.findMany({ where: { investmentId: null, name: installment.name, AND: [{ OR: [{ date: calendarDayRange(installment.date) }, { date: calendarDayRange(dueDate) }] }, { OR: [{ creditCardId: null }, { creditCardId: investment.creditCardId }] }] }, select: { amount: true } });
      if (candidates.some(expense => toCents(expense.amount) === toCents(installment.amount))) throw new InvestmentError("Já existe uma despesa correspondente. Marque ‘Usar despesas já cadastradas’ e selecione os lançamentos para evitar duplicidade.", 409);
    }
  }
  for (const installment of schedule) {
    const period = firstInvoice ? shiftPeriod(firstInvoice, installment.installmentNumber - 1) : null;
    const date = card && firstInvoice ? new Date(invoiceDates(shiftPeriod(firstInvoice, installment.installmentNumber - 1), card).dueAt + "T00:00:00.000Z") : installment.date;
    const allocation = { cardInvoiceMonth: period?.month ?? null, cardInvoiceYear: period?.year ?? null };
    const expense = await db.variableExpense.upsert({
      where: { investmentId_installmentNumber: { investmentId: investment.id, installmentNumber: installment.installmentNumber } },
      update: { ...installment, ...allocation, date, paymentMethod: investment.creditCardId ? "CREDIT_CARD" : null, creditCardId: investment.creditCardId, paidWithCash: false },
      create: { ...installment, ...allocation, date, investmentId: investment.id, category: "OUTROS", paymentMethod: investment.creditCardId ? "CREDIT_CARD" : null, creditCardId: investment.creditCardId, paidWithCash: false },
    });
    await syncExpenseCash(db, { variableExpenseId: expense.id }, expense, `Despesa Avulsa: ${expense.name}`);
  }
  await db.variableExpense.deleteMany({ where: { investmentId: investment.id, installmentNumber: { gt: schedule.length } } });
}

/** Existing manually entered expenses require explicit selection, never fuzzy matching. */
export async function adoptInvestmentExpenses(db: Prisma.TransactionClient, investment: Investment, ids: unknown) {
  if (ids === undefined) return;
  if (!Array.isArray(ids) || !ids.every(id => typeof id === "string") || new Set(ids).size !== ids.length) throw new InvestmentError("Seleção de lançamentos inválida.");
  if (!ids.length) return;
  if (await db.variableExpense.count({ where: { investmentId: investment.id } })) throw new InvestmentError("Este investimento já possui parcelas vinculadas. Edite o próprio investimento.", 409);
  const schedule = investmentInstallments(investment);
  if (ids.length !== schedule.length) throw new InvestmentError(`Selecione as ${schedule.length} despesas correspondentes, na ordem das parcelas.`);
  for (let index = 0; index < ids.length; index++) {
    const expense = await db.variableExpense.findUnique({ where: { id: ids[index] } });
    if (!expense || expense.investmentId) throw new InvestmentError("Um dos lançamentos já está vinculado ou não existe.", 409);
    if (toCents(expense.amount) !== toCents(schedule[index].amount)) throw new InvestmentError(`O valor da parcela ${index + 1} não corresponde ao lançamento selecionado.`);
    const card = investment.creditCardId ? await db.creditCard.findUniqueOrThrow({ where: { id: investment.creditCardId } }) : null;
    const dueDate = card ? invoiceDates(shiftPeriod(invoiceForPurchase(investment.date, card), index), card).dueAt : null;
    if (![calendarDate(schedule[index].date), dueDate].includes(calendarDate(expense.date))) throw new InvestmentError(`A data da parcela ${index + 1} não corresponde ao lançamento selecionado.`);
    if (expense.paidWithCash) throw new InvestmentError("O lançamento selecionado já possui retirada do Caixa. Ajuste a origem antes de vinculá-lo.", 409);
    await db.variableExpense.update({ where: { id: expense.id }, data: { investmentId: investment.id, installmentNumber: index + 1 } });
  }
}

export async function syncInvestmentCash(db: Prisma.TransactionClient, investment: Investment) {
  await syncExpenseCash(db, { investmentId: investment.id }, investment, `Investimento: ${investment.description}`);
}
