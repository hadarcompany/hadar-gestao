// Shared report contract. Missing provider values stay null, including in totals.
export type Insight = {
  name: string;
  total_value?: { value?: number; breakdowns?: Breakdown[] };
  values?: { value: number | Record<string, number>; end_time?: string }[];
};
export type Breakdown = {
  dimension_keys?: string[];
  results?: { dimension_values: string[]; value: number }[];
};
export type Bucket = { label: string; value: number; gender?: string };
export type MediaReport = {
  id: string;
  caption: string;
  type: string;
  channel: "POST" | "REEL" | "STORY";
  permalink: string | null;
  thumbnail: string | null;
  timestamp: string;
  fetchedAt: string | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  follows: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
  replies: number | null;
  navigation: number | null;
  exits: number | null;
  back: number | null;
  forward: number | null;
  next: number | null;
};
export type DailyReport = {
  day: string;
  followers: number | null;
  follows: number | null;
  unfollows: number | null;
  capturedAt: string;
};
export type AccountReport = {
  version: 2;
  id: string;
  name: string;
  provider: string;
  fetchedAt: string;
  followers: number | null;
  mediaCount: number | null;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  engaged: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkTaps: number | null;
  follows: number | null;
  unfollows: number | null;
  media: MediaReport[];
  daily: DailyReport[];
  demographics: {
    gender: Bucket[];
    age: Bucket[];
    city: Bucket[];
    country: Bucket[];
  };
  collection: {
    startedAt: string | null;
    lastCollectedAt: string | null;
    warning: string | null;
  };
  partial: boolean;
  warning: string | null;
  insightsWarning: string | null;
};
export const numeric = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
export function insightTotals(data: Insight[]) {
  return Object.fromEntries(
    data.map((m) => [m.name, numeric(m.total_value?.value)]),
  );
}
export function metricValue(m: Insight | undefined) {
  return numeric(m?.total_value?.value ?? m?.values?.[0]?.value);
}
export function breakdownRows(
  metric: Insight | undefined,
  dimension: string,
): Bucket[] {
  const out: Bucket[] = [];
  for (const b of metric?.total_value?.breakdowns || []) {
    const index = b.dimension_keys?.indexOf(dimension) ?? -1;
    if (index < 0) continue;
    const gender = b.dimension_keys?.indexOf("gender") ?? -1;
    for (const r of b.results || [])
      if (numeric(r.value) !== null && r.dimension_values[index])
        out.push({
          label: r.dimension_values[index],
          value: r.value,
          ...(gender >= 0 ? { gender: r.dimension_values[gender] } : {}),
        });
  }
  return out;
}
export function safeSocialUrl(
  value: unknown,
  thumbnail = false,
): string | null {
  try {
    const u = new URL(String(value));
    const allowed = thumbnail
      ? ["cdninstagram.com", "fbcdn.net"]
      : ["instagram.com", "facebook.com"];
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.searchParams.has("access_token") &&
      allowed.some((h) => u.hostname === h || u.hostname.endsWith("." + h))
    )
      return u.href;
  } catch {}
  return null;
}
export function emptyMedia(
  id: string,
  channel: MediaReport["channel"],
): MediaReport {
  return {
    id,
    channel,
    caption: "",
    type: "",
    permalink: null,
    thumbnail: null,
    timestamp: "",
    fetchedAt: null,
    likes: null,
    comments: null,
    saved: null,
    shares: null,
    reach: null,
    views: null,
    interactions: null,
    follows: null,
    profileVisits: null,
    profileActivity: null,
    replies: null,
    navigation: null,
    exits: null,
    back: null,
    forward: null,
    next: null,
  };
}
export function parseMediaMetrics(
  data: Insight[],
  channel: MediaReport["channel"],
) {
  const result: Record<string, number | null> = {};
  for (const m of data) {
    const key: Record<string, string> = {
      total_interactions: "interactions",
      profile_visits: "profileVisits",
      profile_activity: "profileActivity",
    };
    result[key[m.name] || m.name] = metricValue(m);
    if (channel === "STORY" && m.name === "navigation") {
      const rows = breakdownRows(m, "story_navigation_action_type");
      for (const [name, action] of Object.entries({
        exits: "TAP_EXIT",
        back: "TAP_BACK",
        forward: "TAP_FORWARD",
        next: "SWIPE_FORWARD",
      }))
        result[name] =
          rows.find((x) => x.label.toUpperCase() === action)?.value ?? null;
    }
  }
  return result;
}
export const ratio = (a: number | null, b: number | null, scale = 1) =>
  a !== null && b !== null && b > 0 ? (a / b) * scale : null;
export function sumKnown(rows: MediaReport[], key: keyof MediaReport) {
  const nums = rows
    .map((m) => m[key])
    .filter((x): x is number => typeof x === "number");
  return {
    value: nums.length ? nums.reduce((a, b) => a + b, 0) : null,
    known: nums.length,
    total: rows.length,
  };
}
export function mediaSummary(rows: MediaReport[]) {
  const views = sumKnown(rows, "views"),
    interactions = sumKnown(rows, "interactions");
  const rate = rows
    .map((m) => ratio(m.interactions, m.reach, 100))
    .filter((x): x is number => x !== null);
  return {
    count: rows.length,
    views,
    interactions,
    averageViews: ratio(views.value, views.known),
    averageInteractions: ratio(interactions.value, interactions.known),
    averageEngagement: rate.length
      ? rate.reduce((a, b) => a + b, 0) / rate.length
      : null,
  };
}
export function timePerformance(rows: MediaReport[]) {
  const bins = new Map<
    string,
    { day: number; hour: number; count: number; total: number }
  >();
  for (const m of rows) {
    if (m.interactions === null || !m.timestamp) continue;
    const d = new Date(new Date(m.timestamp).getTime() - 3 * 3600000);
    const day = d.getUTCDay(),
      hour = d.getUTCHours(),
      key = day + ":" + hour;
    const bin = bins.get(key) || { day, hour, count: 0, total: 0 };
    bin.count++;
    bin.total += m.interactions;
    bins.set(key, bin);
  }
  return [...bins.values()].map((b) => ({ ...b, average: b.total / b.count }));
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^\s*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
