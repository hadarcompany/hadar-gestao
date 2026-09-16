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
      if (match) {
        await tx.receivable.update({ where: { id: match.id }, data: paymentUpdateData(payload.payment!) });
      } else {
        const client = await tx.client.findUnique({
          where: { asaasCustomerId: payload.payment!.customer },
          select: { id: true },
        });
        if (client) {
          await tx.receivable.create({
            data: {
              clientId: client.id,
              amount: payload.payment!.value,
              dueDate: dateKeyToUTCDate(payload.payment!.dueDate),
              month: Number(payload.payment!.dueDate.slice(5, 7)),
              year: Number(payload.payment!.dueDate.slice(0, 4)),
              description: payload.payment!.description || null,
              ...paymentUpdateData(payload.payment!),
            },
          });
        }
      }
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
