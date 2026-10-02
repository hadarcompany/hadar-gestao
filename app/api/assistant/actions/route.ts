import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { executeAction, publicAction } from "@/lib/assistant/actions";
import { AssistantError } from "@/lib/assistant/types";
import { checkAssistantOrigin } from "@/lib/assistant/http";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const actions = await prisma.assistantAction.findMany({ where: { run: { userId: auth.id } }, orderBy: { createdAt: "desc" }, take: 30 });
    return NextResponse.json(actions.flatMap((action) => { try { return [publicAction(action, auth)]; } catch { return []; } }), { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível carregar as ações. Confira a migração do assistente." }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    checkAssistantOrigin(req);
    const body = await req.json();
    if (typeof body.id !== "string" || body.id.length > 100 || typeof body.cancel !== "boolean" || Object.keys(body).some((key) => !["id", "cancel"].includes(key))) throw new AssistantError("Confirmação inválida.");
    return NextResponse.json(await executeAction(body.id, auth, body.cancel), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AssistantError ? error.message : "Não foi possível concluir a ação. Confira o registro antes de tentar novamente." }, { status: error instanceof AssistantError ? error.status : 500 });
  }
}
