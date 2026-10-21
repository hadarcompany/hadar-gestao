import { prisma } from "./prisma";
import { getAsaasConfig, getAsaasPayment, paymentUpdateData } from "./asaas";
export type AsaasReconciliation = {
  configured: boolean;
  checked: number;
  updated: number;
  failed: number;
  conflicts: number;
  remaining: number;
  finishedAt: string;
};
export async function reconcileAsaasCharges({
  force = false,
  limit = 40,
  budgetMs = 18000,
}: {
  force?: boolean;
  limit?: number;
  budgetMs?: number;
} = {}): Promise<AsaasReconciliation> {
  const result: AsaasReconciliation = {
    configured: (await getAsaasConfig()).configured,
    checked: 0,
    updated: 0,
    failed: 0,
    conflicts: 0,
    remaining: 0,
    finishedAt: new Date().toISOString(),
  };
  if (!result.configured) return result;
  const stale = new Date(Date.now() - (force ? 0 : 60000));
  const where = {
    asaasPaymentId: { not: null },
    AND: [
      {
        OR: [
          {
            status: { in: ["PENDING", "OVERDUE"] as ("PENDING" | "OVERDUE")[] },
          },
          {
            status: "PAID" as const,
            OR: [
              { paidDate: { gte: new Date(Date.now() - 90 * 86400000) } },
              {
                paidDate: null,
                dueDate: { gte: new Date(Date.now() - 90 * 86400000) },
              },
            ],
            ...(force
              ? {}
              : {
                  AND: [
                    {
                      OR: [
                        { asaasSyncedAt: null },
                        {
                          asaasSyncedAt: {
                            lt: new Date(Date.now() - 15 * 60000),
                          },
                        },
                      ],
                    },
                  ],
                }),
          },
        ],
      },
      { OR: [{ asaasSyncedAt: null }, { asaasSyncedAt: { lt: stale } }] },
    ],
  };
  const charges = await prisma.receivable.findMany({
    where,
    select: {
      id: true,
      asaasPaymentId: true,
      asaasSyncedAt: true,
      paidDate: true,
    },
    orderBy: { updatedAt: "asc" },
    take: Math.min(100, Math.max(1, limit)),
  });
  result.remaining = Math.max(
    0,
    (await prisma.receivable.count({ where })) - charges.length,
  );
  const deadline = Date.now() + budgetMs;
  for (let index = 0; index < charges.length; index += 4) {
    if (Date.now() > deadline - 1000) {
      result.remaining += charges.length - index;
      break;
    }
    await Promise.all(
      charges.slice(index, index + 4).map(async (charge) => {
        result.checked++;
        try {
          const payment = await getAsaasPayment(
            charge.asaasPaymentId!,
            Math.max(1000, Math.min(8000, deadline - Date.now())),
          );
          if (payment.id !== charge.asaasPaymentId)
            throw Error("Mismatched payment");
          // A webhook or another request may have updated this row during the GET.
          const changed = await prisma.receivable.updateMany({
            where: {
              id: charge.id,
              asaasPaymentId: charge.asaasPaymentId,
              asaasSyncedAt: charge.asaasSyncedAt,
            },
            data: paymentUpdateData(payment, charge.paidDate),
          });
          changed.count ? result.updated++ : result.conflicts++;
        } catch {
          result.failed++;
          await prisma.receivable.updateMany({
            where: { id: charge.id, asaasSyncedAt: charge.asaasSyncedAt },
            data: {
              asaasSyncError:
                "Não foi possível confirmar esta cobrança no Asaas. A conciliação será tentada novamente.",
            },
          });
        }
      }),
    );
  }
  result.finishedAt = new Date().toISOString();
  return result;
}
