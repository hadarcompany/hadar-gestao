import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { guardApiRequest } from "@/lib/api-guard";
import { canEdit } from "@/lib/permissions";
import { reconcileAsaasCharges } from "@/lib/asaas-reconciliation";
export const maxDuration = 60;
export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth)
    return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/asaas/reconcile");
  if (denied) return denied;
  if (!canEdit(auth, "financeiro"))
    return NextResponse.json(
      { error: "Sem permissão para sincronizar cobranças." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      await reconcileAsaasCharges({ force: true, limit: 100, budgetMs: 45000 }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conciliar as cobranças com o Asaas." },
      { status: 502 },
    );
  }
}
