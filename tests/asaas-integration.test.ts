import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import type { AuthUser } from "../types/auth";
import { AsaasApiError, ASAAS_KEY_CONTEXT, ASAAS_WEBHOOK_CONTEXT, asaasIntegrationStatus, asaasRuntimeConfig, asaasWebhookToken, parseAsaasIntegrationInput, validAsaasWebhookToken, type AsaasIntegrationRecord } from "../lib/asaas-integration";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "../lib/integrations/crypto";
import { requestAsaasWithConfig } from "../lib/asaas";
import { loadRouteModule } from "./helpers/route-module";

const apiKey = "$aact_prod_fake-key-for-automated-tests-only";
const sandboxKey = "$aact_hmlg_fake-key-for-automated-tests-only";
const webhookToken = "fake-webhook-token-with-more-than-32-characters";
const admin: AuthUser = { id: "admin", name: "Admin", email: "admin@example.test", role: "ADMIN", permissions: null, image: null };
const request = (method: string, body?: unknown, origin?: string) => new NextRequest("https://company.example.test/api/integrations/asaas", { method, headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function fakeEnvironment(context: any) {
  const vars = ["INTEGRATIONS_ENCRYPTION_KEY", "ASAAS_API_KEY", "ASAAS_ENVIRONMENT", "ASAAS_WEBHOOK_TOKEN"] as const;
  const previous = Object.fromEntries(vars.map(key => [key, process.env[key]]));
  context.after(() => { for (const key of vars) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "fake-stable-master-encryption-key-for-tests";
  delete process.env.ASAAS_API_KEY; delete process.env.ASAAS_WEBHOOK_TOKEN; delete process.env.ASAAS_ENVIRONMENT;
}

function fixture(user: AuthUser | null = admin) {
  let record: AsaasIntegrationRecord = null;
  const route = loadRouteModule("app/api/integrations/asaas/route.ts", {
    "@/lib/supabase/get-server-auth": { getServerAuth: async () => user },
    "@/lib/prisma": { prisma: { asaasIntegration: {
      findUnique: async () => record,
      upsert: async (args: any) => { record = { webhookTokenEncrypted: null, environment: "sandbox", ...record, ...(record ? args.update : args.create), updatedAt: new Date("2026-10-13T12:00:00Z") }; return record; },
    } } },
    "@/lib/asaas-integration-server": { getAsaasConfig: async () => asaasIntegrationStatus(record) },
    "@/lib/asaas": { requestAsaasWithConfig: async (config: any, path: string) => { assert.equal(config.apiKey, apiKey); assert.equal(config.baseUrl, "https://api.asaas.com/v3"); assert.equal(path, "/customers?limit=1"); return { data: [{ name: "Private customer" }] }; } },
  });
  return { route, record: () => record };
}

test("configuração valida ambiente, token e campos, recusando injeção e chave incorreta", () => {
  assert.equal(parseAsaasIntegrationInput({ apiKey, environment: "production", webhookToken }).apiKey, apiKey);
  assert.equal(parseAsaasIntegrationInput({ apiKey: " " }).apiKey, undefined);
  for (const body of [{ apiKey: "invalid" }, { apiKey, environment: "sandbox" }, { apiKey: sandboxKey, environment: "production" }, { apiKey, baseUrl: "https://attacker.test" }, { apiKeyEncrypted: "x" }, { webhookToken: apiKey }, { webhookToken: "short" }, { webhookToken: "a".repeat(32) + "\r\n" + "a".repeat(32) }]) assert.throws(() => parseAsaasIntegrationInput(body), AsaasApiError);
});

test("segredos têm nonce único e não podem ser trocados entre chave e webhook", context => {
  fakeEnvironment(context);
  const first = encryptIntegrationSecret(apiKey, ASAAS_KEY_CONTEXT);
  assert.notEqual(first, encryptIntegrationSecret(apiKey, ASAAS_KEY_CONTEXT));
  assert.ok(!first.includes(apiKey)); assert.equal(decryptIntegrationSecret(first, ASAAS_KEY_CONTEXT), apiKey);
  assert.throws(() => decryptIntegrationSecret(first, ASAAS_WEBHOOK_CONTEXT));
  const parts = first.split("."); const data = Buffer.from(parts[4], "base64url"); data[0] ^= 1; parts[4] = data.toString("base64url");
  assert.throws(() => decryptIntegrationSecret(parts.join("."), ASAAS_KEY_CONTEXT));
});

test("instalações usam sua chave salva e desconectar bloqueia a chave legada do servidor", context => {
  fakeEnvironment(context); process.env.ASAAS_API_KEY = sandboxKey; process.env.ASAAS_ENVIRONMENT = "sandbox";
  const record = { enabled: true, environment: "production", apiKeyEncrypted: encryptIntegrationSecret(apiKey, ASAAS_KEY_CONTEXT), webhookTokenEncrypted: encryptIntegrationSecret(webhookToken, ASAAS_WEBHOOK_CONTEXT), updatedAt: new Date() };
  assert.equal(asaasRuntimeConfig(record).apiKey, apiKey); assert.equal(asaasRuntimeConfig(null).apiKey, sandboxKey);
  assert.ok(!JSON.stringify(asaasIntegrationStatus(record)).includes(apiKey));
  assert.ok(!JSON.stringify(asaasIntegrationStatus(record)).includes(record.apiKeyEncrypted));
  assert.equal(asaasWebhookToken(record), webhookToken);
  assert.throws(() => asaasRuntimeConfig({ ...record, enabled: false }), AsaasApiError);
  assert.equal(asaasWebhookToken({ ...record, enabled: false }), null);
  assert.equal(validAsaasWebhookToken(webhookToken, webhookToken), true);
  assert.equal(validAsaasWebhookToken(webhookToken, "wrong"), false);
  assert.equal(validAsaasWebhookToken(null, null), false);
});

test("API real permite somente administrador e bloqueia origem externa", async () => {
  for (const user of [null, { ...admin, role: "MEMBER" }]) {
    const { route } = fixture(user);
    for (const method of ["GET", "PUT", "POST", "DELETE"]) assert.equal((await route[method](request(method, method === "GET" ? undefined : {}))).status, user ? 403 : 401);
  }
  assert.equal((await fixture().route.PUT(request("PUT", { apiKey }, "https://attacker.test"))).status, 403);
});

test("salvar não expõe chave, campo vazio mantém e testar não cria cobranças nem altera configuração", async context => {
  fakeEnvironment(context); const f = fixture();
  const saved = await f.route.PUT(request("PUT", { apiKey, environment: "production", webhookToken }));
  assert.equal(saved.status, 200);
  const savedText = await saved.text(); assert.ok(!savedText.includes(apiKey)); assert.ok(!savedText.includes(webhookToken));
  assert.ok(!f.record()!.apiKeyEncrypted!.includes(apiKey));
  const previous = f.record();
  const tested = await f.route.POST(request("POST", {}));
  assert.equal(tested.status, 200); assert.ok(!(await tested.text()).includes("Private customer")); assert.equal(f.record(), previous);
  assert.equal((await f.route.PUT(request("PUT", { apiKey: "", environment: "production" }))).status, 200);
  assert.equal(asaasRuntimeConfig(f.record()).apiKey, apiKey);
  assert.equal((await f.route.PUT(request("PUT", { environment: "sandbox" }))).status, 400);
  assert.equal((await f.route.DELETE(request("DELETE"))).status, 200);
  assert.equal(f.record()!.apiKeyEncrypted, null); assert.equal(f.record()!.webhookTokenEncrypted, null);
});

test("requisições usam somente hosts oficiais, cabeçalho secreto e bloqueiam redirecionamento", async () => {
  const baseUrl = "https://api.asaas.com/v3";
  const fakeFetch: typeof fetch = async (url, options) => {
    assert.equal(url, baseUrl + "/customers?limit=1");
    assert.equal(new Headers(options?.headers).get("access_token"), apiKey);
    assert.equal(options?.redirect, "error"); assert.ok(!String(options?.body).includes(apiKey));
    return Response.json({ data: [] });
  };
  await requestAsaasWithConfig({ apiKey, baseUrl }, "/customers?limit=1", { headers: { access_token: "injected" } }, fakeFetch);
  await assert.rejects(() => requestAsaasWithConfig({ apiKey, baseUrl: "https://attacker.test" }, "/customers", {}, fakeFetch), AsaasApiError);
});
