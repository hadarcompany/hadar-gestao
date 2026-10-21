import type { SocialAccount, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { meta } from "./meta";
import { unseal } from "./core";
import { analyticsCall, readMetrics } from "./analytics-collector";
import {
  numeric,
  insightTotals,
  breakdownRows,
  emptyMedia,
  type Insight,
  type AccountReport,
  type MediaReport,
} from "./analytics-data";
export { numeric, insightTotals } from "./analytics-data";
export type { AccountReport, MediaReport } from "./analytics-data";
export async function accountReport(
  account: SocialAccount,
  start: Date,
  end: Date,
  live = true,
): Promise<AccountReport> {
  const rangeKey =
    "v2:" +
    start.toISOString().slice(0, 10) +
    ":" +
    end.toISOString().slice(0, 10);
  const cached = await prisma.socialReportSnapshot.findUnique({
    where: { accountId_rangeKey: { accountId: account.id, rangeKey } },
  });
  if (
    cached &&
    cached.fetchedAt.getTime() > Date.now() - 30 * 60000 &&
    (cached.data as { version?: number })?.version === 2
  )
    return cached.data as unknown as AccountReport;
  const result: AccountReport = {
    version: 2,
    id: account.id,
    name: account.name,
    provider: account.provider,
    fetchedAt: new Date().toISOString(),
    followers: null,
    mediaCount: null,
    reach: null,
    views: null,
    interactions: null,
    engaged: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    linkTaps: null,
    follows: null,
    unfollows: null,
    media: [],
    daily: [],
    demographics: { age: [], gender: [], city: [], country: [] },
    collection: { startedAt: null, lastCollectedAt: null, warning: null },
    partial: false,
    warning: null,
    insightsWarning: null,
  };
  const [state, days, media] = await Promise.all([
    prisma.socialAnalyticsState.findUnique({
      where: { accountId: account.id },
    }),
    prisma.socialMetricDay.findMany({
      where: {
        accountId: account.id,
        day: {
          gte: start.toISOString().slice(0, 10),
          lt: end.toISOString().slice(0, 10),
        },
      },
      orderBy: { day: "asc" },
    }),
    prisma.socialMediaMetric.findMany({
      where: { accountId: account.id, publishedAt: { gte: start, lt: end } },
      orderBy: { publishedAt: "desc" },
      take: 1001,
    }),
  ]);
  result.partial = media.length > 1000;
  result.media = media
    .slice(0, 1000)
    .map((m) => ({
      ...emptyMedia(m.externalId, m.channel as MediaReport["channel"]),
      ...(m.data as object),
      fetchedAt: m.fetchedAt?.toISOString() || null,
    }));
  result.daily = days.map((d) => ({
    day: d.day,
    followers: d.followers,
    follows: d.follows,
    unfollows: d.unfollows,
    capturedAt: d.capturedAt.toISOString(),
  }));
  result.collection = {
    startedAt: state?.startedAt.toISOString() || null,
    lastCollectedAt: state?.lastCollectedAt?.toISOString() || null,
    warning: state?.warning || null,
  };
  if (!live) {
    result.warning =
      "A atualização ao vivo atingiu o limite desta consulta. O histórico coletado está disponível; consulte este perfil novamente.";
    return result;
  }
  try {
    const token = unseal(account.tokenEncrypted);
    if (!/^\d+$/.test(account.externalId)) throw Error("InvalidAccount");
    try {
      const profile = await meta<{
        followers_count?: number;
        media_count?: number;
      }>(
        account.provider === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK",
        account.externalId,
        token,
        {
          fields:
            account.provider === "INSTAGRAM"
              ? "followers_count,media_count"
              : "followers_count",
        },
        "GET",
        8000,
      );
      result.followers = numeric(profile.followers_count);
      result.mediaCount = numeric(profile.media_count);
    } catch {
      result.warning =
        "Não foi possível atualizar os totais atuais do perfil. As outras métricas e o histórico foram consultados separadamente.";
    }
    if (account.provider === "INSTAGRAM") {
      const fields = {
        period: "day",
        metric_type: "total_value",
        since: String(Math.floor(start.getTime() / 1000)),
        until: String(
          Math.min(
            Math.floor(end.getTime() / 1000) - 1,
            Math.floor(Date.now() / 1000),
          ),
        ),
      };
      const values = await readMetrics(
        account.externalId + "/insights",
        token,
        [
          "reach",
          "views",
          "total_interactions",
          "accounts_engaged",
          "likes",
          "comments",
          "shares",
          "saves",
          "profile_links_taps",
        ],
        fields,
        { remaining: 10 },
      );
      const totals = insightTotals(values);
      for (const [field, metric] of Object.entries({
        reach: "reach",
        views: "views",
        interactions: "total_interactions",
        engaged: "accounts_engaged",
        likes: "likes",
        comments: "comments",
        shares: "shares",
        saves: "saves",
        linkTaps: "profile_links_taps",
      }))
        (result as unknown as Record<string, unknown>)[field] =
          totals[metric] ?? null;
      if (
        ["reach", "views", "total_interactions"].some(
          (m) => totals[m] === null || totals[m] === undefined,
        )
      )
        result.insightsWarning =
          "Algumas métricas não foram retornadas pela Meta. Elas podem depender das permissões, da elegibilidade e do período; não são substituídas por zero.";
      const flows = await readMetrics(
        account.externalId + "/insights",
        token,
        ["follows_and_unfollows"],
        { ...fields, breakdown: "follow_type" },
        { remaining: 1 },
      );
      const flowRows = breakdownRows(flows[0], "follow_type");
      result.follows =
        flowRows.find((x) => x.label === "FOLLOWER")?.value ?? null;
      result.unfollows =
        flowRows.find((x) => x.label === "NON_FOLLOWER")?.value ?? null;
      for (const dimension of ["gender", "age", "country", "city"] as const) {
        try {
          const data = await analyticsCall<{ data: Insight[] }>(
            account.externalId + "/insights",
            token,
            {
              metric: "follower_demographics",
              period: "lifetime",
              metric_type: "total_value",
              timeframe: "this_month",
              breakdown: dimension === "age" ? "age,gender" : dimension,
            },
          );
          result.demographics[dimension] = breakdownRows(
            data.data?.[0],
            dimension,
          );
        } catch {
          /* An unavailable demographic block cannot erase the other metrics. */
        }
      }
    } else
      result.insightsWarning =
        "Métricas avançadas do Facebook dependem da permissão read_insights, fora da conexão atual.";
  } catch {
    result.warning =
      "Não foi possível atualizar todos os dados da conta. Confira a conexão e as permissões na Meta. O histórico coletado permanece disponível.";
  }
  await prisma.socialReportSnapshot.upsert({
    where: { accountId_rangeKey: { accountId: account.id, rangeKey } },
    create: {
      accountId: account.id,
      rangeKey,
      data: result as unknown as Prisma.InputJsonValue,
    },
    update: {
      data: result as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
    },
  });
  await prisma.socialReportSnapshot.deleteMany({
    where: {
      accountId: account.id,
      fetchedAt: { lt: new Date(Date.now() - 90 * 86400000) },
    },
  });
  return result;
}
