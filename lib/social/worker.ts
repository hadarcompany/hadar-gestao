import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  publishJob,
  afterPublish,
  StillProcessing,
  PublicationUncertain,
} from "./publisher";
import { ProviderError } from "./meta";
import { SocialError } from "./core";
import { trialExpired } from "@/lib/instance-trial";

export async function runSocialWorker() {
  if (process.env.SOCIAL_PUBLISHING_ENABLED !== "true" || trialExpired())
    return { paused: true };
  await prisma.socialPost.updateMany({
    where: {
      status: "PUBLISHED",
      afterPublishState: "NONE",
      publishedAt: { lt: new Date(Date.now() - 15 * 60000) },
      OR: [
        { options: { path: ["firstComment"], string_contains: "" } },
        { options: { path: ["disableComments"], equals: true } },
      ],
    },
    data: {
      afterPublishState: "WARNING",
      afterPublishError:
        "O conteúdo foi publicado, mas a etapa adicional não confirmou sua execução. Confira os comentários na rede social.",
    },
  });
  // A crashed request may have reached Meta. Never reclaim it for another publish.
  await prisma.socialPost.updateMany({
    where: {
      status: "PUBLISHED",
      afterPublishState: "RUNNING",
      publishedAt: { lt: new Date(Date.now() - 15 * 60000) },
    },
    data: {
      afterPublishState: "WARNING",
      afterPublishError:
        "A etapa de comentários foi interrompida. Confira na rede social antes de repetir manualmente.",
    },
  });
  await prisma.socialPost.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: new Date(Date.now() - 15 * 60000) },
    },
    data: {
      status: "UNCERTAIN",
      lastError:
        "O processamento foi interrompido. Confira a rede social antes de publicar novamente.",
      lockToken: null,
    },
  });
  const candidate = await prisma.socialPost.findFirst({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
  });
  if (!candidate) return { idle: true };
  const lockToken = randomUUID();
  const claimed = await prisma.$transaction(async (tx) => {
    // Account lock serializes disconnect and claiming a job for this account.
    const account = await tx.socialAccount.updateMany({
      where: { id: candidate.accountId, status: "CONNECTED" },
      data: { status: "CONNECTED" },
    });
    if (!account.count) {
      await tx.socialPost.updateMany({
        where: { id: candidate.id, status: "SCHEDULED" },
        data: {
          status: "FAILED",
          lastError: "Reconecte a conta e agende novamente.",
        },
      });
      return false;
    }
    const job = await tx.socialPost.updateMany({
      where: { id: candidate.id, status: "SCHEDULED" },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        lockToken,
        attempts: { increment: 1 },
      },
    });
    return job.count > 0;
  });
  if (!claimed) return { idle: true };
  const job = await prisma.socialPost.findUniqueOrThrow({
    where: { id: candidate.id },
    include: { account: true },
  });
  const where = { id: job.id, lockToken, status: "PROCESSING" };
  try {
    const externalPostId = await publishJob(job);
    const confirmed = await prisma.socialPost.updateMany({
      where,
      data: {
        status: "PUBLISHED",
        externalPostId,
        publishedAt: new Date(),
        lastError: null,
        lockToken: null,
        lockedAt: null,
      },
    });
    if (confirmed.count)
      await afterPublish(job, externalPostId).catch(() => {});
    return { published: 1 };
  } catch (error) {
    if (error instanceof StillProcessing) {
      await prisma.socialPost.updateMany({
        where,
        data: {
          status: "SCHEDULED",
          nextAttemptAt: new Date(Date.now() + 60000),
          lockToken: null,
          lockedAt: null,
        },
      });
      return { processing: 1 };
    }
    // Re-read the durable boundary; local state may predate the actual request.
    const latest = await prisma.socialPost.findUnique({
      where: { id: job.id },
      select: { publishStartedAt: true },
    });
    const uncertain =
      error instanceof PublicationUncertain || !!latest?.publishStartedAt;
    if (error instanceof ProviderError && [190, 401].includes(error.code))
      await prisma.socialAccount.update({
        where: { id: job.accountId },
        data: { status: "RECONNECT_REQUIRED" },
      });
    await prisma.socialPost.updateMany({
      where,
      data: {
        status: uncertain ? "UNCERTAIN" : "FAILED",
        lastError: uncertain
          ? "A Meta pode ter publicado, mas não confirmou. Confira a conta antes de criar outra publicação."
          : error instanceof SocialError
            ? error.message
            : "Falha ao preparar a publicação. Confira a conexão e tente novamente.",
        lockToken: null,
        lockedAt: null,
      },
    });
    return { failed: 1, uncertain };
  }
}
