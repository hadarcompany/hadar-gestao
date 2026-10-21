import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { occurrences } from "./schedule";
import { lockAvailableAssets } from "./media-retention";
import { trialExpired } from "@/lib/instance-trial";
export async function expandSocialSeries() {
  if (trialExpired()) return;
  const now = new Date();
  const series = await prisma.socialSeries.findMany({
    where: {
      active: true,
      account: { status: "CONNECTED" },
      OR: [
        { lastExpandedAt: null },
        { lastExpandedAt: { lt: new Date(Date.now() - 6 * 3600000) } },
      ],
    },
    orderBy: { lastExpandedAt: { sort: "asc", nulls: "first" } },
    take: 2,
  });
  for (const candidate of series)
    await prisma.$transaction(
      async (tx) => {
        const account = await tx.socialAccount.updateMany({
          where: { id: candidate.accountId, status: "CONNECTED" },
          data: { status: "CONNECTED" },
        });
        if (!account.count) return;
        const locked = await tx.socialSeries.updateMany({
          where: { id: candidate.id, active: true },
          data: { lastExpandedAt: now },
        });
        if (!locked.count) return;
        const item = await tx.socialSeries.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        if (item.endDate && new Date(`${item.endDate}T23:59:59-03:00`) < now) {
          await tx.socialSeries.update({
            where: { id: item.id },
            data: { active: false },
          });
          return;
        }
        await lockAvailableAssets(tx, item.assetIds, item.clientId);
        const dates = occurrences(
          {
            weekdays: item.weekdays,
            time: item.time,
            startDate: item.startDate,
            endDate: item.endDate,
          },
          now,
        );
        const approved = !!item.approvedAt && !!item.approvedById;
        await tx.socialPost.createMany({
          skipDuplicates: true,
          data: dates.map((date) => ({
            clientId: item.clientId,
            accountId: item.accountId,
            caption: item.caption,
            format: item.format,
            media: item.media as Prisma.InputJsonValue,
            options: item.options as Prisma.InputJsonValue,
            seriesId: item.id,
            occurrenceKey: date.toISOString(),
            scheduledAt: date,
            status: approved ? "SCHEDULED" : "PENDING_APPROVAL",
            nextAttemptAt: approved ? date : null,
            createdById: item.createdById,
            approvedAt: item.approvedAt,
            approvedById: item.approvedById,
          })),
        });
      },
      { timeout: 15000 },
    );
}
