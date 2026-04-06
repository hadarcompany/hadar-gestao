import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  const fields = [
    "name", "metaAds", "googleAds", "deliveryTypes", "freelancerType",
    "freelancerTypeCustom", "paymentMethod", "status",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  if (body.contractMonths !== undefined) data.contractMonths = parseInt(body.contractMonths);
  if (body.monthlyValue !== undefined) data.monthlyValue = parseFloat(body.monthlyValue);
  if (body.totalValue !== undefined) data.totalValue = parseFloat(body.totalValue);
  if (body.deliveriesPerWeek !== undefined) data.deliveriesPerWeek = parseInt(body.deliveriesPerWeek);
  if (body.installments !== undefined) data.installments = parseInt(body.installments);
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.dataPrimeiraParcela !== undefined) data.dataPrimeiraParcela = body.dataPrimeiraParcela ? new Date(body.dataPrimeiraParcela) : null;

  if (body.startDate && body.contractMonths) {
    const start = new Date(body.startDate);
    start.setMonth(start.getMonth() + parseInt(body.contractMonths));
    data.nextRenewal = start;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = await prisma.service.update({
    where: { id: params.id },
    data: data as any,
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(service);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.service.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
