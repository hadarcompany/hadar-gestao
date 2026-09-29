import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canView, isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { syncMetaAdAccounts } from "@/lib/meta/graph";
import { withMedia } from "@/lib/media";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "meta-ads")) return NextResponse.json({ error: "Sem acesso ao Meta Ads." }, { status: 403 });
  const accounts = await prisma.metaAdAccount.findMany({
    include: { client: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(await withMedia(accounts));
}

export async function POST() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const count = await syncMetaAdAccounts();
    return NextResponse.json({ synced: count });
  } catch (error) {
    const message = error instanceof Error && error.message === "META_TOKEN_EXPIRED"
      ? "A conexão expirou. Conecte novamente a conta Meta."
      : "Não foi possível sincronizar as contas de anúncios.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
