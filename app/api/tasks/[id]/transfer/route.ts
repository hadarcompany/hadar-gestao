import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { transferTask } from "@/lib/task-transfer";

export async function POST(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const toUserIds: string[] = Array.isArray(body.toUserIds) ? body.toUserIds : [];
  if (toUserIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um responsável" }, { status: 400 });
  }

  try {
    const task = await transferTask({
      taskId: params.id,
      toUserIds,
      note: typeof body.note === "string" ? body.note : null,
      performedById: auth.id,
    });
    return NextResponse.json(task);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
    console.error("Erro ao transferir tarefa:", e);
    return NextResponse.json({ error: "Não foi possível transferir a tarefa" }, { status: 500 });
  }
}
