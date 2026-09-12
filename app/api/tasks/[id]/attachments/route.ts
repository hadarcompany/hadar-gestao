import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB por arquivo

export async function POST(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "O arquivo deve ter no máximo 8MB" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = file.type || "application/octet-stream";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: params.id,
      fileName: file.name || "arquivo",
      mimeType,
      size: file.size,
      data: dataUrl,
      uploadedById: auth.id,
    },
    select: {
      id: true, fileName: true, mimeType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}

export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = await prisma.task.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId: params.id },
    select: {
      id: true, fileName: true, mimeType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(attachments);
}
