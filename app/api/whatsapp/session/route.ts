import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canView, isAdmin } from "@/lib/permissions";
import { getWhatsAppProviderState, logoutWhatsAppProvider, startWhatsAppProvider, whatsappProvider, whatsappProviderConfigured } from "@/lib/whatsapp/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "pipeline")) return NextResponse.json({ error: "Sem acesso ao pipeline." }, { status: 403 });
  if (!whatsappProviderConfigured()) return NextResponse.json(await getWhatsAppProviderState());
  try {
    return NextResponse.json(await getWhatsAppProviderState());
  } catch {
    return NextResponse.json({ configured: true, status: "UNAVAILABLE", session: whatsappProvider() === "META_CLOUD" ? "meta-cloud" : "hadar", provider: whatsappProvider() });
  }
}

export async function POST() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(auth)) return NextResponse.json({ error: "Apenas administradores podem conectar o WhatsApp." }, { status: 403 });
  if (!whatsappProviderConfigured()) return NextResponse.json({ error: "O provedor de WhatsApp selecionado ainda não está configurado." }, { status: 503 });
  try {
    return NextResponse.json(await startWhatsAppProvider());
  } catch (error) {
    return NextResponse.json({ error: "Não foi possível iniciar a conexão com o WhatsApp.", detail: error instanceof Error ? error.message : "unknown" }, { status: 502 });
  }
}

export async function DELETE() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(auth)) return NextResponse.json({ error: "Apenas administradores podem desconectar o WhatsApp." }, { status: 403 });
  if (whatsappProvider() !== "WAHA") return NextResponse.json({ error: "A Cloud API deve ser desconectada pelas configurações da Meta." }, { status: 400 });
  try {
    await logoutWhatsAppProvider();
    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível desvincular o número." }, { status: 502 });
  }
}
