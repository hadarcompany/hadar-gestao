import { NextResponse } from "next/server";
import { settings, socialAuth } from "@/lib/social/core";
import { prisma } from "@/lib/prisma";
export async function GET(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  const worker = await prisma.socialWorkerState.findUnique({
    where: { id: "primary" },
  });
  return NextResponse.json({
    instagram: !!(
      settings("INSTAGRAM", req.url).id &&
      settings("INSTAGRAM", req.url).secret &&
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
    ),
    facebook: !!(
      settings("FACEBOOK", req.url).id &&
      settings("FACEBOOK", req.url).secret &&
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
    ),
    publishingEnabled:
      process.env.SOCIAL_PUBLISHING_ENABLED === "true" &&
      !!worker &&
      worker.lastSeenAt.getTime() >= Date.now() - 10 * 60000,
  });
}
