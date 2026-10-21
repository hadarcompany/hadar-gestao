import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { validateContent, scheduledDate } from "../lib/social/validation";
import { seal, unseal, nonceHash } from "../lib/social/core";
import { canAccessApi } from "../lib/api-policy";
import type { AuthUser } from "../types/auth";
import { NextRequest } from "next/server";
import { splitSql } from "../scripts/prepare-social";

const native = createRequire(resolve("package.json"));
function load(file: string, mocks: Record<string, unknown>) {
  const exports = {},
    module = { exports };
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(output, {
    module,
    exports,
    process,
    console,
    Buffer,
    URL,
    Request,
    Response,
    fetch,
    require: (name: string) =>
      Object.hasOwn(mocks, name)
        ? mocks[name]
        : native(
            name.startsWith("@/")
              ? resolve(name.slice(2))
              : name.startsWith(".")
                ? resolve(dirname(file), name)
                : name,
          ),
  });
  return module.exports as any;
}
test("tokens sociais são autenticados e não aceitam uma chave diferente", () => {
  const before = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  try {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-key-1-".repeat(5);
    const encrypted = seal("private-token");
    assert(!encrypted.includes("private-token"));
    assert.equal(unseal(encrypted), "private-token");
    const pieces = encrypted.split(".");
    pieces[2] = Buffer.from("altered").toString("base64url");
    assert.throws(() => unseal(pieces.join(".")));
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-key-2-".repeat(5);
    assert.throws(() => unseal(encrypted));
    assert.equal(nonceHash("same"), nonceHash("same"));
  } finally {
    if (before === undefined) delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    else process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = before;
  }
});
test("formatos e datas rejeitam combinações que não podem ser publicadas", () => {
  const image = { mime: "image/jpeg" },
    video = { mime: "video/mp4" };
  assert.doesNotThrow(() =>
    validateContent("INSTAGRAM", "CAROUSEL", "Legenda", [image, image]),
  );
  assert.doesNotThrow(() =>
    validateContent("INSTAGRAM", "REEL", "Legenda", [video]),
  );
  assert.doesNotThrow(() =>
    validateContent("FACEBOOK", "POST", "Somente texto", []),
  );
  assert.throws(() => validateContent("INSTAGRAM", "POST", "Texto", []));
  assert.throws(() => validateContent("INSTAGRAM", "CAROUSEL", "", [image]));
  assert.doesNotThrow(() => validateContent("FACEBOOK", "STORY", "", [image]));
  assert.throws(() => validateContent("INSTAGRAM", "REEL", "", [image]));
  assert.throws(() => scheduledDate("2027-01-01T12:00:00"));
  assert.throws(() => scheduledDate("2000-01-01T12:00:00Z"));
});
test("permissão para preparar conteúdo não permite conectar ou aprovar contas", () => {
  const user: AuthUser = {
    id: "writer",
    email: "writer@example.test",
    name: "Writer",
    role: "MEMBER",
    image: null,
    permissions: { publicacoes: "edit" },
  };
  assert(canAccessApi(user, "/api/social/posts", "POST"));
  assert.equal(canAccessApi(user, "/api/social/connect", "POST"), false);
  assert.equal(canAccessApi(user, "/api/social/accounts", "DELETE"), false);
  assert.equal(
    canAccessApi(
      { ...user, permissions: { publicacoes: "view" } },
      "/api/social/posts",
      "POST",
    ),
    false,
  );
});

