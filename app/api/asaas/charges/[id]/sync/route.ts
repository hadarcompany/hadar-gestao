import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import {
  AsaasApiError,
  createAsaasCustomer,
  createAsaasPayment,
  findAsaasCustomerByExternalReference,
  findAsaasPaymentByExternalReference,
  paymentUpdateData,
} from "@/lib/asaas";
import { dateKeyFromDate } from "@/lib/dates";
import { canEdit } from "@/lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para sincronizar cobranças." }, { status: 403 });

  const { id } = await params;
  try {
    const charge = await prisma.receivable.findUnique({ where: { id }, include: { client: true } });
    if (!charge) return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
    if (!charge.billingType) return NextResponse.json({ error: "Esta conta não foi criada como cobrança Asaas." }, { status: 400 });
    if (!charge.client.cpfCnpj) return NextResponse.json({ error: "Cadastre o CPF/CNPJ do cliente antes de sincronizar." }, { status: 400 });

    let customerId = charge.client.asaasCustomerId;
    if (!customerId) {
      const existing = await findAsaasCustomerByExternalReference(charge.client.id);
      const customer = existing || await createAsaasCustomer({
        name: charge.client.name,
        cpfCnpj: charge.client.cpfCnpj,
        email: charge.client.email,
        phone: charge.client.phone,
        externalReference: charge.client.id,
      });
      customerId = customer.id;
      await prisma.client.update({ where: { id: charge.client.id }, data: { asaasCustomerId: customerId } });
    }

    const existingPayment = await findAsaasPaymentByExternalReference(charge.id);
    const payment = existingPayment || await createAsaasPayment({
      customer: customerId,
      billingType: charge.billingType,
      value: charge.amount,
      dueDate: dateKeyFromDate(charge.dueDate),
      description: charge.description,
      externalReference: charge.id,
    });
    const synced = await prisma.receivable.update({ where: { id }, data: paymentUpdateData(payment) });
    return NextResponse.json(synced);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de sincronização com o Asaas.";
    await prisma.receivable.update({ where: { id }, data: { asaasSyncError: message } }).catch(() => undefined);
    if (error instanceof AsaasApiError) return NextResponse.json({ error: error.message }, { status: error.status >= 500 ? 502 : error.status });
    console.error("Erro ao sincronizar cobrança Asaas:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
