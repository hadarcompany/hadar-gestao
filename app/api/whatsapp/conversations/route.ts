import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canView } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "pipeline")) return NextResponse.json({ error: "Sem acesso ao pipeline." }, { status: 403 });
  const conversations = await prisma.whatsAppConversation.findMany({
    include: { lead: { select: { id: true, name: true, stage: true } } },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
  return NextResponse.json(conversations);
}
