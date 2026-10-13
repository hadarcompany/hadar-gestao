import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validMutationOrigin } from "@/lib/api-policy";

export async function POST(req: NextRequest) {
  if (!validMutationOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
