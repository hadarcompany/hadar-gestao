import type { SocialAccount, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { meta } from "./meta";
import { unseal } from "./core";
export type MediaReport = {
  id: string;
  caption: string;
  type: string;
  permalink: string | null;
  timestamp: string;
  likes: number | null;
  comments: number | null;
};
export type AccountReport = {
  id: string;
  name: string;
  provider: string;
  fetchedAt: string;
  followers: number | null;
  mediaCount: number | null;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  media: MediaReport[];
  partial: boolean;
  warning: string | null;
  insightsWarning: string | null;
};
export const numeric = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export function insightTotals(
  data: { name: string; total_value?: { value?: number } }[],
) {
  return Object.fromEntries(
    data.map((m) => [m.name, numeric(m.total_value?.value)]),
  );
}
export async function accountReport(
  account: SocialAccount,
  start: Date,
  end: Date,
): Promise<AccountReport> {
  const rangeKey =
    start.toISOString().slice(0, 10) + ":" + end.toISOString().slice(0, 10);
  const cached = await prisma.socialReportSnapshot.findUnique({
    where: { accountId_rangeKey: { accountId: account.id, rangeKey } },
  });
  if (cached && cached.fetchedAt.getTime() > Date.now() - 30 * 60000)
    return cached.data as unknown as AccountReport;
  const result: AccountReport = {
    id: account.id,
    name: account.name,
    provider: account.provider,
    fetchedAt: new Date().toISOString(),
    followers: null,
    mediaCount: null,
    reach: null,
    views: null,
    interactions: null,
    media: [],
    partial: false,
    warning: null,
    insightsWarning: null,
  };
  try {
    const token = unseal(account.tokenEncrypted);
    if (!/^\d+$/.test(account.externalId)) throw Error("InvalidAccount");
    if (account.provider === "INSTAGRAM") {
      try {
        const profile = await meta<{
          followers_count?: number;
          media_count?: number;
        }>("INSTAGRAM", account.externalId, token, {
          fields: "followers_count,media_count",
        });
        result.followers = numeric(profile.followers_count);
        result.mediaCount = numeric(profile.media_count);
      } catch {
        result.warning =
          "Não foi possível atualizar os totais atuais do perfil. Confira as permissões na Meta.";
      }
      let after = "";
      try {
        for (let page = 0; page < 5; page++) {
          const list = await meta<{
            data: {
              id: string;
              caption?: string;
              media_type?: string;
              permalink?: string;
              timestamp: string;
              like_count?: number;
              comments_count?: number;
            }[];
            paging?: { next?: string; cursors?: { after?: string } };
          }>("INSTAGRAM", `${account.externalId}/media`, token, {
            fields:
              "id,caption,media_type,permalink,timestamp,like_count,comments_count",
            limit: "100",
            ...(after ? { after } : {}),
          });
          for (const m of list.data || []) {
            const date = new Date(m.timestamp);
            if (date < start || date >= end) continue;
            let permalink: string | null = null;
            try {
              const url = new URL(m.permalink || "");
              if (
                url.protocol === "https:" &&
                ["www.instagram.com", "instagram.com"].includes(url.hostname)
              )
                permalink = url.href;
            } catch {}
            result.media.push({
              id: m.id,
              caption: m.caption || "",
              type: m.media_type || "",
              timestamp: m.timestamp,
              permalink,
              likes: numeric(m.like_count),
              comments: numeric(m.comments_count),
            });
          }
          if (
            !list.paging?.next ||
            list.data.some((m) => new Date(m.timestamp) < start)
          )
            break;
          after = list.paging.cursors?.after || "";
          if (!after) break;
          if (page === 4) result.partial = true;
        }
      } catch {
        result.warning =
          "Não foi possível atualizar toda a lista de publicações. Confira a conexão e as permissões na Meta.";
      }
      // Missing or deprecated metrics remain null, never fabricated zeroes.
      for (const metric of ["reach", "views", "total_interactions"]) {
        try {
          const insights = await meta<{
            data: { name: string; total_value?: { value?: number } }[];
          }>("INSTAGRAM", `${account.externalId}/insights`, token, {
            metric,
            metric_type: "total_value",
            period: "day",
            since: String(Math.floor(start.getTime() / 1000)),
            until: String(Math.floor(end.getTime() / 1000)),
          });
          const value = insightTotals(insights.data || [])[metric];
          if (metric === "reach") result.reach = value ?? null;
          else if (metric === "views") result.views = value ?? null;
          else result.interactions = value ?? null;
        } catch {
          result.insightsWarning =
            "Algumas métricas não foram liberadas pela Meta. Autorize os relatórios e reconecte a conta. Contas novas ou períodos sem dados também podem não retornar métricas.";
        }
      }
    } else {
      const profile = await meta<{ followers_count?: number }>(
        "FACEBOOK",
        account.externalId,
        token,
        { fields: "followers_count" },
      );
      result.followers = numeric(profile.followers_count);
      result.insightsWarning =
        "Relatório avançado do Facebook depende da permissão read_insights. A conexão atual permite publicar; métricas indisponíveis não são estimadas.";
    }
  } catch {
    result.warning =
      "Não foi possível atualizar todos os dados dessa conta. Confira a conexão e as permissões na Meta.";
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
