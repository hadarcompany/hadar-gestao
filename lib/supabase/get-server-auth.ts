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

  const meta = user.app_metadata ?? {};
  // O e-mail é a fonte estável da identidade. O prisma_id gravado no token pode
  // ficar apontando para um usuário antigo depois de uma troca/recadastro.
  const dbUser = user.email
    ? await prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { id: true, name: true, role: true, permissions: true } })
    : null;

  return {
    id: dbUser?.id ?? (meta.prisma_id as string) ?? user.id,
    email: user.email!,
    name: dbUser?.name ?? (user.user_metadata?.name as string) ?? user.email!,
    role: dbUser?.role ?? (meta.role as string) ?? "MEMBER",
    // A foto não trafega no token: é base64 e estouraria o limite de tamanho do
    // cookie de sessão (494 no Vercel). Quem precisa dela busca em /api/users/me.
    image: null,
    permissions: (dbUser?.permissions as Record<string, string>) ?? (meta.permissions as Record<string, string>) ?? null,
  };
}
