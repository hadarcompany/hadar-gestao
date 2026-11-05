import { NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { withMedia } from "@/lib/media";

/** Perfil do usuário logado. A foto vive aqui, e não no token de autenticação:
 * imagens são data URLs base64 e estourariam o limite de tamanho do cookie de sessão. */
export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/users/me");
  if (denied) return denied;

  // getServerAuth already read the current account and permissions from the DB.
  return NextResponse.json(await withMedia(auth, "user"));
}
