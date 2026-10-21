import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  socialAuth,
  requireClient,
  failure,
  SocialError,
} from "@/lib/social/core";
import { requireScheduler } from "@/lib/social/editorial";
import { lockAvailableAssets } from "@/lib/social/media-retention";
import { isAdmin } from "@/lib/permissions";
export async function GET(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const clientId = await requireClient(
      new URL(req.url).searchParams.get("clientId"),
    );
    return NextResponse.json(
      await prisma.socialSeries.findMany({
        where: { clientId },
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          caption: true,
          format: true,
          weekdays: true,
          time: true,
          startDate: true,
          endDate: true,
          active: true,
          approvedAt: true,
          account: { select: { name: true, provider: true } },
        },
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    if (!isAdmin(access.auth!))
      throw new SocialError(
        "Apenas administradores controlam uma repetição.",
        403,
      );
    const body = await req.json(),
      clientId = await requireClient(body.clientId);
    const series = await prisma.socialSeries.findFirst({
      where: { id: String(body.id), clientId },
    });
    if (!series) throw new SocialError("Repetição não encontrada.", 404);
    if (body.action === "approve") await requireScheduler(access.auth!);
    else if (body.action !== "pause") throw new SocialError("Ação inválida.");
    await prisma.$transaction(async (tx) => {
      const valid = await tx.socialAccount.updateMany({
        where: {
          id: series.accountId,
          ...(body.action === "approve"
            ? {
                status: "CONNECTED",
                OR: [
                  { tokenExpiresAt: null },
                  { tokenExpiresAt: { gt: new Date() } },
                ],
              }
            : {}),
        },
        data: { updatedAt: new Date() },
      });
      if (!valid.count)
        throw new SocialError("Reconecte a conta antes de aprovar.", 409);
      const current = await tx.socialSeries.findUniqueOrThrow({
        where: { id: series.id },
      });
      if (body.action === "pause") {
        await tx.socialSeries.update({
          where: { id: series.id },
          data: { active: false },
        });
        await tx.socialPost.updateMany({
          where: {
            seriesId: series.id,
            publishStartedAt: null,
            status: { in: ["DRAFT", "PENDING_APPROVAL", "SCHEDULED"] },
          },
          data: { status: "CANCELLED" },
        });
      } else {
        if (!current.active)
          throw new SocialError(
            "Uma repetição pausada deve ser criada novamente para revisão.",
            409,
          );
        await lockAvailableAssets(tx, current.assetIds, clientId);
        const approvedAt = new Date();
        await tx.socialSeries.update({
          where: { id: series.id },
          data: { approvedAt, approvedById: access.auth!.id },
        });
        await tx.socialPost.updateMany({
          where: {
            seriesId: series.id,
            status: { in: ["DRAFT", "PENDING_APPROVAL"] },
            scheduledAt: { gte: new Date(Date.now() + 60000) },
          },
          data: {
            status: "SCHEDULED",
            approvedAt,
            approvedById: access.auth!.id,
          },
        });
        // Each occurrence has its own due date; do not collapse them into one time.
        await tx.$executeRaw`UPDATE social_posts SET "nextAttemptAt"="scheduledAt" WHERE "seriesId"=${series.id} AND status='SCHEDULED' AND "publishStartedAt" IS NULL`;
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
