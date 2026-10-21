import { randomUUID } from "node:crypto";
import type { SocialAccount, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unseal } from "./core";
import { meta, ProviderError } from "./meta";
import { trialExpired } from "@/lib/instance-trial";
import {
  emptyMedia,
  numeric,
  safeSocialUrl,
  parseMediaMetrics,
  breakdownRows,
  type Insight,
  type MediaReport,
} from "./analytics-data";

const json = (data: unknown) =>
  JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
const day = (date: Date) =>
  new Date(date.getTime() - 3 * 3600000).toISOString().slice(0, 10);
export const analyticsCall = <T>(
  path: string,
  token: string,
  fields: Record<string, string>,
) => meta<T>("INSTAGRAM", path, token, fields, "GET", 8000);
export async function readMetrics(
  path: string,
  token: string,
  metrics: string[],
  fields: Record<string, string>,
  budget = { remaining: 15 },
): Promise<Insight[]> {
  if (budget.remaining-- <= 0) return [];
  try {
    return (
      (
        await analyticsCall<{ data: Insight[] }>(path, token, {
          ...fields,
          metric: metrics.join(","),
        })
      ).data || []
    );
  } catch (e) {
    // Rate limits and expired authorization must not fan out into more requests.
    if (
      e instanceof ProviderError &&
      [4, 17, 32, 190, 401, 613].includes(e.code)
    )
      throw e;
    if (e instanceof ProviderError && e.code === 10) return [];
    if (metrics.length === 1) return [];
    const out: Insight[] = [];
    for (const metric of metrics) {
      if (budget.remaining <= 0) break;
      out.push(...(await readMetrics(path, token, [metric], fields, budget)));
    }
    return out;
  }
}
export async function discoverMedia(
  account: SocialAccount,
  token: string,
  pages = 5,
) {
  let partial = false,
    warning: string | null = null;
  for (const edge of ["stories", "media"]) {
    let after = "";
    try {
      for (let page = 0; page < (edge === "stories" ? 2 : pages); page++) {
        const list = await analyticsCall<{
          data: {
            id: string;
            caption?: string;
            media_type?: string;
            media_product_type?: string;
            permalink?: string;
            thumbnail_url?: string;
            media_url?: string;
            timestamp: string;
            like_count?: number;
            comments_count?: number;
          }[];
          paging?: { next?: string; cursors?: { after?: string } };
        }>(account.externalId + "/" + edge, token, {
          fields:
            "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count",
          limit: "100",
          ...(after ? { after } : {}),
        });
        for (const item of list.data || []) {
          if (
            !/^\d+$/.test(item.id) ||
            !Number.isFinite(new Date(item.timestamp).getTime())
          )
            continue;
          const channel: MediaReport["channel"] =
            edge === "stories"
              ? "STORY"
              : item.media_product_type === "REELS"
                ? "REEL"
                : "POST";
          const previous = await prisma.socialMediaMetric.findUnique({
            where: {
              accountId_externalId: {
                accountId: account.id,
                externalId: item.id,
              },
            },
          });
          const data = {
            ...emptyMedia(item.id, channel),
            ...((previous?.data as object) || {}),
            id: item.id,
            channel,
            caption: item.caption || "",
            type: item.media_type || "",
            timestamp: new Date(item.timestamp).toISOString(),
            permalink: safeSocialUrl(item.permalink),
            thumbnail: safeSocialUrl(
              item.thumbnail_url ||
                (item.media_type === "IMAGE" ? item.media_url : null),
              true,
            ),
            likes:
              numeric(item.like_count) ??
              (previous?.data as unknown as MediaReport | undefined)?.likes ??
              null,
            comments:
              numeric(item.comments_count) ??
              (previous?.data as unknown as MediaReport | undefined)
                ?.comments ??
              null,
          };
          await prisma.socialMediaMetric.upsert({
            where: {
              accountId_externalId: {
                accountId: account.id,
                externalId: item.id,
              },
            },
            create: {
              accountId: account.id,
              externalId: item.id,
              channel,
              publishedAt: new Date(item.timestamp),
              data: json(data),
            },
            update: { data: json(data) },
          });
        }
        if (!list.paging?.next) break;
        after = list.paging.cursors?.after || "";
        if (!after) {
          partial = true;
          break;
        }
        if (page === (edge === "stories" ? 1 : pages - 1)) partial = true;
      }
    } catch (e) {
      if (
        e instanceof ProviderError &&
        [190, 401, 4, 17, 32, 613].includes(e.code)
      )
        throw e;
      warning =
        "Parte das mídias não pôde ser atualizada. O histórico já coletado foi preservado.";
    }
  }
  return { partial, warning };
}
export async function collectAccountAnalytics(
  account: SocialAccount,
  feedLimit = 8,
) {
  if (account.provider !== "INSTAGRAM" || account.status !== "CONNECTED")
    return { skipped: true };
  // An empty-update Prisma upsert may become read-then-create. Duplicate creation
  // is harmless; the conditional update below is the exclusive lease boundary.
  await prisma.socialAnalyticsState.createMany({
    data: [{ accountId: account.id }],
    skipDuplicates: true,
  });
  const now = new Date(),
    lockToken = randomUUID();
  const claimed = await prisma.socialAnalyticsState.updateMany({
    where: {
      accountId: account.id,
      nextAttemptAt: { lte: now },
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(now.getTime() - 6 * 60000) } },
      ],
    },
    data: {
      lockedAt: now,
      lockToken,
      nextAttemptAt: new Date(now.getTime() + 15 * 60000),
    },
  });
  if (!claimed.count) return { skipped: true };
  let warning: string | null = null;
  try {
    const token = unseal(account.tokenEncrypted);
    const profile = await analyticsCall<{ followers_count?: number }>(
      account.externalId,
      token,
      { fields: "followers_count" },
    );
    const followers = numeric(profile.followers_count);
    if (followers !== null)
      await prisma.socialMetricDay.upsert({
        where: { accountId_day: { accountId: account.id, day: day(now) } },
        create: {
          accountId: account.id,
          day: day(now),
          followers,
          capturedAt: now,
        },
        update: { followers, capturedAt: now },
      });
    // Poll active stories every 15 minutes. Refresh a bounded set of feed metrics;
    // oldest attempted rows go first so accounts with many posts cannot starve.
    const discovered = await discoverMedia(account, token, 2);
    warning =
      discovered.warning ||
      (discovered.partial
        ? "A descoberta de mídias está limitada às 200 publicações recentes por ciclo."
        : null);
    const storyRows = await prisma.socialMediaMetric.findMany({
      where: {
        accountId: account.id,
        channel: "STORY",
        publishedAt: { gte: new Date(now.getTime() - 25 * 3600000) },
      },
      orderBy: [
        { attemptedAt: { sort: "asc", nulls: "first" } },
        { publishedAt: "asc" },
      ],
      take: 20,
    });
    const feedRows = await prisma.socialMediaMetric.findMany({
      where: {
        accountId: account.id,
        channel: { not: "STORY" },
        publishedAt: { gte: new Date(now.getTime() - 2 * 366 * 86400000) },
        OR: [
          { publishedAt: { gte: new Date(now.getTime() - 90 * 86400000) } },
          {
            fetchedAt: null,
            OR: [
              { attemptedAt: null },
              { attemptedAt: { lt: new Date(now.getTime() - 86400000) } },
            ],
          },
        ],
      },
      orderBy: { attemptedAt: { sort: "asc", nulls: "first" } },
      take: feedLimit,
    });
    const budget = { remaining: 24 };
    for (const row of [...storyRows, ...feedRows]) {
      if (budget.remaining <= 0) {
        warning =
          "A coleta continuará no próximo ciclo para respeitar os limites da Meta.";
        break;
      }
      const story = row.channel === "STORY";
      await prisma.socialMediaMetric.update({
        where: { id: row.id },
        data: { attemptedAt: new Date() },
      });
      const metrics = story
        ? [
            "views",
            "reach",
            "replies",
            "shares",
            "total_interactions",
            "follows",
            "profile_visits",
            "profile_activity",
          ]
        : [
            "views",
            "reach",
            "likes",
            "comments",
            "saved",
            "shares",
            "total_interactions",
          ];
      if (row.channel === "POST")
        metrics.push("follows", "profile_visits", "profile_activity");
      const values = await readMetrics(
        row.externalId + "/insights",
        token,
        metrics,
        {},
        budget,
      );
      if (story)
        values.push(
          ...(await readMetrics(
            row.externalId + "/insights",
            token,
            ["navigation"],
            { breakdown: "story_navigation_action_type" },
            budget,
          )),
        );
      if (!values.length) {
        warning =
          "Algumas métricas não estão disponíveis para todas as mídias. Dados anteriores foram preservados.";
        continue;
      }
      const parsed = parseMediaMetrics(
        values,
        row.channel as MediaReport["channel"],
      );
      const data = {
        ...(row.data as object),
        ...Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => value !== null),
        ),
        fetchedAt: new Date().toISOString(),
      };
      await prisma.socialMediaMetric.update({
        where: { id: row.id },
        data: { data: json(data), fetchedAt: new Date() },
      });
    }
    // Refresh late arrivals and backfill one older day per cycle. A missing value
    // gets a null row, so unavailable small-audience days cannot starve the queue.
    const knownDays = await prisma.socialMetricDay.findMany({
      where: {
        accountId: account.id,
        day: { gte: day(new Date(now.getTime() - 30 * 86400000)) },
      },
      select: { day: true },
    });
    const known = new Set(knownDays.map((d) => d.day));
    const missing = Array.from({ length: 28 }, (_, i) => i + 3).find(
      (offset) => !known.has(day(new Date(now.getTime() - offset * 86400000))),
    );
    for (const offset of [1, 2, ...(missing ? [missing] : [3])]) {
      const d = day(new Date(now.getTime() - offset * 86400000)),
        since = new Date(d + "T00:00:00-03:00");
      const values = await readMetrics(
        account.externalId + "/insights",
        token,
        ["follows_and_unfollows"],
        {
          period: "day",
          metric_type: "total_value",
          breakdown: "follow_type",
          since: String(since.getTime() / 1000),
          until: String(since.getTime() / 1000 + 86400 - 1),
        },
        { remaining: 1 },
      );
      const rows = breakdownRows(values[0], "follow_type");
      const follows = rows.find((x) => x.label === "FOLLOWER")?.value,
        unfollows = rows.find((x) => x.label === "NON_FOLLOWER")?.value;
      await prisma.socialMetricDay.upsert({
        where: { accountId_day: { accountId: account.id, day: d } },
        create: { accountId: account.id, day: d, follows, unfollows },
        update: {
          capturedAt: new Date(),
          ...(follows !== undefined ? { follows } : {}),
          ...(unfollows !== undefined ? { unfollows } : {}),
        },
      });
    }
    await prisma.socialAnalyticsState.updateMany({
      where: { accountId: account.id, lockToken },
      data: { lastCollectedAt: new Date(), warning },
    });
    return { collected: true };
  } catch (e) {
    warning =
      e instanceof ProviderError && [190, 401].includes(e.code)
        ? "Reconecte a conta para retomar a coleta de relatórios."
        : "A coleta não terminou. O histórico foi preservado e haverá nova tentativa.";
    await prisma.socialAnalyticsState.updateMany({
      where: { accountId: account.id, lockToken },
      data: { warning, nextAttemptAt: new Date(Date.now() + 30 * 60000) },
    });
    return { collected: false };
  } finally {
    await prisma.socialAnalyticsState.updateMany({
      where: { accountId: account.id, lockToken },
      data: { lockedAt: null, lockToken: null },
    });
  }
}
export async function runAnalyticsCollector() {
  if (trialExpired()) return { paused: true };
  const account = await prisma.socialAccount.findFirst({
    where: {
      provider: "INSTAGRAM",
      status: "CONNECTED",
      OR: [
        { analyticsState: null },
        {
          analyticsState: {
            nextAttemptAt: { lte: new Date() },
            OR: [
              { lockedAt: null },
              { lockedAt: { lt: new Date(Date.now() - 6 * 60000) } },
            ],
          },
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
  });
  return account ? collectAccountAnalytics(account) : { idle: true };
}
