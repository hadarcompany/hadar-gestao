import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SocialError } from "./core";
import { removeMedia } from "./storage";

// This lock is shared by reservations, final verification and post attachment.
export async function lockAvailableAssets(
  tx: Prisma.TransactionClient,
  ids: string[],
  clientId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(197632084)`;
  const available = await tx.socialAsset.count({
    where: {
      id: { in: ids },
      clientId,
      state: "AVAILABLE",
      verifiedAt: { not: null },
    },
  });
  if (available !== ids.length)
    throw new SocialError(
      "Uma mídia não está mais disponível. Atualize a publicação.",
      409,
    );
}

export async function cleanSocialMedia() {
  if (process.env.SOCIAL_MEDIA_CLEANUP_ENABLED !== "true")
    return { removed: 0 };
  const now = Date.now(),
    cutoff = new Date(now - 48 * 3600000);
  // Query eligibility in SQL so retained drafts cannot starve the cleanup queue.
  const candidates = await prisma.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM public.social_assets a
    WHERE a.state = 'DELETING' OR
      (a.state = 'UPLOADING' AND a."createdAt" < ${new Date(now - 24 * 3600000)}) OR
      (a.state = 'AVAILABLE' AND NOT EXISTS (
        SELECT 1 FROM public.social_series s WHERE s.active AND a.id=ANY(s."assetIds")
      ) AND EXISTS (
        SELECT 1 FROM public.social_posts p WHERE (p.media @> jsonb_build_array(jsonb_build_object('id', a.id)) OR p.options->>'coverAssetId'=a.id) AND p.status='PUBLISHED'
      ) AND NOT EXISTS (
        SELECT 1 FROM public.social_posts p WHERE (p.media @> jsonb_build_array(jsonb_build_object('id', a.id)) OR p.options->>'coverAssetId'=a.id)
        AND p.status <> 'CANCELLED' AND (p.status <> 'PUBLISHED' OR p."publishedAt" IS NULL OR p."publishedAt" > ${cutoff})
      ))
    ORDER BY a."createdAt" ASC LIMIT 2`;
  let removed = 0;
  for (const candidate of candidates) {
    const asset = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(197632084)`;
      const current = await tx.socialAsset.findUnique({
        where: { id: candidate.id },
      });
      if (!current || current.state === "DELETED") return null;
      if (current.state !== "DELETING") {
        if (
          await tx.socialSeries.count({
            where: { active: true, assetIds: { has: current.id } },
          })
        )
          return null;
        const references = await tx.socialPost.findMany({
          where: {
            OR: [
              { media: { array_contains: [{ id: current.id }] } },
              { options: { path: ["coverAssetId"], equals: current.id } },
            ],
          },
          select: { status: true, publishedAt: true },
        });
        const abandoned =
          current.state === "UPLOADING" &&
          current.createdAt.getTime() < now - 24 * 3600000 &&
          !references.length;
        const published =
          references.some((p) => p.status === "PUBLISHED") &&
          references.every(
            (p) =>
              p.status === "CANCELLED" ||
              (p.status === "PUBLISHED" &&
                p.publishedAt &&
                p.publishedAt <= cutoff),
          );
        if (!abandoned && !published) return null;
        await tx.socialAsset.update({
          where: { id: current.id },
          data: { state: "DELETING" },
        });
      }
      return current;
    });
    if (!asset) continue;
    try {
      await removeMedia(asset);
      await prisma.socialAsset.updateMany({
        where: { id: asset.id, state: "DELETING" },
        data: { state: "DELETED", reservedBytes: 0, deletedAt: new Date() },
      });
      removed++;
    } catch {
      // Retry the physical deletion next minute; a failed delete never frees quota.
    }
  }
  return { removed };
}