test("upload acima do limite gratuito é recusado antes de reservar espaço ou emitir token", async () => {
  const previousProvider = process.env.SOCIAL_MEDIA_PROVIDER;
  delete process.env.SOCIAL_MEDIA_PROVIDER;
  let storageCalled = false;
  const route = load("app/api/social/media/route.ts", {
    "@/lib/social/core": {
      ...native(resolve("lib/social/core.ts")),
      socialAuth: async () => ({ auth: { id: "editor" } }),
      requireClient: async () => "client-a",
    },
    "@/lib/supabase/admin": {
      createSupabaseAdminClient: () => {
        storageCalled = true;
        throw Error("Storage must not be called");
      },
    },
  });
  const response = await route.POST(
    new Request("https://gestao.example.test/api/social/media", {
      method: "POST",
      body: JSON.stringify({
        clientId: "client-a",
        mime: "video/mp4",
        bytes: 60 * 1024 * 1024,
      }),
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(storageCalled, false);
  if (previousProvider !== undefined)
    process.env.SOCIAL_MEDIA_PROVIDER = previousProvider;
});

test("limpeza preserva mídia compartilhada com rascunho e só libera quota após excluir o arquivo", async () => {
  const before = process.env.SOCIAL_MEDIA_CLEANUP_ENABLED;
  process.env.SOCIAL_MEDIA_CLEANUP_ENABLED = "true";
  const events: string[] = [];
  const database: any = {
    $queryRaw: async () => [
      { id: "shared" },
      { id: "done" },
      { id: "delete-failed" },
    ],
    $executeRaw: async () => {},
    socialAsset: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        state: "AVAILABLE",
        createdAt: new Date(0),
      }),
      update: async ({ where }: any) => events.push(`claim:${where.id}`),
      updateMany: async ({ where, data }: any) => {
        assert.equal(data.reservedBytes, 0);
        events.push(`release:${where.id}`);
      },
    },
    socialPost: { findMany: async () => [] },
  };
  let refs = 0;
  database.socialPost.findMany = async () =>
    ++refs === 1
      ? [
          { status: "PUBLISHED", publishedAt: new Date(0) },
          { status: "DRAFT", publishedAt: null },
        ]
      : [{ status: "PUBLISHED", publishedAt: new Date(0) }];
  database.$transaction = async (fn: any) => fn(database);
  try {
    const { cleanSocialMedia } = load("lib/social/media-retention.ts", {
      "@/lib/prisma": { prisma: database },
      "./storage": {
        removeMedia: async ({ id }: any) => {
          events.push(`delete:${id}`);
          if (id === "delete-failed") throw Error("offline");
        },
      },
    });
    assert.equal((await cleanSocialMedia()).removed, 1);
    assert.deepEqual(events, [
      "claim:done",
      "delete:done",
      "release:done",
      "claim:delete-failed",
      "delete:delete-failed",
    ]);
  } finally {
    if (before === undefined) delete process.env.SOCIAL_MEDIA_CLEANUP_ENABLED;
    else process.env.SOCIAL_MEDIA_CLEANUP_ENABLED = before;
  }
});

