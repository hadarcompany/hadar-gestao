import { NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canView } from "@/lib/permissions";
import { getWhatsAppProviderQr, whatsappProvider } from "@/lib/whatsapp/provider";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return new NextResponse(null, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/whatsapp/qr");
  if (denied) return denied;
  if (!canView(auth, "pipeline")) return new NextResponse(null, { status: 403 });
  if (whatsappProvider() !== "WAHA") return new NextResponse(null, { status: 404 });
  try {
    const upstream = await getWhatsAppProviderQr();
    if (!upstream.ok) return new NextResponse(null, { status: upstream.status });
    return new NextResponse(await upstream.arrayBuffer(), {
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
