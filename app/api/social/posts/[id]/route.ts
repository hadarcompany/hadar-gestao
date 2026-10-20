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
      },
    });
    if (!post) throw new SocialError("Publicação não encontrada.", 404);
    const media = await Promise.all(
      (post.media as SocialMedia[]).map(async (asset) => ({
        id: asset.id,
        name: asset.name,
        mime: asset.mime,
        bytes: asset.bytes,
        previewUrl: await signedMedia(asset),
      })),
    );
    return NextResponse.json({ ...post, media });
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
      if (!["DRAFT", "PENDING_APPROVAL"].includes(body.status))
        throw new SocialError("Salve como rascunho ou envie para aprovação.");
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
        assets.some((a) => !a.verifiedAt)
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
        format = String(body.format);
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
      await verifyAssets(media);
      const scheduledAt = body.scheduledAt
        ? scheduledDate(body.scheduledAt)
        : null;
      const changed = await prisma.socialPost.updateMany({
        where: { id, status: post.status, publishStartedAt: null },
        data: {
          caption,
          format,
          media,
          status: body.status,
          scheduledAt,
          nextAttemptAt: null,
          approvedAt: null,
          approvedById: null,
          progress: Prisma.DbNull,
          lastError: null,
        },
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
    } else if (body.action === "schedule") {
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
      const scheduledAt = scheduledDate(body.scheduledAt);
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
