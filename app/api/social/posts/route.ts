import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  socialAuth,
  failure,
  requireClient,
  SocialError,
  type Provider,
} from "@/lib/social/core";
import { scheduledDate, validateContent } from "@/lib/social/validation";
import { verifyAssets } from "@/lib/social/storage";
import { lockAvailableAssets } from "@/lib/social/media-retention";
export async function GET(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const query = new URL(req.url).searchParams,
      clientId = await requireClient(query.get("clientId"));
    const page = Math.max(
      0,
      Math.min(10000, Number(query.get("page") || 0) || 0),
    );
    const month = query.get("month");
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw new SocialError("Mês inválido.");
    const start = month ? new Date(`${month}-01T00:00:00-03:00`) : null;
    const end = start
      ? new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 3),
        )
      : null;
    const where = {
      clientId,
      ...(start && end
        ? {
            OR: [
              { scheduledAt: { gte: start, lt: end } },
              { scheduledAt: null, createdAt: { gte: start, lt: end } },
            ],
          }
        : {}),
    };
    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        skip: Math.floor(page) * 50,
        take: 50,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          caption: true,
          format: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          publishStartedAt: true,
          externalPostId: true,
          lastError: true,
          createdAt: true,
          approvedAt: true,
          account: { select: { id: true, provider: true, name: true } },
        },
      }),
      prisma.socialPost.count({ where }),
    ]);
    return NextResponse.json({ posts, total });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: Request) {
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const body = await req.json(),
      clientId = await requireClient(body.clientId);
    if (
      !Array.isArray(body.accountIds) ||
      !body.accountIds.length ||
      body.accountIds.length > 10 ||
      !body.accountIds.every((x: unknown) => typeof x === "string")
    )
      throw new SocialError("Selecione de 1 a 10 contas.");
    const ids = [...new Set<string>(body.accountIds)];
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: ids }, clientId, status: "CONNECTED" },
    });
    if (accounts.length !== ids.length)
      throw new SocialError(
        "Uma conta não pertence ao cliente ou precisa ser reconectada.",
        409,
      );
    if (
      !Array.isArray(body.assetIds) ||
      body.assetIds.length > 10 ||
      !body.assetIds.every((x: unknown) => typeof x === "string")
    )
      throw new SocialError("Mídias inválidas.");
    if (new Set(body.assetIds).size !== body.assetIds.length)
      throw new SocialError("Não repita a mesma mídia.");
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
    const caption = typeof body.caption === "string" ? body.caption.trim() : "",
      format = String(body.format);
    for (const account of accounts) {
      validateContent(account.provider as Provider, format, caption, media);
      if (
        format === "STORY" &&
        account.provider === "INSTAGRAM" &&
        account.accountType !== "BUSINESS"
      )
        throw new SocialError(
          "Stories precisam de uma conta Instagram Business.",
        );
    }
    await verifyAssets(media);
    if (!["DRAFT", "PENDING_APPROVAL"].includes(body.status))
      throw new SocialError("Salve como rascunho ou envie para aprovação.");
    const scheduledAt = body.scheduledAt
      ? scheduledDate(body.scheduledAt)
      : null;
    const created = await prisma.$transaction(async (tx) => {
      await lockAvailableAssets(tx, body.assetIds, clientId);
      return Promise.all(
        accounts.map((account) =>
          tx.socialPost.create({
            data: {
              clientId,
              accountId: account.id,
              caption,
              format,
              media,
              status: body.status,
              scheduledAt,
              createdById: access.auth!.id,
            },
            select: { id: true },
          }),
        ),
      );
    });
    return NextResponse.json({ posts: created }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
