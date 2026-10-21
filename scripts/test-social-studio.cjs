// Run only against an explicitly named, disposable local PostgreSQL database.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const url = new URL(process.env.TEST_DATABASE_URL || "https://missing.invalid");
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/social_(test_|preview_)[a-z0-9_]+$/.test(url.pathname)
)
  throw Error(
    "Set TEST_DATABASE_URL to a disposable local social_test_* database.",
  );
Object.assign(process.env, {
  DATABASE_URL: url.href,
  DIRECT_URL: url.href,
  INSTANCE_TRIAL_ENDS_AT: "",
  SOCIAL_PUBLISHING_ENABLED: "false",
  SOCIAL_MEDIA_CLEANUP_ENABLED: "true",
  SOCIAL_VPS_MEDIA_URL: "https://media.example.test",
  SOCIAL_VPS_MEDIA_INSTANCE: "test",
  SOCIAL_VPS_MEDIA_SECRET: "test-only-".repeat(8),
});
const { PrismaClient } = require("@prisma/client"),
  p = new PrismaClient();
(async () => {
  let client, foreign;
  const fetchBefore = global.fetch;
  let application;
  try {
    const actual = await p.$queryRaw`SELECT current_database() AS name`;
    assert.equal(actual[0].name, url.pathname.slice(1));
    const { splitSql } = await import("../scripts/prepare-social.ts");
    const cols =
      await p.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='social_posts' AND column_name='options'`;
    if (!cols.length)
      await p.$transaction(
        async (tx) => {
          for (const statement of splitSql(
            fs.readFileSync(
              "prisma/migrations/20261021160000_social_studio/migration.sql",
              "utf8",
            ),
          ))
            await tx.$executeRawUnsafe(statement);
        },
        { timeout: 60000 },
      );
    ({ prisma: application } = await import("../lib/prisma.ts"));
    const { createEditorial } = await import("../lib/social/editorial.ts"),
      { expandSocialSeries } = await import("../lib/social/series.ts"),
      { cleanSocialMedia } = await import("../lib/social/media-retention.ts");
    const owner = await p.user.findFirstOrThrow();
    client = await p.client.create({
      data: { name: "Social studio test " + crypto.randomUUID() },
    });
    foreign = await p.client.create({
      data: { name: "Foreign studio test " + crypto.randomUUID() },
    });
    const account = await p.socialAccount.create({
        data: {
          clientId: client.id,
          provider: "INSTAGRAM",
          accountType: "BUSINESS",
          externalId: "test-" + crypto.randomUUID(),
          name: "Test",
          tokenEncrypted: "unused",
          connectedById: owner.id,
        },
      }),
      other = await p.socialAccount.create({
        data: {
          clientId: foreign.id,
          provider: "INSTAGRAM",
          externalId: "test-" + crypto.randomUUID(),
          name: "Foreign",
          tokenEncrypted: "unused",
          connectedById: owner.id,
        },
      });
    const old = new Date(Date.now() - 4 * 86400000),
      assets = [];
    for (let i = 0; i < 3; i++)
      assets.push(
        await p.socialAsset.create({
          data: {
            clientId: client.id,
            userId: owner.id,
            path: "a".repeat(16) + "/" + crypto.randomUUID() + ".jpg",
            name: "test.jpg",
            mime: "image/jpeg",
            bytes: 30,
            reservedBytes: 30,
            verifiedAt: old,
            state: "AVAILABLE",
            storageProvider: "VPS",
            createdAt: old,
          },
        }),
      );
    global.fetch = async (url, init) => {
      assert.equal(new URL(url).hostname, "media.example.test");
      const action = new URL(url).pathname;
      if (action === "/v1/delete")
        throw Error("Physical deletion deliberately fails");
      return Response.json({ bytes: 30, mime: "image/jpeg" });
    };
    const auth = { ...owner, permissions: null };
    const next = (days, hour = 12) => {
      const d = new Date(Date.now() + days * 86400000);
      d.setUTCHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const body = {
      targets: [{ accountId: account.id, format: "POST", options: {} }],
      assetIds: assets.slice(0, 2).map((a) => a.id),
      caption: "Test only",
      status: "PENDING_APPROVAL",
      scheduleDates: [next(2), next(4), next(4), next(7, 15)],
    };
    const batch = await createEditorial(body, client.id, auth);
    assert.equal(batch.created, 3);
    const posts = await p.socialPost.findMany({
      where: { clientId: client.id },
    });
    assert(posts.every((x) => x.format === "CAROUSEL"));
    assert.deepEqual(
      posts.map((x) => x.scheduledAt.toISOString()).sort(),
      [next(2), next(4), next(7, 15)].sort(),
    );
    await assert.rejects(
      createEditorial(
        { ...body, targets: [{ accountId: other.id, format: "POST" }] },
        client.id,
        auth,
      ),
      /não pertence/,
    );
    await assert.rejects(
      createEditorial(
        { ...body, targets: [{ accountId: account.id, format: "REEL" }] },
        client.id,
        auth,
      ),
      /vídeo/,
    );
    await assert.rejects(
      createEditorial({ ...body, status: "SCHEDULED" }, client.id, {
        ...auth,
        role: "MEMBER",
      }),
      /administradores/,
    );
    const start = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.now() + 86400000));
    const recurrent = await createEditorial(
      {
        ...body,
        targets: [{ accountId: account.id, format: "STORY" }],
        assetIds: [assets[0].id],
        scheduleDates: undefined,
        recurrence: {
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          time: "09:00",
          startDate: start,
          endDate: null,
        },
      },
      client.id,
      auth,
    );
    const seriesId = recurrent.seriesIds[0],
      before = await p.socialPost.count({ where: { seriesId } });
    assert(before >= 59);
    await p.socialSeries.update({
      where: { id: seriesId },
      data: { lastExpandedAt: null },
    });
    await Promise.all([expandSocialSeries(), expandSocialSeries()]);
    assert.equal(await p.socialPost.count({ where: { seriesId } }), before);
    const occurrence = await p.socialPost.findFirstOrThrow({
      where: { seriesId },
    });
    await p.socialPost.update({
      where: { id: occurrence.id },
      data: { caption: "Edited only occurrence", status: "CANCELLED" },
    });
    await p.socialSeries.update({
      where: { id: seriesId },
      data: { lastExpandedAt: null },
    });
    await expandSocialSeries();
    assert.equal(
      (await p.socialPost.findUniqueOrThrow({ where: { id: occurrence.id } }))
        .caption,
      "Edited only occurrence",
    );
    // Published copies cannot release the still-active template asset or its cover.
    await p.socialPost.updateMany({
      where: { clientId: client.id },
      data: { status: "PUBLISHED", publishedAt: old },
    });
    await p.socialPost.create({
      data: {
        clientId: client.id,
        accountId: account.id,
        createdById: owner.id,
        caption: "Cover reference",
        format: "REEL",
        media: [],
        options: { coverAssetId: assets[2].id },
        status: "DRAFT",
      },
    });
    await cleanSocialMedia();
    assert.equal(
      (await p.socialAsset.findUniqueOrThrow({ where: { id: assets[0].id } }))
        .state,
      "AVAILABLE",
    );
    assert.equal(
      (await p.socialAsset.findUniqueOrThrow({ where: { id: assets[2].id } }))
        .state,
      "AVAILABLE",
    );
    assert.equal(
      (await p.socialAsset.findUniqueOrThrow({ where: { id: assets[1].id } }))
        .state,
      "DELETING",
    );
    await p.socialSeries.update({
      where: { id: seriesId },
      data: { active: false },
    });
    await cleanSocialMedia();
    assert.equal(
      (await p.socialAsset.findUniqueOrThrow({ where: { id: assets[0].id } }))
        .state,
      "DELETING",
    );
    console.log(
      JSON.stringify({
        isolatedPostgres: true,
        additiveMigration: true,
        manualDatesDeduplicated: true,
        carouselAutomatic: true,
        channelValidation: true,
        crossClientBlocked: true,
        adminApprovalRequired: true,
        indefiniteWeeklySeries: true,
        concurrentExpansionIdempotent: true,
        editedOccurrencePreserved: true,
        activeSeriesAndCoverRetained: true,
        pausedSeriesAllowsCleanup: true,
        externalPublications: 0,
      }),
    );
  } finally {
    global.fetch = fetchBefore;
    for (const c of [client, foreign])
      if (c) {
        await p.socialPost.deleteMany({ where: { clientId: c.id } });
        await p.socialSeries.deleteMany({ where: { clientId: c.id } });
        await p.socialAsset.deleteMany({ where: { clientId: c.id } });
        await p.socialAccount.deleteMany({ where: { clientId: c.id } });
        await p.client.delete({ where: { id: c.id } });
      }
    if (application) await application.$disconnect();
    await p.$disconnect();
  }
})().catch((e) => {
  console.error(
    JSON.stringify({
      failed: true,
      name: e.name,
      code: e.code,
      message:
        e.name === "AssertionError" || e.name === "SocialError"
          ? e.message
          : "Isolated verification failed",
    }),
  );
  process.exitCode = 1;
});
