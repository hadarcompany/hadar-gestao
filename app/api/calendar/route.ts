import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { getCalendarWeeks } from "@/lib/calendar";
import { getCurrentWeekRange } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || null;
  const anchor = searchParams.get("anchor") || getCurrentWeekRange().start;
  const count = Math.min(6, Math.max(1, parseInt(searchParams.get("count") || "4", 10)));

  const weeks = await getCalendarWeeks({ clientId, anchorWeekStart: anchor, count });
  return NextResponse.json({ weeks });
}
