const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const url = new URL(process.env.TEST_DATABASE_URL || "https://missing.invalid");
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/social_(test_|preview_)[a-z0-9_]+$/.test(url.pathname)
)
  throw Error("Use an explicitly named disposable local analytics database");
Object.assign(process.env, {
  DATABASE_URL: url.href,
  DIRECT_URL: url.href,
  INSTANCE_TRIAL_ENDS_AT: "",
  SOCIAL_PUBLISHING_ENABLED: "false",
  SOCIAL_TOKEN_ENCRYPTION_KEY: "isolated-analytics-key-".repeat(3),
});
const { PrismaClient } = require("@prisma/client"),
  p = new PrismaClient();
let client,
  application,
  stage = "migration";
const originalFetch = global.fetch;
(async () => {
  try {
    const { splitSql } = await import("./prepare-social.ts");
    const existing =
      await p.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='social_metric_days'`;
    if (!existing.length)
      await p.$transaction(
        async (tx) => {
          for (const sql of splitSql(
            fs.readFileSync(
              "prisma/migrations/20261021190000_social_analytics/migration.sql",
              "utf8",
            ),
          ))
            await tx.$executeRawUnsafe(sql);
        },
        { timeout: 60000 },
      );
    const rls =
      await p.$queryRaw`SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('social_metric_days','social_media_metrics','social_analytics_state')`;
    assert.equal(rls.length, 3);
    assert(rls.every((t) => t.rowsecurity));
    stage = "fixtures";
    const owner = await p.user.findFirstOrThrow();
    client = await p.client.create({
      data: { name: "Disposable analytics " + crypto.randomUUID() },
    });
    const { seal } = await import("../lib/social/core.ts");
    const account = await p.socialAccount.create({
      data: {
        clientId: client.id,
        provider: "INSTAGRAM",
        externalId: "991100000",
        name: "Isolated analytics",
        connectedById: owner.id,
        tokenEncrypted: seal("test-only-token"),
      },
    });
    ({ prisma: application } = await import("../lib/prisma.ts"));
    const { collectAccountAnalytics } =
      await import("../lib/social/analytics-collector.ts");
    const { accountReport } = await import("../lib/social/reports.ts");
    const { mediaSummary } = await import("../lib/social/analytics-data.ts");
    let expired = false,
      denied = false,
      mediaReads = 0;
    const timestamp = new Date(Date.now() - 2 * 3600000).toISOString();
    global.fetch = async (input, options) => {
      assert.equal(options.method, "GET");
      const u = new URL(input);
      assert.equal(u.hostname, "graph.instagram.com");
      assert.equal(options.headers.Authorization, "Bearer test-only-token");
      if (denied)
        return Response.json({ error: { code: 10 } }, { status: 400 });
      if (
        u.pathname.endsWith("/991100000") &&
        !u.pathname.endsWith("/insights")
      )
        return Response.json({ followers_count: 150, media_count: 1 });
      if (u.pathname.endsWith("/stories"))
        return Response.json({
          data: expired
            ? []
            : [
                {
                  id: "991100001",
                  media_type: "IMAGE",
                  media_product_type: "STORY",
                  timestamp,
                  media_url: "https://scontent.cdninstagram.com/story.jpg",
                },
              ],
        });
      if (u.pathname.endsWith("/media"))
        return Response.json({
          data: [
            {
              id: "991100002",
              caption: "Fixture reel",
              media_type: "VIDEO",
              media_product_type: "REELS",
              timestamp,
              like_count: 0,
              comments_count: 2,
            },
          ],
        });
      if (u.pathname.endsWith("/insights")) {
        const metrics = u.searchParams.get("metric").split(",");
        if (!u.pathname.endsWith("/991100000/insights")) mediaReads++;
        return Response.json({
          data: metrics.map((name) => {
            if (name === "follows_and_unfollows")
              return {
                name,
                total_value: {
                  breakdowns: [
                    {
                      dimension_keys: ["follow_type"],
                      results: [
                        { dimension_values: ["FOLLOWER"], value: 4 },
                        { dimension_values: ["NON_FOLLOWER"], value: 1 },
                      ],
                    },
                  ],
                },
              };
            if (name === "follower_demographics")
              return {
                name,
                total_value: {
                  breakdowns: [
                    {
                      dimension_keys: ["age", "gender"],
                      results: [
                        { dimension_values: ["25-34", "F"], value: 80 },
                      ],
                    },
                  ],
                },
              };
            if (name === "navigation")
              return {
                name,
                values: [{ value: 12 }],
                total_value: {
                  breakdowns: [
                    {
                      dimension_keys: ["story_navigation_action_type"],
                      results: [
                        { dimension_values: ["tap_forward"], value: 10 },
                        { dimension_values: ["tap_back"], value: 0 },
                        { dimension_values: ["tap_exit"], value: 2 },
                      ],
                    },
                  ],
                },
              };
            return {
              name,
              values: [
                {
                  value:
                    name === "likes"
                      ? 0
                      : name === "reach"
                        ? 40
                        : name === "views"
                          ? 100
                          : 2,
                },
              ],
              total_value: u.pathname.endsWith("/991100000/insights")
                ? { value: name === "views" ? 200 : name === "reach" ? 80 : 4 }
                : undefined,
            };
          }),
        });
      }
      throw Error("Unexpected endpoint");
    };
    stage = "collect";
    const concurrent = await Promise.all([
      collectAccountAnalytics(account),
      collectAccountAnalytics(account),
    ]);
    assert.equal(concurrent.filter((x) => x.collected).length, 1);
    assert.equal(concurrent.filter((x) => x.skipped).length, 1);
    assert.equal(process.env.SOCIAL_PUBLISHING_ENABLED, "false");
    assert.equal(
      await p.socialMediaMetric.count({ where: { accountId: account.id } }),
      2,
    );
    const rows = await p.socialMediaMetric.findMany({
      where: { accountId: account.id },
    });
    assert(rows.every((x) => x.fetchedAt));
    const story = rows.find((x) => x.channel === "STORY");
    assert.equal(story.data.forward, 10);
    assert.equal(story.data.back, 0);
    assert.equal(story.data.next, null);
    const reel = rows.find((x) => x.channel === "REEL");
    assert.equal(reel.data.likes, 0);
    assert.equal(reel.data.views, 100);
    stage = "report";
    const start = new Date(Date.now() - 7 * 86400000),
      end = new Date(Date.now() + 86400000);
    const second = await p.socialAccount.create({
      data: {
        clientId: client.id,
        provider: "INSTAGRAM",
        externalId: "991100003",
        name: "Other scoped account",
        connectedById: owner.id,
        tokenEncrypted: seal("test-only-token"),
      },
    });
    await p.socialMediaMetric.create({
      data: {
        accountId: second.id,
        externalId: "991100002",
        channel: "REEL",
        publishedAt: new Date(timestamp),
        data: { caption: "Must remain scoped to second account" },
      },
    });
    const report = await accountReport(account, start, end);
    assert.equal(report.media.length, 2);
    assert.equal(report.followers, 150);
    assert.equal(report.follows, 4);
    assert.equal(report.unfollows, 1);
    assert.equal(report.reach, 80);
    assert.equal(mediaSummary(report.media).views.value, 200);
    assert.equal(report.demographics.age[0].gender, "F");
    assert(!JSON.stringify(report).includes("test-only-token"));
    const before = mediaReads;
    await accountReport(account, start, end);
    assert.equal(mediaReads, before);
    expired = true;
    await p.socialAnalyticsState.update({
      where: { accountId: account.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await collectAccountAnalytics(account);
    assert.equal(
      await p.socialMediaMetric.count({
        where: { accountId: account.id, channel: "STORY" },
      }),
      1,
    );
    denied = true;
    await p.socialAnalyticsState.update({
      where: { accountId: account.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await collectAccountAnalytics(account);
    const preserved = await p.socialMediaMetric.findUniqueOrThrow({
      where: { id: story.id },
    });
    assert.equal(preserved.data.views, 100);
    assert.equal(preserved.data.forward, 10);
    const posts = await p.socialPost.count({ where: { clientId: client.id } });
    assert.equal(posts, 0);
    console.log(
      JSON.stringify({
        analyticsMigrationAndRls: true,
        concurrentCollectorIdempotent: true,
        publishingRemainsOff: true,
        storyArchivePreserved: true,
        missingMetricsPreservePreviousValues: true,
        zeroPreserved: true,
        rangeAndDemography: true,
        externalPublications: 0,
      }),
    );
  } finally {
    global.fetch = originalFetch;
    if (client) {
      await p.socialAccount.deleteMany({ where: { clientId: client.id } });
      await p.client.delete({ where: { id: client.id } });
    }
    await application?.$disconnect();
    await p.$disconnect();
  }
})().catch((e) => {
  console.error(
    e.name === "AssertionError"
      ? e.message
      : JSON.stringify({
          verificationFailed: true,
          stage,
          name: e.name,
          code: e.code,
        }),
  );
  process.exitCode = 1;
});
