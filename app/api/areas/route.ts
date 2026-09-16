import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const areas = await prisma.taskArea.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  return NextResponse.json(areas);
}
