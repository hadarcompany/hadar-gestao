import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import {
  socialAuth,
  failure,
  requireClient,
  SocialError,
  type Provider,
} from "@/lib/social/core";
import { scheduledDate, validateContent } from "@/lib/social/validation";
import { verifyAssets, signedMedia } from "@/lib/social/storage";
import type { SocialMedia } from "@/lib/social/validation";
import { Prisma } from "@prisma/client";
import { lockAvailableAssets } from "@/lib/social/media-retention";
import { validateOptions, type SocialOptions } from "@/lib/social/options";
import { requireScheduler } from "@/lib/social/editorial";
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await socialAuth(req, "/api/social/posts/[id]");
  if (access.response) return access.response;
  try {
    const clientId = await requireClient(
      new URL(req.url).searchParams.get("clientId"),
    );
    const post = await prisma.socialPost.findFirst({
      where: { id: (await context.params).id, clientId },
      select: {
        id: true,
        accountId: true,
        caption: true,
        format: true,
        media: true,
        scheduledAt: true,
        status: true,
        options: true,
        seriesId: true,
      },
    });
    if (!post) throw new SocialError("Publicação não encontrada.", 404);
    const media = await Promise.all(
      (post.media as SocialMedia[]).map(async (asset) => ({
        id: asset.id,
        name: asset.name,
        mime: asset.mime,
        bytes: asset.bytes,
        previewUrl: await signedMedia(asset).catch((error) => {
          if (error instanceof SocialError && error.status === 410) return null;
          throw error;
        }),
      })),
    );
    const coverId = (post.options as SocialOptions).coverAssetId;
    const cover = coverId
      ? await prisma.socialAsset.findFirst({
          where: { id: coverId, clientId, state: "AVAILABLE" },
        })
      : null;
    return NextResponse.json({
      ...post,
      media,
      cover: cover
        ? {
            id: cover.id,
            name: cover.name,
            mime: cover.mime,
            bytes: cover.bytes,
            previewUrl: await signedMedia(cover),
          }
        : null,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await socialAuth(req, "/api/social/posts/[id]");
  if (access.response) return access.response;
  try {
    const { id } = await context.params,
      body = await req.json(),
      clientId = await requireClient(body.clientId);
    const post = await prisma.socialPost.findFirst({
      where: { id, clientId },
      include: { account: true },
    });
    if (!post) throw new SocialError("Publicação não encontrada.", 404);
    if (post.publishStartedAt)
      throw new SocialError(
        "A Meta já recebeu uma solicitação de publicação. Aguarde a confirmação e confira a rede social.",
        409,
      );
    if (
      ["PROCESSING", "PUBLISHED", "UNCERTAIN", "CANCELLED"].includes(
        post.status,
      )
    )
      throw new SocialError(
        "Esta publicação não pode mais ser alterada. Publicações incertas precisam de conferência na rede social.",
        409,
      );
    if (body.action === "edit") {
      if (!["DRAFT", "PENDING_APPROVAL", "SCHEDULED"].includes(body.status))
        throw new SocialError("Estado da publicação inválido.");
      if (body.status === "SCHEDULED") await requireScheduler(access.auth!);
      if (post.publishStartedAt)
        throw new SocialError("Confira a rede social antes de editar.", 409);
      if (
        !Array.isArray(body.assetIds) ||
        body.assetIds.length > 10 ||
        !body.assetIds.every((x: unknown) => typeof x === "string") ||
        new Set(body.assetIds).size !== body.assetIds.length
      )
        throw new SocialError("Mídias inválidas.");
      const assets = await prisma.socialAsset.findMany({
        where: { id: { in: body.assetIds }, clientId },
      });
      if (
        assets.length !== body.assetIds.length ||
        assets.some((a) => !a.verifiedAt || a.state !== "AVAILABLE")
      )
        throw new SocialError(
          "Uma mídia não pertence ao cliente ou o envio ainda não foi confirmado.",
          403,
        );
      const media = (body.assetIds as string[])
        .map((id) => assets.find((a) => a.id === id)!)
        .map(({ id, path, name, mime, bytes }) => ({
          id,
          path,
          name,
          mime,
          bytes,
        }));
      const caption =
          typeof body.caption === "string" ? body.caption.trim() : "",
        format =
          body.format === "POST" && media.length > 1
            ? "CAROUSEL"
            : String(body.format);
      const options = validateOptions(
        body.options,
        post.account.provider as Provider,
        format,
      );
      const covers = options.coverAssetId
        ? await prisma.socialAsset.findMany({
            where: {
              id: options.coverAssetId,
              clientId,
              mime: "image/jpeg",
              state: "AVAILABLE",
              verifiedAt: { not: null },
            },
          })
        : [];
      if (options.coverAssetId && covers.length !== 1)
        throw new SocialError("Capa inválida para este cliente.", 403);
      validateContent(
        post.account.provider as Provider,
        format,
        caption,
        media,
      );
      if (
        format === "STORY" &&
        post.account.provider === "INSTAGRAM" &&
        post.account.accountType !== "BUSINESS"
      )
        throw new SocialError("Stories precisam de Instagram Business.");
      await verifyAssets([...media, ...covers]);
      const scheduledAt =
        body.publishNow === true && body.status === "SCHEDULED"
          ? new Date()
          : body.scheduledAt
            ? scheduledDate(body.scheduledAt)
            : null;
      if (body.status === "SCHEDULED" && !scheduledAt)
        throw new SocialError("Selecione a data ou publique agora.");
      const changed = await prisma.$transaction(async (tx) => {
        const account = await tx.socialAccount.updateMany({
          where: { id: post.accountId, status: "CONNECTED" },
          data: { status: "CONNECTED" },
        });
        if (!account.count)
          throw new SocialError("Reconecte a conta antes de editar.", 409);
        await lockAvailableAssets(
          tx,
          [
            ...new Set([...body.assetIds, ...covers.map((c) => c.id)]),
          ] as string[],
          clientId,
        );
        return tx.socialPost.updateMany({
          where: { id, status: post.status, publishStartedAt: null },
          data: {
            caption,
            format,
            media,
            options: options as Prisma.InputJsonValue,
            status: body.status,
            scheduledAt,
            nextAttemptAt: body.status === "SCHEDULED" ? scheduledAt : null,
            approvedAt: body.status === "SCHEDULED" ? new Date() : null,
            approvedById: body.status === "SCHEDULED" ? access.auth!.id : null,
            progress: Prisma.DbNull,
            lastError: null,
          },
        });
      });
      if (!changed.count)
        throw new SocialError("A publicação mudou. Atualize a página.", 409);
    } else if (body.action === "cancel") {
      const changed = await prisma.socialPost.updateMany({
        where: { id, status: post.status },
        data: { status: "CANCELLED" },
      });
      if (!changed.count)
        throw new SocialError("A publicação mudou. Atualize a página.", 409);
    } else if (body.action === "schedule" || body.action === "publish_now") {
      if (!isAdmin(access.auth!))
        throw new SocialError("Apenas administradores aprovam e agendam.", 403);
      if (process.env.SOCIAL_PUBLISHING_ENABLED !== "true")
        throw new SocialError(
          "O agendador ainda precisa ser ativado pela Hadar após configurar a Meta.",
          503,
        );
      const worker = await prisma.socialWorkerState.findUnique({
        where: { id: "primary" },
      });
      if (!worker || worker.lastSeenAt.getTime() < Date.now() - 10 * 60000)
        throw new SocialError(
          "O agendador está sem comunicação. Peça à Hadar para verificar antes de agendar.",
          503,
        );
      if (
        post.account.status !== "CONNECTED" ||
        (post.account.tokenExpiresAt &&
          post.account.tokenExpiresAt <= new Date())
      )
        throw new SocialError("Reconecte a conta antes de agendar.", 409);
      if (post.publishStartedAt)
        throw new SocialError(
          "Confira a rede social antes de tentar novamente.",
          409,
        );
      const scheduledAt =
        body.action === "publish_now"
          ? new Date()
          : scheduledDate(body.scheduledAt);
      const result = await prisma.socialPost.updateMany({
        where: { id, status: post.status, publishStartedAt: null },
        data: {
          status: "SCHEDULED",
          scheduledAt,
          nextAttemptAt: scheduledAt,
          approvedById: access.auth!.id,
          approvedAt: new Date(),
          lastError: null,
        },
      });
      if (!result.count)
        throw new SocialError("A publicação mudou. Atualize a página.", 409);
    } else throw new SocialError("Ação inválida.");
    return NextResponse.json({ updated: true });
  } catch (error) {
    return failure(error);
  }
}
