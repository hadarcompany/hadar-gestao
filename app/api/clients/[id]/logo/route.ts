import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { dataUrlResponse } from "@/lib/media";
import { isHeicImage } from "@/lib/image-files";
import { heicToJpeg } from "@/lib/heic";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  if (isHeicImage(file) && file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  let buffer: Buffer = Buffer.from(bytes);
  let mimeType = file.type || "image/png";
  if (isHeicImage(file)) {
    try {
      buffer = await heicToJpeg(buffer);
      mimeType = "image/jpeg";
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
  }
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const client = await prisma.client.update({
    where: { id: params.id },
    data: { logoUrl: dataUrl },
  });

  return NextResponse.json({ logoUrl: client.logoUrl });
}

export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.client.update({
    where: { id: params.id },
    data: { logoUrl: null },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { logoUrl: true } });
  return dataUrlResponse(client?.logoUrl);
}
