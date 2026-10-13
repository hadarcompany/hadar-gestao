import { NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/areas");
  if (denied) return denied;

  const areas = await prisma.taskArea.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  return NextResponse.json(areas);
}
