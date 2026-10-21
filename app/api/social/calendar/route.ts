import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { socialAuth, failure, SocialError } from "@/lib/social/core";
import { editorialFilter } from "@/lib/social/query";
export async function GET(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const q = new URL(req.url).searchParams;
    if (!q.get("month")) throw new SocialError("Selecione o mês.");
    const where = await editorialFilter(q);
    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        take: 2000,
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          clientId: true,
          caption: true,
          format: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
          seriesId: true,
          client: { select: { name: true } },
          account: { select: { id: true, name: true, provider: true } },
        },
      }),
      prisma.socialPost.count({ where }),
    ]);
    return NextResponse.json({ posts, total, truncated: total > posts.length });
  } catch (e) {
    return failure(e);
  }
}
