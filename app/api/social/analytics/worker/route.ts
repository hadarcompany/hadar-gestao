import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAnalyticsCollector } from "@/lib/social/analytics-collector";
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
    return NextResponse.json(await runAnalyticsCollector(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Falha na coleta de relatórios." },
      { status: 500 },
    );
  }
}
