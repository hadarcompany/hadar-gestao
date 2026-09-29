import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canView } from "@/lib/permissions";
import { getMetaAccessToken, metaGraphAll } from "@/lib/meta/graph";
import { prisma } from "@/lib/prisma";

interface CampaignPayload {
  id: string; name?: string; status?: string; effective_status?: string; objective?: string;
  daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string;
}
interface ActionMetric { action_type?: string; value?: string }
interface InsightPayload {
  campaign_id?: string; campaign_name?: string; impressions?: string; reach?: string; clicks?: string;
  spend?: string; cpc?: string; cpm?: string; ctr?: string; frequency?: string;
  actions?: ActionMetric[]; action_values?: ActionMetric[];
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const number = (value?: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
function actionValue(actions: ActionMetric[] | undefined, types: string[]) {
  return (actions ?? []).filter((item) => types.includes(item.action_type ?? "")).reduce((sum, item) => sum + number(item.value), 0);
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "meta-ads")) return NextResponse.json({ error: "Sem acesso ao Meta Ads." }, { status: 403 });
  const accountId = req.nextUrl.searchParams.get("accountId");
  const since = req.nextUrl.searchParams.get("since");
  const until = req.nextUrl.searchParams.get("until");
  if (!accountId || !since || !until || !isoDate.test(since) || !isoDate.test(until)) {
    return NextResponse.json({ error: "Conta e período são obrigatórios." }, { status: 400 });
  }
  const account = await prisma.metaAdAccount.findUnique({
    where: { id: accountId },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  try {
    const { token } = await getMetaAccessToken();
    const [campaigns, insights] = await Promise.all([
      metaGraphAll<CampaignPayload>(`${account.externalId}/campaigns`, token, {
        fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
        limit: "500",
      }),
      metaGraphAll<InsightPayload>(`${account.externalId}/insights`, token, {
        level: "campaign",
        fields: "campaign_id,campaign_name,impressions,reach,clicks,spend,cpc,cpm,ctr,frequency,actions,action_values",
        time_range: JSON.stringify({ since, until }),
        limit: "500",
      }),
    ]);
    const byCampaign = new Map(insights.map((item) => [item.campaign_id, item]));
    const rows = campaigns.map((campaign) => {
      const insight = byCampaign.get(campaign.id);
      const leads = actionValue(insight?.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
      const purchases = actionValue(insight?.actions, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
      const purchaseValue = actionValue(insight?.action_values, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
      const spend = number(insight?.spend);
      return {
        id: campaign.id,
        name: campaign.name || insight?.campaign_name || campaign.id,
        status: campaign.status ?? "UNKNOWN",
        effectiveStatus: campaign.effective_status ?? campaign.status ?? "UNKNOWN",
        objective: campaign.objective ?? null,
        dailyBudget: campaign.daily_budget ? number(campaign.daily_budget) / 100 : null,
        lifetimeBudget: campaign.lifetime_budget ? number(campaign.lifetime_budget) / 100 : null,
        startTime: campaign.start_time ?? null,
        stopTime: campaign.stop_time ?? null,
        impressions: number(insight?.impressions), reach: number(insight?.reach), clicks: number(insight?.clicks),
        spend, cpc: number(insight?.cpc), cpm: number(insight?.cpm), ctr: number(insight?.ctr), frequency: number(insight?.frequency),
        leads, costPerLead: leads > 0 ? spend / leads : null,
        purchases, purchaseValue, roas: spend > 0 ? purchaseValue / spend : null,
      };
    }).sort((a, b) => b.spend - a.spend);
    const totals = rows.reduce((sum, item) => ({
      spend: sum.spend + item.spend,
      impressions: sum.impressions + item.impressions,
      reach: sum.reach + item.reach,
      clicks: sum.clicks + item.clicks,
      leads: sum.leads + item.leads,
      purchases: sum.purchases + item.purchases,
      purchaseValue: sum.purchaseValue + item.purchaseValue,
    }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, purchases: 0, purchaseValue: 0 });
    return NextResponse.json({ account, since, until, rows, totals: {
      ...totals,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
      roas: totals.spend > 0 ? totals.purchaseValue / totals.spend : null,
    } });
  } catch (error) {
    console.error("Meta campaigns error:", error);
    const expired = error instanceof Error && error.message === "META_TOKEN_EXPIRED";
    return NextResponse.json({ error: expired ? "A conexão da Meta expirou. Reconecte em Configurações." : "Não foi possível consultar as campanhas da Meta." }, { status: 502 });
  }
}
