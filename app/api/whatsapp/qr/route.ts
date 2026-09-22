import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canView } from "@/lib/permissions";
import { getWhatsAppQr } from "@/lib/whatsapp/waha";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return new NextResponse(null, { status: 401 });
  if (!canView(auth, "pipeline")) return new NextResponse(null, { status: 403 });
  try {
    const upstream = await getWhatsAppQr();
    if (!upstream.ok) return new NextResponse(null, { status: upstream.status });
    return new NextResponse(await upstream.arrayBuffer(), {
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
