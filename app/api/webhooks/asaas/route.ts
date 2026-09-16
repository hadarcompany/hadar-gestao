import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AsaasPayment } from "@/lib/asaas";
import { paymentUpdateData } from "@/lib/asaas";
import { dateKeyToUTCDate } from "@/lib/dates";

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
};

function canReceiveFinanceAlerts(user: { role: string; permissions: Prisma.JsonValue | null }) {
  if (user.role === "ADMIN") return true;
  const permissions = user.permissions;
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return false;
  const level = (permissions as Prisma.JsonObject).financeiro;
  return level === "view" || level === "edit";
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function createPaymentNotifications(
  tx: Prisma.TransactionClient,
  event: string,
  payment: AsaasPayment,
  receivable: { id: string; clientId: string; client: { name: string } },
) {
  const kind = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)
    ? "PAYMENT_RECEIVED"
    : event === "PAYMENT_OVERDUE" ? "PAYMENT_OVERDUE" : null;
  if (!kind) return;

  const users = await tx.user.findMany({ select: { id: true, role: true, permissions: true } });
  const recipients = users.filter(canReceiveFinanceAlerts);
  if (recipients.length === 0) return;

  const received = kind === "PAYMENT_RECEIVED";
  await tx.notification.createMany({
    data: recipients.map((user) => ({
      userId: user.id,
      type: kind,
      title: received ? `Pagamento recebido: ${receivable.client.name}` : `Cobrança vencida: ${receivable.client.name}`,
      body: received
        ? `${brl(payment.value)} entrou pelo Asaas.`
        : `${brl(payment.value)} venceu em ${payment.dueDate}.`,
      clientId: receivable.clientId,
      dedupeKey: `asaas:${kind}:${payment.id}:${user.id}`,
    })),
    skipDuplicates: true,
  });
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const receivedToken = req.headers.get("asaas-access-token");
  if (!expectedToken || receivedToken !== expectedToken) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const payload = await req.json() as AsaasWebhookPayload;
  if (!payload.id || !payload.event || !payload.payment?.id) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.asaasWebhookEvent.create({
        data: {
          id: payload.id!,
          event: payload.event!,
          paymentId: payload.payment!.id,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      const externalReference = payload.payment!.externalReference;
      const match = await tx.receivable.findFirst({
        where: {
          OR: [
            { asaasPaymentId: payload.payment!.id },
            ...(externalReference ? [{ id: externalReference }] : []),
          ],
        },
        select: { id: true },
      });
      let receivable: { id: string; clientId: string; client: { name: string } } | null = null;
      if (match) {
        receivable = await tx.receivable.update({
          where: { id: match.id },
          data: paymentUpdateData(payload.payment!),
          select: { id: true, clientId: true, client: { select: { name: true } } },
        });
      } else {
        const client = await tx.client.findUnique({
          where: { asaasCustomerId: payload.payment!.customer },
          select: { id: true },
        });
        if (client) {
          receivable = await tx.receivable.create({
            data: {
              clientId: client.id,
              amount: payload.payment!.value,
              dueDate: dateKeyToUTCDate(payload.payment!.dueDate),
              month: Number(payload.payment!.dueDate.slice(5, 7)),
              year: Number(payload.payment!.dueDate.slice(0, 4)),
              description: payload.payment!.description || null,
              ...paymentUpdateData(payload.payment!),
            },
            select: { id: true, clientId: true, client: { select: { name: true } } },
          });
        }
      }
      if (receivable) await createPaymentNotifications(tx, payload.event!, payload.payment!, receivable);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("Erro ao processar webhook do Asaas:", error);
    return NextResponse.json({ error: "Falha ao processar evento." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
