import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { socialAuth, failure, requireClient } from "@/lib/social/core";
import { createEditorial } from "@/lib/social/editorial";
import { editorialFilter } from "@/lib/social/query";
export async function GET(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const q = new URL(req.url).searchParams,
      where = await editorialFilter(q);
    const page = Math.max(
      0,
      Math.min(10000, Math.floor(Number(q.get("page")) || 0)),
    );
    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        skip: page * 50,
        take: 50,
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          clientId: true,
          caption: true,
          format: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          publishStartedAt: true,
          externalPostId: true,
          lastError: true,
          afterPublishError: true,
          createdAt: true,
          approvedAt: true,
          seriesId: true,
          client: { select: { name: true } },
          account: { select: { id: true, provider: true, name: true } },
        },
      }),
      prisma.socialPost.count({ where }),
    ]);
    return NextResponse.json({ posts, total });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const body = await req.json(),
      clientId = await requireClient(body.clientId);
    return NextResponse.json(
      await createEditorial(body, clientId, access.auth!),
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
