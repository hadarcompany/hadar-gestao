import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runSocialWorker } from "@/lib/social/worker";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  const secret = process.env.SOCIAL_WORKER_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") || ""),
    expected = Buffer.from(`Bearer ${secret || ""}`);
  if (
    !secret ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    await prisma.socialWorkerState.upsert({
      where: { id: "primary" },
      create: { id: "primary", lastSeenAt: new Date(), status: "OK" },
      update: { lastSeenAt: new Date(), status: "OK" },
    });
    return NextResponse.json(await runSocialWorker(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Falha no agendador." }, { status: 500 });
  }
}
