import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { isHeicImage } from "@/lib/image-files";
import { heicToJpeg } from "@/lib/heic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0 || !isHeicImage(file)) {
    return NextResponse.json({ error: "Selecione uma imagem HEIC ou HEIF válida." }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 2MB." }, { status: 400 });
  }

  try {
    const jpeg = await heicToJpeg(new Uint8Array(await file.arrayBuffer()));
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
