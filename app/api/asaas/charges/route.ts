import { NextRequest, NextResponse } from "next/server";
import type { AsaasBillingType } from "@prisma/client";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { dateKeyToUTCDate, getTodayKey } from "@/lib/dates";
import { canEdit, canView } from "@/lib/permissions";
import { withMedia } from "@/lib/media";
import {
  AsaasApiError,
  createAsaasCustomer,
  createAsaasPayment,
  findAsaasCustomerByExternalReference,
  findAsaasPaymentByExternalReference,
  getAsaasConfig,
  paymentUpdateData,
} from "@/lib/asaas";

const BILLING_TYPES = new Set<AsaasBillingType>(["UNDEFINED", "BOLETO", "CREDIT_CARD", "PIX"]);

function errorResponse(error: unknown) {
  if (error instanceof AsaasApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status >= 500 ? 502 : error.status });
  }
  console.error("Erro na integração Asaas:", error);
  return NextResponse.json({ error: "Não foi possível processar a cobrança." }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para visualizar o financeiro." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  const periodWhere = {
    billingType: { not: null },
    ...(Number.isInteger(month) && month >= 1 && month <= 12 ? { month } : {}),
    ...(Number.isInteger(year) && year >= 2000 ? { year } : {}),
  };

  await prisma.receivable.updateMany({
    where: { ...periodWhere, status: "PENDING", dueDate: { lt: dateKeyToUTCDate(getTodayKey()) } },
    data: { status: "OVERDUE" },
  });

  const where = {
    ...periodWhere,
    ...(status && ["PENDING", "PAID", "OVERDUE"].includes(status) ? { status: status as "PENDING" | "PAID" | "OVERDUE" } : {}),
    ...(search ? { client: { name: { contains: search, mode: "insensitive" as const } } } : {}),
  };

  const [charges, periodCharges] = await Promise.all([
    prisma.receivable.findMany({
      where,
      include: { client: { select: { id: true, name: true, cpfCnpj: true } } },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.receivable.findMany({ where: { ...periodWhere, asaasPaymentId: { not: null } }, select: { amount: true, status: true } }),
  ]);

  const summary = periodCharges.reduce((acc, charge) => {
    acc.total += charge.amount;
    if (charge.status === "PAID") acc.paid += charge.amount;
    else if (charge.status === "OVERDUE") acc.overdue += charge.amount;
    else acc.pending += charge.amount;
    return acc;
  }, { total: 0, paid: 0, pending: 0, overdue: 0 });

  return NextResponse.json({ charges: await withMedia(charges), summary, integration: getAsaasConfig() });
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para gerar cobranças." }, { status: 403 });

  let receivableId: string | null = null;
  try {
    const body = await req.json();
    const clientId = String(body.clientId || "");
    const amount = Number(body.amount);
    const dueDate = String(body.dueDate || "");
    const billingType = String(body.billingType || "UNDEFINED") as AsaasBillingType;
    const cpfCnpj = String(body.cpfCnpj || "").replace(/\D/g, "");
    const description = String(body.description || "").trim();

    if (!clientId || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !BILLING_TYPES.has(billingType)) {
      return NextResponse.json({ error: "Preencha cliente, valor, vencimento e forma de pagamento corretamente." }, { status: 400 });
    }
    if (cpfCnpj && ![11, 14].includes(cpfCnpj.length)) {
      return NextResponse.json({ error: "Informe um CPF ou CNPJ válido." }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    const document = cpfCnpj || client.cpfCnpj;
    if (!document) return NextResponse.json({ error: "Informe o CPF/CNPJ do cliente para cadastrá-lo no Asaas." }, { status: 400 });
    if (client.cpfCnpj !== document) {
      await prisma.client.update({ where: { id: client.id }, data: { cpfCnpj: document } });
    }

    const [, monthText] = dueDate.split("-");
    const year = Number(dueDate.slice(0, 4));
    const month = Number(monthText);
    const receivable = await prisma.receivable.create({
      data: {
        clientId,
        amount,
        dueDate: dateKeyToUTCDate(dueDate),
        month,
        year,
        description: description || null,
        billingType,
      },
    });
    receivableId = receivable.id;

    let customerId = client.asaasCustomerId;
    if (!customerId) {
      const existing = await findAsaasCustomerByExternalReference(client.id);
      const customer = existing || await createAsaasCustomer({
        name: client.name,
        cpfCnpj: document,
        email: client.email,
        phone: client.phone,
        externalReference: client.id,
      });
      customerId = customer.id;
      await prisma.client.update({
        where: { id: client.id },
        data: { asaasCustomerId: customerId },
      });
    }

    const existingPayment = await findAsaasPaymentByExternalReference(receivable.id);
    const payment = existingPayment || await createAsaasPayment({
      customer: customerId,
      billingType,
      value: amount,
      dueDate,
      description: description || null,
      externalReference: receivable.id,
    });

    const synced = await prisma.receivable.update({
      where: { id: receivable.id },
      data: paymentUpdateData(payment),
      include: { client: { select: { id: true, name: true, cpfCnpj: true } } },
    });
    return NextResponse.json(synced, { status: 201 });
  } catch (error) {
    if (receivableId) {
      const message = error instanceof Error ? error.message : "Falha de sincronização com o Asaas.";
      await prisma.receivable.update({ where: { id: receivableId }, data: { asaasSyncError: message } }).catch(() => undefined);
    }
    return errorResponse(error);
  }
}
