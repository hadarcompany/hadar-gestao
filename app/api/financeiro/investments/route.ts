import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  }

  const investments = await prisma.investment.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(investments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { description, amount, paymentMethod, installments, date, paidWithCash, autoCreateExpenses } = body;

  const totalAmount = parseFloat(amount);
  const numInstallments = installments ? parseInt(installments) : null;

  const investment = await prisma.investment.create({
    data: {
      description,
      amount: totalAmount,
      paymentMethod: paymentMethod || "A_VISTA",
      installments: numInstallments,
      date: new Date(date),
      paidWithCash: paidWithCash || false,
    },
  });

  // Auto-create variable expense entries in financeiro
  if (autoCreateExpenses) {
    const firstDate = new Date(date);
    const firstMonth = firstDate.getMonth() + 1;
    const firstYear = firstDate.getFullYear();

    if (paymentMethod === "PARCELADO" && numInstallments && numInstallments > 1) {
      const parcela = totalAmount / numInstallments;
      for (let i = 0; i < numInstallments; i++) {
        let m = firstMonth + i;
        let y = firstYear;
        while (m > 12) { m -= 12; y++; }
        await prisma.variableExpense.create({
          data: {
            name: `${description} (${i + 1}/${numInstallments})`,
            category: "OUTROS",
            amount: Math.round(parcela * 100) / 100,
            date: new Date(y, m - 1, firstDate.getDate()),
            month: m,
            year: y,
            paidWithCash: false,
          },
        });
      }
    } else {
      // À vista — cria uma entrada no mês do pagamento
      await prisma.variableExpense.create({
        data: {
          name: description,
          category: "OUTROS",
          amount: totalAmount,
          date: new Date(date),
          month: firstMonth,
          year: firstYear,
          paidWithCash: paidWithCash || false,
        },
      });
    }
  }

  if (paidWithCash) {
    await prisma.cashEntry.create({
      data: {
        type: "RETIRADA_DESPESA",
        amount: totalAmount,
        description: `Investimento: ${description}`,
      },
    });
  }

  return NextResponse.json(investment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.investment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
