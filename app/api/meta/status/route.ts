import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { isAdmin } from "@/lib/permissions";
import { metaAppConfigured } from "@/lib/meta/graph";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [connection, accountCount] = await Promise.all([
    prisma.metaConnection.findUnique({
      where: { id: "primary" },
      select: { metaUserId: true, metaUserName: true, tokenExpiresAt: true, updatedAt: true },
    }),
    prisma.metaAdAccount.count(),
  ]);
  return NextResponse.json({
    configured: metaAppConfigured(),
    connected: Boolean(connection),
    connection,
    accountCount,
  });
}

export async function DELETE() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.metaConnection.deleteMany({ where: { id: "primary" } });
  return NextResponse.json({ disconnected: true });
}
