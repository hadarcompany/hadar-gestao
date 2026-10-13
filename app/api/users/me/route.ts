import { NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";

/** Perfil do usuário logado. A foto vive aqui, e não no token de autenticação:
 * imagens são data URLs base64 e estourariam o limite de tamanho do cookie de sessão. */
export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/users/me");
  if (denied) return denied;

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { id: true, name: true, email: true, role: true, permissions: true },
  });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  return NextResponse.json(await withMedia(user, "user"));
}
