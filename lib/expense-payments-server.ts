import type { Prisma } from "@prisma/client";
import { parseExpensePayment, validateExpenseCard, type ExpensePayment } from "@/lib/expense-payments";

export async function resolveExpensePayment(db: Prisma.TransactionClient, body: Record<string, unknown>, existing?: ExpensePayment) {
  const payment = parseExpensePayment(body, existing);
  if (payment.creditCardId) {
    const card = await db.creditCard.findUnique({ where: { id: payment.creditCardId }, select: { id: true, isActive: true } });
    validateExpenseCard(payment, card, existing);
  }
  return payment;
}
