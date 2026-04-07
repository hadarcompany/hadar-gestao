import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);

  const receivables = await prisma.receivable.findMany({
    where,
    include: { client: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(receivables);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientId, amount, dueDate, month, year } = body;

  const receivable = await prisma.receivable.create({
    data: {
      clientId,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      month: parseInt(month),
      year: parseInt(year),
    },
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(receivable, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.receivable.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, status, paidDate, ...rest } = body;

  const data: Record<string, unknown> = { ...rest };
  if (status) data.status = status;
  if (paidDate) data.paidDate = new Date(paidDate);
  if (status === "PENDING") data.paidDate = null;

  const receivable = await prisma.receivable.update({
    where: { id },
    data,
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(receivable);
}
