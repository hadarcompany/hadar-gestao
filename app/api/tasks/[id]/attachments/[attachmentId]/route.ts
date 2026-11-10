import { guardApiRequest } from "@/lib/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { isHeicImage, isPreviewableImage } from "@/lib/image-files";
import { heicToJpeg } from "@/lib/heic";
import { materialRead, parseMaterialReference } from "@/lib/materials/storage";

export const runtime = "nodejs";

/** Devolve o arquivo. Com ?inline=1, imagens seguras vão para exibição (prévia); o resto baixa. */
export async function GET(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/tasks/[id]/attachments/[attachmentId]", params.id);
  if (denied) return denied;

  const attachment = await prisma.taskAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment || attachment.taskId !== params.id) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const stored = parseMaterialReference(attachment.data);
  if (stored) {
    const upstream=await fetch(materialRead(stored),{cache:"no-store",redirect:"error",headers:req.headers.has("range")?{Range:req.headers.get("range")!}:{},signal:AbortSignal.timeout(45000)});
    if(!upstream.ok) return NextResponse.json({error:"Arquivo temporariamente indisponível."},{status:503});
    const inline=req.nextUrl.searchParams.get("inline")==="1" && ["image/jpeg","image/png","image/webp"].includes(attachment.mimeType);
    const name=encodeURIComponent(attachment.fileName);
    const headers:Record<string,string>={"Content-Type":inline?attachment.mimeType:"application/octet-stream","Content-Disposition":`${inline?"inline":"attachment"}; filename="${name}"; filename*=UTF-8''${name}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
    for(const key of ["content-length","content-range","accept-ranges"]) if(upstream.headers.has(key)) headers[key]=upstream.headers.get(key)!;
    return new NextResponse(upstream.body,{status:upstream.status,headers});
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
  const denied = await guardApiRequest(auth, _req, "/api/tasks/[id]/attachments/[attachmentId]", params.id);
  if (denied) return denied;

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
