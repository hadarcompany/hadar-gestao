import type { Prisma } from "@prisma/client";

export type CashSource = { fixedExpenseId: string } | { variableExpenseId: string } | { investmentId: string };

/** Exactly one cash withdrawal per source, in the same transaction as the source mutation. */
export async function syncExpenseCash(db: Prisma.TransactionClient, source: CashSource, record: { paidWithCash: boolean; amount: number }, description: string) {
  const entry = await db.cashEntry.findFirst({ where: source });
  if (!record.paidWithCash) {
    if (entry && !entry.voidedAt) await db.cashEntry.update({ where: { id: entry.id }, data: { voidedAt: new Date() } });
    return;
  }
  if (entry) {
    await db.cashEntry.update({ where: { id: entry.id }, data: { amount: record.amount, description, voidedAt: null } });
  } else {
    await db.cashEntry.create({ data: { ...source, type: "RETIRADA_DESPESA", amount: record.amount, description } });
  }
}
