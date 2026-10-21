import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { loadRouteModule } from "./helpers/route-module";

const admin = { id: "admin", role: "ADMIN", permissions: null };
const token = "test-webhook-secret-with-more-than-32-characters";
function fixture(user: any = admin) {
  let registered = false;
  const calls: any[] = [];
  const route = loadRouteModule("app/api/integrations/asaas/webhook/route.ts", {
    "@/lib/supabase/get-server-auth": { getServerAuth: async () => user },
    "@/lib/asaas-integration-server": {
      getAsaasRuntimeConfig: async () => ({
        apiKey: "private-api-key",
        baseUrl: "https://api.asaas.com/v3",
      }),
      getAsaasWebhookToken: async () => token,
    },
    "@/lib/asaas": {
      requestAsaasWithConfig: async (config: any, path: string, init: any) => {
        calls.push({ path, init });
        assert.equal(config.apiKey, "private-api-key");
        if (path === "/webhooks?limit=100")
          return {
            data: registered
              ? [
                  {
                    id: "hook_test",
                    url: "https://example.test/api/webhooks/asaas",
                  },
                ]
              : [{ id: "other_hook", url: "https://other.example.test" }],
          };
        registered = true;
        return { authToken: token, id: "hook_test" };
      },
    },
  });
  return { route, calls };
}
const req = (body: any, origin = "https://example.test") =>
  new NextRequest("https://example.test/api/integrations/asaas/webhook", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify(body),
  });

test("cadastra e reconfigura somente o callback da instância sem expor ou rotacionar segredos", async () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "https://example.test";
  try {
    const { route, calls } = fixture();
    const first = await route.POST(req({ email: "tech@example.test" }));
    assert.equal(first.status, 200);
    assert.ok(!(await first.text()).includes(token));
    const created = JSON.parse(calls[1].init.body);
    assert.equal(calls[1].path, "/webhooks");
    assert.equal(calls[1].init.method, "POST");
    assert.equal(created.authToken, token);
    assert.equal(created.url, "https://example.test/api/webhooks/asaas");
    assert.equal(created.email, "tech@example.test");
    assert.equal(created.enabled, true);
    assert.equal(created.interrupted, false);
    assert.ok(created.events.includes("PAYMENT_RECEIVED"));
    assert.equal(created.sendType, "SEQUENTIALLY");
    assert.equal(
      (await route.POST(req({ email: "tech@example.test" }))).status,
      200,
    );
    assert.equal(calls[3].path, "/webhooks/hook_test");
    assert.equal(calls[3].init.method, "PUT");
    for (const body of [
      { email: "a@example.test", url: "https://attacker.test" },
      { email: "a@example.test,b@example.test" },
      { email: "bad" },
    ])
      assert.equal((await route.POST(req(body))).status, 400);
    assert.equal(
      (await fixture(null).route.POST(req({ email: "tech@example.test" })))
        .status,
      401,
    );
    assert.equal(
      (
        await fixture({
          ...admin,
          role: "MEMBER",
          permissions: { financeiro: "edit" },
        }).route.POST(req({ email: "tech@example.test" }))
      ).status,
      403,
    );
    assert.equal(
      (
        await route.POST(
          req({ email: "tech@example.test" }, "https://attacker.test"),
        )
      ).status,
      403,
    );
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
});
