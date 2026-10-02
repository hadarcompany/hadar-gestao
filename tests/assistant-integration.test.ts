import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ASSISTANT_MODEL, parseAssistantIntegrationInput, requireAssistantIntegrationAdmin } from "../lib/assistant/integration";
import { decryptAssistantKey, encryptAssistantKey } from "../lib/assistant/integration-crypto";
import { assistantIntegrationStatus, assistantRuntimeConfig } from "../lib/assistant/integration-server";
import { callClaude } from "../lib/assistant/claude";
import { AssistantError } from "../lib/assistant/types";
import type { AuthUser } from "../types/auth";

const fakeKey = "sk-ant-fictitious-key-for-unit-tests-only";
const admin: AuthUser = { id: "admin-test", name: "Admin", email: "test@example.com", role: "ADMIN", image: null, permissions: null };

test("apenas administradores configuram a integração e campos internos são recusados", () => {
  assert.equal(requireAssistantIntegrationAdmin(admin), admin);
  assert.throws(() => requireAssistantIntegrationAdmin(null), (error: unknown) => error instanceof AssistantError && error.status === 401);
  assert.throws(() => requireAssistantIntegrationAdmin({ ...admin, role: "MEMBER" }), (error: unknown) => error instanceof AssistantError && error.status === 403);
  assert.deepEqual(parseAssistantIntegrationInput({ apiKey: ` ${fakeKey} `, model: DEFAULT_ASSISTANT_MODEL }), { apiKey: fakeKey, model: DEFAULT_ASSISTANT_MODEL });
  assert.deepEqual(parseAssistantIntegrationInput({ apiKey: "" }), { apiKey: undefined, model: undefined });
  for (const input of [{ apiKey: "https://example.com" }, { apiKey: 1 }, { apiKey: fakeKey, enabled: true }, { apiKeyEncrypted: "x" }, { model: "https://api.example.com" }, { model: "claude-sonnet\n4" }]) assert.throws(() => parseAssistantIntegrationInput(input), AssistantError);
});

test("chave é criptografada com nonce único, autenticação e origem estável", (context) => {
  const before = { integration: process.env.INTEGRATIONS_ENCRYPTION_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY };
  context.after(() => {
    if (before.integration === undefined) delete process.env.INTEGRATIONS_ENCRYPTION_KEY; else process.env.INTEGRATIONS_ENCRYPTION_KEY = before.integration;
    if (before.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = before.service;
  });
  delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-server-secret-for-tests-at-least-32-characters";
  const first = encryptAssistantKey(fakeKey);
  const second = encryptAssistantKey(fakeKey);
  assert.notEqual(first, second);
  assert.ok(!first.includes(fakeKey));
  assert.equal(decryptAssistantKey(first), fakeKey);
  const parts = first.split(".");
  const data = Buffer.from(parts[4], "base64url"); data[0] ^= 1; parts[4] = data.toString("base64url");
  assert.throws(() => decryptAssistantKey(parts.join(".")), AssistantError);
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "another-stable-integration-secret-for-tests";
  // Ativar uma chave mestra dedicada não invalida registros feitos com a derivação anterior.
  assert.equal(decryptAssistantKey(first), fakeKey);
  const dedicated = encryptAssistantKey(fakeKey);
  assert.equal(decryptAssistantKey(dedicated), fakeKey);
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "a-different-stable-integration-secret-for-tests";
  assert.throws(() => decryptAssistantKey(dedicated), AssistantError);
});

test("configuração do aplicativo prevalece e desconectar bloqueia fallback do ambiente", (context) => {
  const vars = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "INTEGRATIONS_ENCRYPTION_KEY"] as const;
  const previous = Object.fromEntries(vars.map((key) => [key, process.env[key]]));
  context.after(() => { for (const key of vars) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  process.env.ANTHROPIC_API_KEY = "fake-legacy-server-key";
  process.env.ANTHROPIC_MODEL = DEFAULT_ASSISTANT_MODEL;
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "stable-integration-secret-for-tests-at-least-32";
  const record = { enabled: true, apiKeyEncrypted: encryptAssistantKey(fakeKey), model: "claude-test-model", updatedAt: new Date("2026-10-02T12:00:00Z") };
  assert.deepEqual(assistantRuntimeConfig(record), { apiKey: fakeKey, model: "claude-test-model" });
  const status = assistantIntegrationStatus(record);
  assert.equal(status.source, "app");
  assert.ok(!JSON.stringify(status).includes(record.apiKeyEncrypted));
  assert.ok(!JSON.stringify(status).includes(fakeKey));
  assert.deepEqual(assistantRuntimeConfig(null), { apiKey: "fake-legacy-server-key", model: DEFAULT_ASSISTANT_MODEL });
  assert.equal(assistantIntegrationStatus({ ...record, enabled: false, apiKeyEncrypted: null }).configured, false);
  assert.throws(() => assistantRuntimeConfig({ ...record, enabled: false, apiKeyEncrypted: null }), AssistantError);
});

test("teste de conexão usa configuração recebida só no servidor, sem ferramentas", async () => {
  await callClaude([{ role: "user", content: "Responda apenas OK." }], "Teste", [], async (_url, options) => {
    assert.equal((options?.headers as Record<string, string>)["x-api-key"], fakeKey);
    const body = JSON.parse(String(options?.body));
    assert.equal(body.max_tokens, 32);
    assert.equal(body.model, "claude-test-model");
    assert.equal(body.tools, undefined);
    assert.ok(!String(options?.body).includes(fakeKey));
    return new Response(JSON.stringify({ content: [{ type: "text", text: "OK" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }));
  }, { apiKey: fakeKey, model: "claude-test-model" }, 32);
});
