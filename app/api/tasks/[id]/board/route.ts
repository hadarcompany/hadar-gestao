import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canView } from "@/lib/permissions";

type BoardElement = {
  id: string;
  type: "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  attachmentId?: string;
};

function validElements(value: unknown): value is BoardElement[] {
  if (!Array.isArray(value) || value.length > 250) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const element = item as Partial<BoardElement>;
    return typeof element.id === "string"
      && (element.type === "text" || element.type === "image")
      && [element.x, element.y, element.width, element.height].every((number) => typeof number === "number" && Number.isFinite(number))
      && (element.type !== "text" || typeof element.text === "string")
      && (element.type !== "image" || typeof element.attachmentId === "string");
  });
}

export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const { id } = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "tarefas")) return NextResponse.json({ error: "Sem acesso às tarefas." }, { status: 403 });

  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true, board: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json({ taskId: task.id, title: task.title, elements: task.board?.elements ?? [], updatedAt: task.board?.updatedAt ?? null });
}

export async function PUT(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const { id } = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "tarefas")) return NextResponse.json({ error: "Sem permissão para editar tarefas." }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!validElements(body?.elements)) return NextResponse.json({ error: "Elementos do quadro inválidos." }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });

  const board = await prisma.taskBoard.upsert({
    where: { taskId: id },
    create: { taskId: id, elements: body.elements as unknown as Prisma.InputJsonValue },
    update: { elements: body.elements as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ taskId: id, elements: board.elements, updatedAt: board.updatedAt });
}
