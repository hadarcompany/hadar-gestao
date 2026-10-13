import { createSupabaseServerClient } from "./server";
import type { AuthUser } from "@/types/auth";
import { prisma } from "@/lib/prisma";

export async function getServerAuth(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // O e-mail é a fonte estável da identidade. O prisma_id gravado no token pode
  // ficar apontando para um usuário antigo depois de uma troca/recadastro.
  const dbUser = user.email
    ? await prisma.user.findFirst({
        where: { email: { equals: user.email.trim(), mode: "insensitive" } },
        select: { id: true, name: true, email: true, role: true, permissions: true },
      })
    : null;

  // Nunca reutilize prisma_id do token quando há um e-mail autenticado. Esse
  // metadado pode ficar velho após recriar/trocar uma conta e foi justamente o
  // que fazia uma atualização de Alexandre ser gravada como Felipe.
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    // A foto não trafega no token: é base64 e estouraria o limite de tamanho do
    // cookie de sessão (494 no Vercel). Quem precisa dela busca em /api/users/me.
    image: null,
    permissions: (dbUser.permissions as Record<string, string>) ?? null,
  };
}
