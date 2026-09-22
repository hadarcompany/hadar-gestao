import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canView, isAdmin } from "@/lib/permissions";
import { getWhatsAppSession, startWhatsAppSession, whatsappConfigured, whatsappSessionName } from "@/lib/whatsapp/waha";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "pipeline")) return NextResponse.json({ error: "Sem acesso ao pipeline." }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ configured: false, status: "NOT_CONFIGURED", session: whatsappSessionName() });
  try {
    const session = await getWhatsAppSession();
    return NextResponse.json({ configured: true, status: session?.status ?? "NOT_STARTED", session: whatsappSessionName(), me: session?.me ?? null });
  } catch {
    return NextResponse.json({ configured: true, status: "UNAVAILABLE", session: whatsappSessionName() });
  }
}

export async function POST() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(auth)) return NextResponse.json({ error: "Apenas administradores podem conectar o WhatsApp." }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ error: "Configure WAHA_API_BASE_URL e WAHA_API_KEY na Vercel." }, { status: 503 });
  try {
    const session = await startWhatsAppSession();
    return NextResponse.json({ configured: true, status: session?.status ?? "STARTING", session: whatsappSessionName() });
  } catch (error) {
    return NextResponse.json({ error: "Não foi possível iniciar a conexão com o WhatsApp.", detail: error instanceof Error ? error.message : "unknown" }, { status: 502 });
  }
}
