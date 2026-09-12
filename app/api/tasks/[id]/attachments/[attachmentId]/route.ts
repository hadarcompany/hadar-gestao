import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";

/** Baixa o arquivo (decodifica o data URL e devolve como binário, não como JSON). */
export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.taskAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment || attachment.taskId !== params.id) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const base64 = attachment.data.split(",")[1] ?? "";
  const buffer = Buffer.from(base64, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.taskAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment || attachment.taskId !== params.id) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  if (attachment.uploadedById !== auth.id && !isAdmin(auth)) {
    return NextResponse.json({ error: "Apenas quem enviou o arquivo (ou um administrador) pode removê-lo" }, { status: 403 });
  }

  await prisma.taskAttachment.delete({ where: { id: params.attachmentId } });
  return NextResponse.json({ ok: true });
}
