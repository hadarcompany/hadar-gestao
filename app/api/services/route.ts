import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { dateKeyToUTCDate, getTodayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (clientId) where.clientId = clientId;

  const todayKey = getTodayKey();
  const [year, month] = todayKey.split("-").map(Number);
  const today = dateKeyToUTCDate(todayKey);

  await prisma.receivable.updateMany({
    where: { asaasPaymentId: { not: null }, status: "PENDING", dueDate: { lt: today } },
    data: { status: "OVERDUE" },
  });

  const services = await prisma.service.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const clientIds = [...new Set(services.map((service) => service.clientId))];
  const charges = clientIds.length > 0 ? await prisma.receivable.findMany({
    where: { clientId: { in: clientIds }, asaasPaymentId: { not: null }, month, year },
    select: { clientId: true, amount: true, status: true, asaasInvoiceUrl: true },
  }) : [];

  const financialByClient = new Map<string, { billed: number; paid: number; pending: number; overdue: number; chargeCount: number; invoiceUrl: string | null }>();
  charges.forEach((charge) => {
    const current = financialByClient.get(charge.clientId) || { billed: 0, paid: 0, pending: 0, overdue: 0, chargeCount: 0, invoiceUrl: null };
    current.billed += charge.amount;
    current.chargeCount += 1;
    if (charge.status === "PAID") current.paid += charge.amount;
    else if (charge.status === "OVERDUE") current.overdue += charge.amount;
    else current.pending += charge.amount;
    current.invoiceUrl ||= charge.asaasInvoiceUrl;
    financialByClient.set(charge.clientId, current);
  });

  const activeRecurring = services.filter((service) => service.type === "RECURRING" && service.status === "IN_PROGRESS");
  const contractedByClient = new Map<string, number>();
  activeRecurring.forEach((service) => contractedByClient.set(service.clientId, (contractedByClient.get(service.clientId) || 0) + (service.monthlyValue || 0)));
  const enrichedServices = services.map((service) => {
    const financial = financialByClient.get(service.clientId) || { billed: 0, paid: 0, pending: 0, overdue: 0, chargeCount: 0, invoiceUrl: null };
    const contracted = contractedByClient.get(service.clientId) || 0;
    const status = financial.overdue > 0 ? "OVERDUE" : financial.pending > 0 ? "PENDING" : financial.paid > 0 ? "PAID" : "NOT_FOUND";
    return {
      ...service,
      asaas: { ...financial, status, contracted, difference: financial.billed - contracted },
    };
  });

  const contracted = activeRecurring.reduce((sum, service) => sum + (service.monthlyValue || 0), 0);
  const billed = charges.reduce((sum, charge) => sum + charge.amount, 0);
  const paid = charges.filter((charge) => charge.status === "PAID").reduce((sum, charge) => sum + charge.amount, 0);
  const pending = charges.filter((charge) => charge.status === "PENDING").reduce((sum, charge) => sum + charge.amount, 0);
  const overdue = charges.filter((charge) => charge.status === "OVERDUE").reduce((sum, charge) => sum + charge.amount, 0);
  const discrepancies = Array.from(contractedByClient.entries()).filter(([clientId, value]) => Math.abs((financialByClient.get(clientId)?.billed || 0) - value) >= 0.01).length;

  return NextResponse.json({
    services: await withMedia(enrichedServices),
    period: { month, year },
    asaasSummary: { contracted, billed, paid, pending, overdue, discrepancies },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const data: Record<string, unknown> = {
    type: body.type,
    clientId: body.clientId,
  };

  if (body.type === "RECURRING") {
    data.name = body.name;
    data.contractMonths = body.contractMonths ? parseInt(body.contractMonths) : null;
    data.monthlyValue = body.monthlyValue ? parseFloat(body.monthlyValue) : null;
    data.startDate = body.startDate ? new Date(body.startDate) : null;
    data.metaAds = body.metaAds || false;
    data.googleAds = body.googleAds || false;
    data.deliveriesPerWeek = body.deliveriesPerWeek ? parseInt(body.deliveriesPerWeek) : null;
    data.deliveryTypes = body.deliveryTypes || [];

    if (body.startDate && body.contractMonths) {
      const start = new Date(body.startDate);
      start.setMonth(start.getMonth() + parseInt(body.contractMonths));
      data.nextRenewal = start;
    }
  } else {
    data.freelancerType = body.freelancerType || null;
    data.freelancerTypeCustom = body.freelancerTypeCustom || null;
    data.totalValue = body.totalValue ? parseFloat(body.totalValue) : null;
    data.paymentMethod = body.paymentMethod || null;
    data.installments = body.installments ? parseInt(body.installments) : null;
    data.status = body.status || "IN_PROGRESS";
    data.dataPrimeiraParcela = body.dataPrimeiraParcela ? new Date(body.dataPrimeiraParcela) : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = await prisma.service.create({
    data: data as any,
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(await withMedia(service), { status: 201 });
}
