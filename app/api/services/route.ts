import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // Calculate next renewal
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

  const service = await prisma.service.create({
    data: data as any,
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  // Auto-generate receivables
  try {
    if (body.type === "RECURRING" && data.monthlyValue && data.contractMonths) {
      const months = data.contractMonths as number;
      const value = data.monthlyValue as number;
      const start = data.startDate ? new Date(data.startDate as Date) : new Date();
      const receivables = [];

      for (let i = 0; i < months; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i);
        receivables.push({
          amount: value,
          dueDate,
          month: dueDate.getMonth() + 1,
          year: dueDate.getFullYear(),
          clientId: body.clientId,
          status: "PENDING" as const,
        });
      }

      if (receivables.length > 0) {
        await prisma.receivable.createMany({ data: receivables });
      }
    } else if (body.type === "FREELANCER" && data.totalValue) {
      const total = data.totalValue as number;
      const installments = (data.installments as number) || 1;
      const perInstallment = total / installments;
      const firstDate = data.dataPrimeiraParcela
        ? new Date(data.dataPrimeiraParcela as Date)
        : new Date();
      const receivables = [];

      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        receivables.push({
          amount: Math.round(perInstallment * 100) / 100,
          dueDate,
          month: dueDate.getMonth() + 1,
          year: dueDate.getFullYear(),
          clientId: body.clientId,
          status: "PENDING" as const,
        });
      }

      if (receivables.length > 0) {
        await prisma.receivable.createMany({ data: receivables });
      }
    }
  } catch (e) {
    console.error("Error auto-generating receivables:", e);
  }

  return NextResponse.json(service, { status: 201 });
}
