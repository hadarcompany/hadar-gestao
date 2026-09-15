import { createSupabaseServerClient } from "./server";
import type { AuthUser } from "@/types/auth";

export async function getServerAuth(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const meta = user.app_metadata ?? {};

  return {
    id: (meta.prisma_id as string) ?? user.id,
    email: user.email!,
    name: (user.user_metadata?.name as string) ?? user.email!,
    role: (meta.role as string) ?? "MEMBER",
    // A foto não trafega no token: é base64 e estouraria o limite de tamanho do
    // cookie de sessão (494 no Vercel). Quem precisa dela busca em /api/users/me.
    image: null,
    permissions: (meta.permissions as Record<string, string>) ?? null,
  };
}
