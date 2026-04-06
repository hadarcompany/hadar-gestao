import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/png";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const client = await prisma.client.update({
    where: { id: params.id },
    data: { logoUrl: dataUrl },
  });

  return NextResponse.json({ logoUrl: client.logoUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.client.update({
    where: { id: params.id },
    data: { logoUrl: null },
  });

  return NextResponse.json({ ok: true });
}
