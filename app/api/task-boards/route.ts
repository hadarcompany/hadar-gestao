import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canView } from "@/lib/permissions";
import { applyMedia, loadMediaIndex } from "@/lib/media";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "tarefas")) return NextResponse.json({ error: "Sem acesso às tarefas." }, { status: 403 });

  const tasks = await prisma.task.findMany({
    where: { status: { not: "CANCELLED" } },
    select: {
      id: true, title: true, status: true, updatedAt: true,
      client: { select: { id: true, name: true } },
      board: { select: { updatedAt: true } },
    },
    orderBy: [{ board: { updatedAt: "desc" } }, { updatedAt: "desc" }],
    take: 150,
  });
  const media = await loadMediaIndex();
  return NextResponse.json(tasks.map((task) => ({
    ...task,
    client: task.client ? applyMedia(task.client, media, "client") : null,
  })));
}
