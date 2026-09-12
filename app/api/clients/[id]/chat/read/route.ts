import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.clientChatRead.upsert({
    where: { clientId_userId: { clientId: params.id, userId: auth.id } },
    update: { lastReadAt: new Date() },
    create: { clientId: params.id, userId: auth.id },
  });

  return NextResponse.json({ ok: true });
}
