import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (clientId) where.clientId = clientId;

  const services = await prisma.service.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(await withMedia(services));
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
