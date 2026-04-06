import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const where: Record<string, unknown> = { year };
  if (clientId) where.clientId = clientId;

  const scores = await prisma.clientHealthScore.findMany({
    where,
    include: { client: { select: { id: true, name: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const history = scores.map((s) => {
    const churnAvg = (s.satisfactionDelivery + s.serviceQuality + s.deadlineCompliance + s.perceivedResult + s.npsScore) / 5;
    const qualityAvg = (s.respondsTimely + s.changeVolume + s.complaints + s.outOfScope + s.financiallyWorth) / 5;
    return {
      clientId: s.clientId,
      clientName: s.client.name,
      month: s.month,
      year: s.year,
      label: `${monthNames[s.month - 1]}`,
      churnAvg: Math.round(churnAvg * 10) / 10,
      qualityAvg: Math.round(qualityAvg * 10) / 10,
      npsScore: s.npsScore,
    };
  });

  return NextResponse.json(history);
}
