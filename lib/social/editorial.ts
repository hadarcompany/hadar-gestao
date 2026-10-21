import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isAdmin } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";
import { SocialError, type Provider } from "./core";
import { validateContent, scheduledDate } from "./validation";
import { validateOptions } from "./options";
import { occurrences, validateRecurrence } from "./schedule";
import { verifyAssets } from "./storage";
import { lockAvailableAssets } from "./media-retention";

export async function requireScheduler(auth: AuthUser) {
  if (!isAdmin(auth))
    throw new SocialError(
      "Apenas administradores podem aprovar e agendar.",
      403,
    );
  const worker = await prisma.socialWorkerState.findUnique({
    where: { id: "primary" },
  });
  if (
    process.env.SOCIAL_PUBLISHING_ENABLED !== "true" ||
    !worker ||
    worker.lastSeenAt.getTime() < Date.now() - 600000
  )
    throw new SocialError(
      "O agendador ainda não foi ativado ou está sem comunicação. O conteúdo pode ser salvo para aprovação.",
      503,
    );
}
export async function createEditorial(
  body: Record<string, any>,
  clientId: string,
  auth: AuthUser,
) {
  const targets: { accountId: string; format: string; options?: unknown }[] =
    body.targets ||
    (Array.isArray(body.accountIds)
      ? body.accountIds.map((accountId: string) => ({
          accountId,
          format: String(body.format),
          options: body.options,
        }))
      : []);
  if (
    !Array.isArray(targets) ||
    !targets.length ||
    targets.length > 20 ||
    targets.some(
      (t) =>
        !t || typeof t.accountId !== "string" || typeof t.format !== "string",
    )
  )
    throw new SocialError("Selecione de 1 a 20 canais.");
  if (
    new Set(targets.map((t) => t.accountId + ":" + t.format)).size !==
    targets.length
  )
    throw new SocialError("Não repita o mesmo canal.");
  if (
    !Array.isArray(body.assetIds) ||
    body.assetIds.length > 10 ||
    body.assetIds.some((x: unknown) => typeof x !== "string") ||
    new Set(body.assetIds).size !== body.assetIds.length
  )
    throw new SocialError("Mídias inválidas.");
  if (!["DRAFT", "PENDING_APPROVAL", "SCHEDULED"].includes(body.status))
    throw new SocialError("Estado de publicação inválido.");
  if (body.status === "SCHEDULED") await requireScheduler(auth);
  const accountIds = [...new Set(targets.map((t) => t.accountId))];
  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: accountIds }, clientId, status: "CONNECTED" },
  });
  if (accounts.length !== accountIds.length)
    throw new SocialError(
      "Uma conta não pertence ao cliente ou precisa ser reconectada.",
      409,
    );
  const assets = await prisma.socialAsset.findMany({
    where: {
      id: { in: body.assetIds },
      clientId,
      state: "AVAILABLE",
      verifiedAt: { not: null },
    },
  });
  if (assets.length !== body.assetIds.length)
    throw new SocialError(
      "Uma mídia não pertence ao cliente ou ainda não foi confirmada.",
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
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const plans = targets.map((t) => {
    const account = accounts.find((a) => a.id === t.accountId)!;
    if (
      body.status === "SCHEDULED" &&
      account.tokenExpiresAt &&
      account.tokenExpiresAt <= new Date()
    )
      throw new SocialError("Reconecte a conta antes de agendar.", 409);
    const format =
      t.format === "POST" && media.length > 1 ? "CAROUSEL" : t.format;
    validateContent(account.provider as Provider, format, caption, media);
    if (
      format === "STORY" &&
      account.provider === "INSTAGRAM" &&
      account.accountType !== "BUSINESS"
    )
      throw new SocialError(
        "Stories precisam de uma conta Instagram Business.",
      );
    const options = validateOptions(
      t.options,
      account.provider as Provider,
      format,
    );
    return { account, format, options };
  });
  const covers = [
    ...new Set(
      plans.flatMap((p) =>
        p.options.coverAssetId ? [p.options.coverAssetId] : [],
      ),
    ),
  ];
  const coverAssets = await prisma.socialAsset.findMany({
    where: {
      id: { in: covers },
      clientId,
      mime: "image/jpeg",
      state: "AVAILABLE",
      verifiedAt: { not: null },
    },
  });
  if (covers.length !== coverAssets.length)
    throw new SocialError(
      "Uma capa não pertence ao cliente ou não é uma imagem confirmada.",
      403,
    );
  const allAssetIds = [...new Set([...body.assetIds, ...covers])] as string[];
  await verifyAssets([...assets, ...coverAssets]);
  const recurrence = validateRecurrence(body.recurrence);
  if (
    body.publishNow === true &&
    (body.status !== "SCHEDULED" || recurrence || body.scheduleDates?.length)
  )
    throw new SocialError(
      "Publicação imediata não usa repetição ou datas futuras.",
    );
  if (recurrence && body.scheduleDates?.length)
    throw new SocialError("Escolha datas manuais ou repetição semanal.");
  let dates: (Date | null)[];
  if (body.publishNow === true) {
    dates = [new Date()];
  } else if (recurrence) {
    const anchor = new Date(
      Math.max(
        Date.now(),
        new Date(`${recurrence.startDate}T00:00:00-03:00`).getTime(),
      ),
    );
    dates = occurrences(recurrence, anchor);
  } else if (body.scheduleDates !== undefined) {
    if (
      !Array.isArray(body.scheduleDates) ||
      !body.scheduleDates.length ||
      body.scheduleDates.length > 60
    )
      throw new SocialError("Selecione de 1 a 60 datas.");
    dates = [
      ...new Set(
        (body.scheduleDates as unknown[]).map((v) =>
          scheduledDate(v).toISOString(),
        ),
      ),
    ]
      .sort()
      .map((v) => new Date(v));
  } else dates = [body.scheduledAt ? scheduledDate(body.scheduledAt) : null];
  if (!dates.length)
    throw new SocialError("Não há datas futuras nessa repetição.");
  if (body.status === "SCHEDULED" && dates.some((d) => !d))
    throw new SocialError("Defina o horário antes de agendar.");
  if (dates.length * plans.length > 600)
    throw new SocialError(
      "Divida a programação em lotes de até 600 publicações.",
    );
  const approved =
    body.status === "SCHEDULED"
      ? { approvedAt: new Date(), approvedById: auth.id }
      : {};
  return prisma.$transaction(
    async (tx) => {
      // Stable account order matches disconnect/worker, then the shared media lock.
      for (const id of [...accountIds].sort()) {
        const valid = await tx.socialAccount.updateMany({
          where: { id, clientId, status: "CONNECTED" },
          data: { status: "CONNECTED" },
        });
        if (!valid.count)
          throw new SocialError(
            "Uma conta foi desconectada. Atualize a página.",
            409,
          );
      }
      await lockAvailableAssets(tx, allAssetIds, clientId);
      let created = 0;
      const seriesIds: string[] = [];
      for (const plan of plans) {
        let seriesId: string | null = null;
        if (recurrence) {
          const series = await tx.socialSeries.create({
            data: {
              clientId,
              accountId: plan.account.id,
              caption,
              format: plan.format,
              media,
              options: plan.options as Prisma.InputJsonValue,
              assetIds: [
                ...new Set([
                  ...(body.assetIds as string[]),
                  ...(plan.options.coverAssetId
                    ? [plan.options.coverAssetId]
                    : []),
                ]),
              ],
              weekdays: recurrence.weekdays,
              time: recurrence.time,
              startDate: recurrence.startDate,
              endDate: recurrence.endDate,
              createdById: auth.id,
              ...approved,
              lastExpandedAt: new Date(),
            },
          });
          seriesId = series.id;
          seriesIds.push(series.id);
        }
        const result = await tx.socialPost.createMany({
          data: dates.map((scheduledAt) => ({
            clientId,
            accountId: plan.account.id,
            caption,
            format: plan.format,
            media,
            options: plan.options as Prisma.InputJsonValue,
            status: body.status,
            scheduledAt,
            nextAttemptAt: body.status === "SCHEDULED" ? scheduledAt : null,
            createdById: auth.id,
            seriesId,
            occurrenceKey: seriesId ? scheduledAt!.toISOString() : null,
            ...approved,
          })),
        });
        created += result.count;
      }
      return { created, seriesIds };
    },
    { timeout: 20000 },
  );
}
