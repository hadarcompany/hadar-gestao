import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AsaasPayment } from "@/lib/asaas";
import { paymentUpdateData, getAsaasPayment, AsaasApiError } from "@/lib/asaas";
import { getAsaasWebhookToken } from "@/lib/asaas-integration-server";
import { validAsaasWebhookToken } from "@/lib/asaas-integration";

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
};

function canReceiveFinanceAlerts(user: {
  role: string;
  permissions: Prisma.JsonValue | null;
}) {
  if (user.role === "ADMIN") return true;
  const permissions = user.permissions;
  if (
    !permissions ||
    typeof permissions !== "object" ||
    Array.isArray(permissions)
  )
    return false;
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
    : event === "PAYMENT_OVERDUE"
      ? "PAYMENT_OVERDUE"
      : null;
  if (!kind) return;

  const users = await tx.user.findMany({
    select: { id: true, role: true, permissions: true },
  });
  const recipients = users.filter(canReceiveFinanceAlerts);
  if (recipients.length === 0) return;

  const received = kind === "PAYMENT_RECEIVED";
  await tx.notification.createMany({
    data: recipients.map((user) => ({
      userId: user.id,
      type: kind,
      title: received
        ? `Pagamento recebido: ${receivable.client.name}`
        : `Cobrança vencida: ${receivable.client.name}`,
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
  const expectedToken = await getAsaasWebhookToken();
  const receivedToken = req.headers.get("asaas-access-token");
  if (!validAsaasWebhookToken(expectedToken, receivedToken)) {
    return NextResponse.json(
      { error: "Webhook não autorizado." },
      { status: 401 },
    );
  }

  const payload = (await req
    .json()
    .catch(() => null)) as AsaasWebhookPayload | null;
  if (!payload?.id || !payload.event || !payload.payment?.id) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  try {
    if (
      await prisma.asaasWebhookEvent.findUnique({
        where: { id: payload.id },
        select: { id: true },
      })
    )
      return NextResponse.json({ ok: true, duplicate: true });
    const externalReference = payload.payment.externalReference;
    const snapshot = await prisma.receivable.findFirst({
      where: {
        OR: [
          { asaasPaymentId: payload.payment.id },
          ...(externalReference
            ? [
                {
                  id: externalReference,
                  OR: [
                    { asaasPaymentId: null },
                    { asaasPaymentId: payload.payment.id },
                  ],
                },
              ]
            : []),
        ],
      },
      select: { id: true, asaasSyncedAt: true, paidDate: true },
    });
    let current: AsaasPayment;
    try {
      current = await getAsaasPayment(payload.payment.id, 8000);
    } catch (error) {
      if (
        payload.event === "PAYMENT_DELETED" &&
        error instanceof AsaasApiError &&
        error.status === 404
      )
        current = { ...payload.payment, deleted: true };
      else throw error;
    }
    if (current.id !== payload.payment.id)
      throw Error("Invalid provider payment");
    const latestData = paymentUpdateData(current);
    await prisma.$transaction(async (tx) => {
      await tx.asaasWebhookEvent.create({
        data: {
          id: payload.id!,
          event: payload.event!,
          paymentId: payload.payment!.id,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      const externalReference = current.externalReference;
      const match = await tx.receivable.findFirst({
        where: {
          OR: [
            { asaasPaymentId: current.id },
            ...(externalReference
              ? [
                  {
                    id: externalReference,
                    OR: [
                      { asaasPaymentId: null },
                      { asaasPaymentId: current.id },
                    ],
                  },
                ]
              : []),
          ],
        },
        select: { id: true, paidDate: true, asaasSyncedAt: true },
      });
      let receivable: {
        id: string;
        clientId: string;
        client: { name: string };
      } | null = null;
      if (match) {
        // Do not overwrite a fresher reconciliation/webhook completed during the provider GET.
        if (!snapshot || snapshot.id !== match.id) return;
        const changed = await tx.receivable.updateMany({
          where: { id: match.id, asaasSyncedAt: snapshot.asaasSyncedAt },
          data: paymentUpdateData(current, match.paidDate),
        });
        if (!changed.count) return;
        receivable = await tx.receivable.findUnique({
          where: { id: match.id },
          select: {
            id: true,
            clientId: true,
            client: { select: { name: true } },
          },
        });
      } else {
        const client = await tx.client.findUnique({
          where: { asaasCustomerId: current.customer },
          select: { id: true },
        });
        if (client) {
          receivable = await tx.receivable.create({
            data: {
              clientId: client.id,
              description: current.description || null,
              ...latestData,
            },
            select: {
              id: true,
              clientId: true,
              client: { select: { name: true } },
            },
          });
        }
      }
      const effectiveEvent =
        latestData.status === "PAID"
          ? "PAYMENT_RECEIVED"
          : latestData.status === "OVERDUE" && !current.deleted
            ? "PAYMENT_OVERDUE"
            : "";
      if (receivable && effectiveEvent)
        await createPaymentNotifications(
          tx,
          effectiveEvent,
          current,
          receivable,
        );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (await prisma.asaasWebhookEvent.findUnique({
        where: { id: payload.id },
        select: { id: true },
      }))
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error(
      "Erro ao processar webhook do Asaas:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Falha ao processar evento." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
