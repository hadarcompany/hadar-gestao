import { NextResponse } from "next/server";
import type { AuthUser } from "@/types/auth";
import { prisma } from "./prisma";
import { canAccessApi, hasGlobalTaskAccess, validMutationOrigin } from "./api-policy";

export async function guardApiRequest(auth: AuthUser, req: Request, route: string, taskId?: string, database = prisma) {
  if (!validMutationOrigin(req) || !canAccessApi(auth, route, req.method, new URL(req.url).searchParams)) {
    return NextResponse.json({ error: "Sem permissão para esta operação." }, { status: 403 });
  }
  if (taskId && route.startsWith("/api/tasks/") && !hasGlobalTaskAccess(auth, req.method !== "GET" && req.method !== "HEAD")) {
    const task = await database.task.findFirst({
      where: { id: taskId, OR: [{ createdById: auth.id }, { assignees: { some: { userId: auth.id } } }] },
      select: { id: true },
    });
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }
  return null;
}
