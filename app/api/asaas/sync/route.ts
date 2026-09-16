import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { AsaasApiError, getAsaasCustomer, listAsaasPayments, paymentUpdateData } from "@/lib/asaas";
import { dateKeyToUTCDate } from "@/lib/dates";
import { canEdit } from "@/lib/permissions";

function monthRange(month: number, year: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para sincronizar cobranças." }, { status: 403 });

  try {
    const body = await req.json();
    const month = Number(body.month);
    const year = Number(body.year);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const range = monthRange(month, year);
    const payments = await listAsaasPayments({ dueDateFrom: range.from, dueDateTo: range.to });
    const customerCache = new Map<string, Awaited<ReturnType<typeof getAsaasCustomer>>>();
    let imported = 0;
    let updated = 0;
    let unmatched = 0;

    for (const payment of payments) {
      let receivable = await prisma.receivable.findUnique({ where: { asaasPaymentId: payment.id } });
      if (!receivable && payment.externalReference) {
        receivable = await prisma.receivable.findUnique({ where: { id: payment.externalReference } });
      }

      let clientId = receivable?.clientId;
      if (!clientId) {
        const linkedClient = await prisma.client.findUnique({ where: { asaasCustomerId: payment.customer }, select: { id: true } });
        clientId = linkedClient?.id;
      }

      if (!clientId) {
        let customer = customerCache.get(payment.customer);
        if (!customer) {
          customer = await getAsaasCustomer(payment.customer);
          customerCache.set(payment.customer, customer);
        }
        const document = customer.cpfCnpj?.replace(/\D/g, "");
        const matchedClient = await prisma.client.findFirst({
          where: {
            OR: [
              ...(customer.externalReference ? [{ id: customer.externalReference }] : []),
              ...(document ? [{ cpfCnpj: document }] : []),
              ...(customer.email ? [{ email: { equals: customer.email, mode: "insensitive" as const } }] : []),
            ],
          },
          select: { id: true, asaasCustomerId: true, cpfCnpj: true },
        });
        if (matchedClient) {
          clientId = matchedClient.id;
          if (!matchedClient.asaasCustomerId) {
            await prisma.client.update({
              where: { id: matchedClient.id },
              data: { asaasCustomerId: payment.customer, cpfCnpj: matchedClient.cpfCnpj || document || null },
            });
          }
        }
      }

      if (!clientId) {
        unmatched++;
        continue;
      }

      if (receivable) {
        await prisma.receivable.update({
          where: { id: receivable.id },
          data: {
            amount: payment.value,
            dueDate: dateKeyToUTCDate(payment.dueDate),
            month: Number(payment.dueDate.slice(5, 7)),
            year: Number(payment.dueDate.slice(0, 4)),
            description: payment.description || receivable.description,
            ...paymentUpdateData(payment),
          },
        });
        updated++;
      } else {
        await prisma.receivable.create({
          data: {
            clientId,
            amount: payment.value,
            dueDate: dateKeyToUTCDate(payment.dueDate),
            month: Number(payment.dueDate.slice(5, 7)),
            year: Number(payment.dueDate.slice(0, 4)),
            description: payment.description || null,
            ...paymentUpdateData(payment),
          },
        });
        imported++;
      }
    }

    return NextResponse.json({ total: payments.length, imported, updated, unmatched });
  } catch (error) {
    if (error instanceof AsaasApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status >= 500 ? 502 : error.status });
    }
    console.error("Erro na conciliação inicial do Asaas:", error);
    return NextResponse.json({ error: "Não foi possível sincronizar as cobranças do Asaas." }, { status: 500 });
  }
}
