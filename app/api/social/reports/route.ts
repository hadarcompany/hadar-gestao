import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  socialAuth,
  requireClient,
  failure,
  SocialError,
} from "@/lib/social/core";
import { dayDate } from "@/lib/social/schedule";
import { accountReport } from "@/lib/social/reports";
export const maxDuration = 300;
export async function GET(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const q = new URL(req.url).searchParams,
      clientId = await requireClient(q.get("clientId"));
    const start = new Date(dayDate(q.get("start")) + "T00:00:00-03:00"),
      end = new Date(
        new Date(dayDate(q.get("end")) + "T00:00:00-03:00").getTime() +
          86400000,
      );
    if (
      end <= start ||
      end.getTime() - start.getTime() > 30 * 86400000 ||
      end.getTime() > Date.now() + 86400000
    )
      throw new SocialError("Escolha um período de até 30 dias, até hoje.");
    const accounts = await prisma.socialAccount.findMany({
      where: { clientId, status: "CONNECTED" },
      take: 10,
      orderBy: { name: "asc" },
    });
    const reports = [];
    for (const a of accounts) reports.push(await accountReport(a, start, end));
    const editorial = await prisma.socialPost.groupBy({
      by: ["status"],
      where: {
        clientId,
        OR: [
          { scheduledAt: { gte: start, lt: end } },
          { scheduledAt: null, createdAt: { gte: start, lt: end } },
        ],
      },
      _count: { _all: true },
    });
    return NextResponse.json({
      reports,
      editorial,
      start,
      end,
      generatedAt: new Date(),
    });
  } catch (e) {
    return failure(e);
  }
}
