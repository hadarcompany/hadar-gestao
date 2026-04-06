import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scores = await prisma.clientHealthScore.findMany({
    where: { month, year },
    include: { client: { select: { id: true, name: true } } },
  });

  const clientScores = clients.map((client) => {
    const score = scores.find((s) => s.clientId === client.id);
    if (score) {
      const churnAvg = (
        score.satisfactionDelivery +
        score.serviceQuality +
        score.deadlineCompliance +
        score.perceivedResult +
        score.npsScore
      ) / 5;
      const qualityAvg = (
        score.respondsTimely +
        score.changeVolume +
        score.complaints +
        score.outOfScope +
        score.financiallyWorth
      ) / 5;
      return {
        clientId: client.id,
        clientName: client.name,
        hasScore: true,
        scoreId: score.id,
        churn: {
          satisfactionDelivery: score.satisfactionDelivery,
          serviceQuality: score.serviceQuality,
          deadlineCompliance: score.deadlineCompliance,
          perceivedResult: score.perceivedResult,
          npsScore: score.npsScore,
          avg: churnAvg,
        },
        quality: {
          respondsTimely: score.respondsTimely,
          changeVolume: score.changeVolume,
          complaints: score.complaints,
          outOfScope: score.outOfScope,
          financiallyWorth: score.financiallyWorth,
          avg: qualityAvg,
        },
        observations: score.observations,
      };
    }
    return {
      clientId: client.id,
      clientName: client.name,
      hasScore: false,
      scoreId: null,
      churn: { satisfactionDelivery: 0, serviceQuality: 0, deadlineCompliance: 0, perceivedResult: 0, npsScore: 0, avg: 0 },
      quality: { respondsTimely: 0, changeVolume: 0, complaints: 0, outOfScope: 0, financiallyWorth: 0, avg: 0 },
      observations: null,
    };
  });

  return NextResponse.json(clientScores);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    clientId, month, year,
    satisfactionDelivery, serviceQuality, deadlineCompliance, perceivedResult, npsScore,
    respondsTimely, changeVolume, complaints, outOfScope, financiallyWorth,
    observations,
  } = body;

  const score = await prisma.clientHealthScore.upsert({
    where: {
      clientId_month_year: { clientId, month: parseInt(month), year: parseInt(year) },
    },
    update: {
      satisfactionDelivery: parseFloat(satisfactionDelivery),
      serviceQuality: parseFloat(serviceQuality),
      deadlineCompliance: parseFloat(deadlineCompliance),
      perceivedResult: parseFloat(perceivedResult),
      npsScore: parseFloat(npsScore),
      respondsTimely: parseFloat(respondsTimely),
      changeVolume: parseFloat(changeVolume),
      complaints: parseFloat(complaints),
      outOfScope: parseFloat(outOfScope),
      financiallyWorth: parseFloat(financiallyWorth),
      observations: observations || null,
    },
    create: {
      clientId,
      month: parseInt(month),
      year: parseInt(year),
      satisfactionDelivery: parseFloat(satisfactionDelivery),
      serviceQuality: parseFloat(serviceQuality),
      deadlineCompliance: parseFloat(deadlineCompliance),
      perceivedResult: parseFloat(perceivedResult),
      npsScore: parseFloat(npsScore),
      respondsTimely: parseFloat(respondsTimely),
      changeVolume: parseFloat(changeVolume),
      complaints: parseFloat(complaints),
      outOfScope: parseFloat(outOfScope),
      financiallyWorth: parseFloat(financiallyWorth),
      observations: observations || null,
    },
  });

  return NextResponse.json(score, { status: 201 });
}
