import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { isHeicImage, isPreviewableImage } from "@/lib/image-files";
import { heicToJpeg } from "@/lib/heic";

export const runtime = "nodejs";

/** Devolve o arquivo. Com ?inline=1, imagens seguras vão para exibição (prévia); o resto baixa. */
export async function GET(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.taskAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment || attachment.taskId !== params.id) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const base64 = attachment.data.split(",")[1] ?? "";
  let buffer: Buffer = Buffer.from(base64, "base64");
  const inline = new URL(req.url).searchParams.get("inline") === "1" && isPreviewableImage(attachment);
  let mimeType = attachment.mimeType;
  let fileName = attachment.fileName;
  // A prévia é JPEG para funcionar em todos os navegadores. O download preserva o HEIC original.
  if (inline && isHeicImage(attachment)) {
    try {
      buffer = await heicToJpeg(buffer);
      mimeType = "image/jpeg";
      fileName = fileName.replace(/\.(heic|heif)$/i, "") + ".jpg";
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 422 });
    }
  }
  const name = encodeURIComponent(fileName);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": inline ? mimeType : "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${name}`,
      "Cache-Control": inline ? "private, max-age=3600" : "private, no-store",
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
