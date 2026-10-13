import { NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { isAdmin } from "@/lib/permissions";
import { metaAppConfigured } from "@/lib/meta/graph";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/meta/status");
  if (denied) return denied;
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

export async function DELETE(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/meta/status");
  if (denied) return denied;
  if (!isAdmin(auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.metaConnection.deleteMany({ where: { id: "primary" } });
  return NextResponse.json({ disconnected: true });
}