test("mídia em exclusão não pode ser anexada novamente, mesmo após prévia validação", async () => {
  const { lockAvailableAssets } = load("lib/social/media-retention.ts", {});
  let locked = false;
  await assert.rejects(
    lockAvailableAssets(
      {
        $executeRaw: async () => {
          locked = true;
        },
        socialAsset: {
          count: async () => {
            assert(locked);
            return 0;
          },
        },
      },
      ["old-asset"],
      "client-a",
    ),
    /não está mais disponível/,
  );
});
test("conexão abre Instagram diretamente, com state opaco e vínculo ao usuário/cliente", async () => {
  const previous = { ...process.env };
  const sessions: any[] = [];
  try {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "oauth-test".repeat(5);
    process.env.SOCIAL_INSTAGRAM_APP_ID = "ig-test-app";
    process.env.SOCIAL_INSTAGRAM_APP_SECRET = "test-secret";
    process.env.APP_URL = "https://gestao.example.test";
    const route = load("app/api/social/connect/route.ts", {
      "@/lib/prisma": {
        prisma: {
          socialOAuthSession: {
            deleteMany: async () => {},
            create: async ({ data }: any) => sessions.push(data),
          },
        },
      },
      "@/lib/social/core": {
        ...native(resolve("lib/social/core.ts")),
        socialAuth: async () => ({ auth: { id: "admin" } }),
        requireClient: async () => "client-a",
      },
    });
    const response = await route.POST(
      new Request("https://internal:3000/api/social/connect", {
        method: "POST",
        body: JSON.stringify({ clientId: "client-a", provider: "INSTAGRAM" }),
      }),
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    const url = new URL(result.url);
    assert.equal(url.hostname, "www.instagram.com");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://gestao.example.test/api/social/callback/instagram",
    );
    assert.equal(
      url.searchParams.get("scope"),
      "instagram_business_basic,instagram_business_content_publish",
    );
    assert(!result.url.includes("test-secret"));
    assert.equal(sessions[0].userId, "admin");
    assert.equal(sessions[0].clientId, "client-a");
    assert.notEqual(sessions[0].id, url.searchParams.get("state"));
    assert.equal(sessions[0].id, nonceHash(url.searchParams.get("state")!));
    assert(response.headers.get("set-cookie")!.includes("HttpOnly"));
    // A Business Login configuration owns its permission set; do not override
    // it with scope or accidentally send the secret to the authorization page.
    process.env.SOCIAL_FACEBOOK_APP_ID = "fb-test-app";
    process.env.SOCIAL_FACEBOOK_APP_SECRET = "private-fb-secret";
    process.env.SOCIAL_FACEBOOK_CONFIG_ID = "test-configuration";
    const facebookResponse = await route.POST(
      new Request("https://internal:3000/api/social/connect", {
        method: "POST",
        body: JSON.stringify({ clientId: "client-a", provider: "FACEBOOK" }),
      }),
    );
    assert.equal(facebookResponse.status, 200);
    const facebookUrl = new URL((await facebookResponse.json()).url);
    assert.equal(facebookUrl.hostname, "www.facebook.com");
    assert.equal(
      facebookUrl.searchParams.get("config_id"),
      "test-configuration",
    );
    assert.equal(facebookUrl.searchParams.get("response_type"), "code");
    assert.equal(facebookUrl.searchParams.has("scope"), false);
    assert.equal(facebookUrl.href.includes("private-fb-secret"), false);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
test("fronteira de publicação é persistida antes da chamada; timeout vira incerto", async () => {
  const order: string[] = [];
  const { commitPublication, PublicationUncertain } = load(
    "lib/social/publisher.ts",
    {
      "@/lib/prisma": {
        prisma: {
          socialPost: {
            updateMany: async () => {
              order.push("persist");
              return { count: 1 };
            },
          },
        },
      },
    },
  );
  await assert.rejects(
    commitPublication({ id: "post", lockToken: "lock" }, async () => {
      order.push("publish");
      throw new Error("timeout");
    }),
    PublicationUncertain,
  );
  assert.deepEqual(order, ["persist", "publish"]);
});
test("um processo que perdeu o lock nunca envia a publicação", async () => {
  const { commitPublication } = load("lib/social/publisher.ts", {
    "@/lib/prisma": {
      prisma: { socialPost: { updateMany: async () => ({ count: 0 }) } },
    },
  });
  let sent = false;
  await assert.rejects(
    commitPublication({ id: "post", lockToken: "old" }, async () => {
      sent = true;
    }),
  );
  assert.equal(sent, false);
});
test("worker não repete publicação após resposta perdida e marca para conferência", async () => {
  class Uncertain extends Error {}
  const changed: any[] = [];
  const job = {
    id: "post",
    accountId: "account",
    status: "PROCESSING",
    account: {},
    lockToken: "lock",
  };
  const database: any = {
    socialAccount: { updateMany: async () => ({ count: 1 }) },
    socialPost: {
      findFirst: async () => job,
      findUniqueOrThrow: async () => job,
      findUnique: async () => ({ publishStartedAt: new Date() }),
      updateMany: async (args: any) => {
        changed.push(args);
        return { count: 1 };
      },
    },
  };
  database.$transaction = async (fn: any) => fn(database);
  const before = process.env.SOCIAL_PUBLISHING_ENABLED;
  process.env.SOCIAL_PUBLISHING_ENABLED = "true";
  try {
    let called = 0;
    const { runSocialWorker } = load("lib/social/worker.ts", {
      "@/lib/prisma": { prisma: database },
      "@/lib/instance-trial": { trialExpired: () => false },
      "./publisher": {
        publishJob: async () => {
          called++;
          throw new Uncertain();
        },
        StillProcessing: class extends Error {},
        PublicationUncertain: Uncertain,
      },
    });
    const result = await runSocialWorker();
    assert.equal(called, 1);
    assert.equal(result.uncertain, true);
    assert.equal(changed.at(-1).data.status, "UNCERTAIN");
    assert(!changed.some((c) => c.data.status === "SCHEDULED"));
  } finally {
    if (before === undefined) delete process.env.SOCIAL_PUBLISHING_ENABLED;
    else process.env.SOCIAL_PUBLISHING_ENABLED = before;
  }
});
test("worker sem chave é recusado antes de consultar a fila", async () => {
  let called = false;
  const { POST } = load("app/api/social/worker/route.ts", {
    "@/lib/social/worker": {
      runSocialWorker: async () => {
        called = true;
      },
    },
  });
  const result = await POST(
    new Request("https://gestao.example.test/api/social/worker", {
      method: "POST",
    }),
  );
  assert.equal(result.status, 401);
  assert.equal(called, false);
});
test("callback OAuth consumido não troca código nem conecta novamente", async () => {
  let exchanged = false;
  const state = "opaque-state",
    request = new NextRequest(
      `https://gestao.example.test/api/social/callback/instagram?code=test&state=${state}`,
      { headers: { cookie: `social_state_INSTAGRAM=${state}` } },
    );
  const route = load("app/api/social/callback/[provider]/route.ts", {
    "@/lib/social/core": {
      ...native(resolve("lib/social/core.ts")),
      socialAuth: async () => ({ auth: { id: "owner" } }),
    },
    "@/lib/prisma": {
      prisma: {
        socialOAuthSession: {
          findUnique: async () => ({
            userId: "owner",
            provider: "INSTAGRAM",
            expiresAt: new Date(Date.now() + 60000),
            consumedAt: new Date(),
          }),
        },
      },
    },
    "@/lib/social/meta": {
      exchangeCode: async () => {
        exchanged = true;
      },
    },
  });
  const result = await route.GET(request, {
    params: Promise.resolve({ provider: "instagram" }),
  });
  assert.equal(exchanged, false);
  assert.equal(
    new URL(result.headers.get("location")!).searchParams.get("social"),
    "invalid_state",
  );
});
test("editor não aprova publicação, mesmo chamando a API diretamente", async () => {
  let updated = false;
  const route = load("app/api/social/posts/[id]/route.ts", {
    "@/lib/social/core": {
      ...native(resolve("lib/social/core.ts")),
      socialAuth: async () => ({
        auth: {
          id: "writer",
          role: "MEMBER",
          permissions: { publicacoes: "edit" },
        },
      }),
      requireClient: async () => "client-a",
    },
    "@/lib/prisma": {
      prisma: {
        socialPost: {
          findFirst: async () => ({
            id: "post",
            clientId: "client-a",
            status: "DRAFT",
            publishStartedAt: null,
            account: {},
          }),
          updateMany: async () => {
            updated = true;
          },
        },
      },
    },
  });
  const result = await route.PATCH(
    new Request("https://gestao.example.test/api/social/posts/post", {
      method: "PATCH",
      body: JSON.stringify({ clientId: "client-a", action: "schedule" }),
    }),
    { params: Promise.resolve({ id: "post" }) },
  );
  assert.equal(result.status, 403);
  assert.equal(updated, false);
});
test("parser mantém o bloco RLS e literais SQL como comandos inteiros", () => {
  const sql =
    "CREATE TABLE sample(id text); DO $$ BEGIN PERFORM 'one;two'; END $$; -- ignored;\nSELECT 'it''s;safe';";
  const parts = splitSql(sql);
  assert.equal(parts.length, 3);
  assert(parts[1].includes("END $$"));
  assert.equal(parts[2], "SELECT 'it''s;safe'");
  const fixed = splitSql(
    readFileSync(
      "prisma/migrations/20261020230000_social_publishing/migration.sql",
      "utf8",
    ),
  );
  assert.equal(fixed.filter((s) => s.startsWith("DO $$")).length, 1);
  assert(!fixed.some((s) => /^(DROP|TRUNCATE|DELETE)/i.test(s)));
});
test("Story de foto no Facebook usa photo_stories, sem criar um post no feed", async () => {
  const before = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "publisher-test-key-".repeat(4);
  try {
    const calls: any[] = [];
    const { publishJob } = load("lib/social/publisher.ts", {
      "@/lib/prisma": {
        prisma: {
          socialPost: {
            updateMany: async (args: any) => {
              calls.push({ persist: !!args.data.publishStartedAt });
              return { count: 1 };
            },
          },
        },
      },
      "./storage": {
        signedMedia: async () =>
          "https://example.supabase.co/storage/signed-photo",
      },
      "./meta": {
        meta: async (_p: string, path: string, _token: string, fields: any) => {
          calls.push({ path, fields });
          return path.endsWith("/photos")
            ? { id: "20001" }
            : { success: true, post_id: "10001_30001" };
        },
        ProviderError: class extends Error {},
      },
    });
    const result = await publishJob({
      id: "post",
      lockToken: "lock",
      accountId: "account",
      account: {
        externalId: "10001",
        provider: "FACEBOOK",
        status: "CONNECTED",
        tokenEncrypted: seal("not-a-real-token"),
      },
      format: "STORY",
      caption: "",
      media: [
        {
          id: "photo",
          path: "private/photo.jpg",
          mime: "image/jpeg",
          bytes: 5,
        },
      ],
      progress: null,
    });
    assert.equal(result, "10001_30001");
    assert.equal(
      calls.find((c) => c.path?.endsWith("/photos")).fields.published,
      "false",
    );
    const publishIndex = calls.findIndex((c) =>
      c.path?.endsWith("/photo_stories"),
    );
    assert.equal(calls[publishIndex - 1].persist, true);
    assert(!calls.some((c) => c.path?.endsWith("/feed")));
  } finally {
    if (before === undefined) delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    else process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = before;
  }
});
