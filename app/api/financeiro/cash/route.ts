import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.cashEntry.findMany({
    orderBy: { date: "desc" },
  });

  // Calculate balance
  let balance = 0;
  for (const entry of entries) {
    if (entry.type === "RETIRADA_DESPESA") {
      balance -= entry.amount;
    } else {
      balance += entry.amount;
    }
  }

  // Get config
  let config = await prisma.cashConfig.findUnique({ where: { id: "singleton" } });
  if (!config) {
    config = await prisma.cashConfig.create({
      data: { id: "singleton", minBalance: 1000 },
    });
  }

  return NextResponse.json({ balance, entries, minBalance: config.minBalance });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, amount, description } = body;

  // Handle config update
  if (body.action === "updateConfig") {
    const config = await prisma.cashConfig.upsert({
      where: { id: "singleton" },
      update: { minBalance: parseFloat(body.minBalance) },
      create: { id: "singleton", minBalance: parseFloat(body.minBalance) },
    });
    return NextResponse.json(config);
  }

  const entry = await prisma.cashEntry.create({
    data: {
      type: type || "APORTE",
      amount: parseFloat(amount),
      description: description || null,
      date: new Date(),
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
