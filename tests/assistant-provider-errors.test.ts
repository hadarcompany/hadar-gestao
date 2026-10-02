import assert from "node:assert/strict";
import { test } from "node:test";
import { callClaude } from "../lib/assistant/claude";
import { claudeProviderError } from "../lib/assistant/provider-errors";
import { AssistantError } from "../lib/assistant/types";

const workspaceError = "This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace.";

test("a recusa real da chave pessoal é diagnosticada mesmo com anexos, sem repetir chamadas", async () => {
  let calls = 0;
  await assert.rejects(() => callClaude([{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: "test-fixture" } }, { type: "text", text: "Leia este PDF" }] }], "Teste", [], async () => {
    calls++;
    return Response.json({ error: { type: "invalid_request_error", message: workspaceError } }, { status: 400 });
  }, { apiKey: "fictitious-key", model: "claude-sonnet-4-6" }), (error: unknown) => error instanceof AssistantError && error.code === "WORKSPACE_REQUIRED" && error.status === 503 && !error.message.includes("PDF"));
  assert.equal(calls, 1);
});

test("configuração, saldo, limite e arquivos têm orientações distintas sem expor o erro bruto", () => {
  const cases: [number, string, string][] = [
    [400, workspaceError, "WORKSPACE_REQUIRED"],
    [400, "Invalid anthropic-workspace-id header", "WORKSPACE_INVALID"],
    [403, "You do not have access to workspace", "WORKSPACE_INVALID"],
    [400, "Your credit balance is too low to access the API", "CREDITS_REQUIRED"],
    [401, "invalid key", "INVALID_API_KEY"],
    [403, "Missing permissions", "PERMISSION_DENIED"],
    [429, "rate limited", "RATE_LIMITED"],
    [404, "model not found", "MODEL_NOT_FOUND"],
    [400, "PDF is password protected", "PDF_ENCRYPTED"],
    [400, "Unable to parse document", "PDF_INVALID"],
    [400, "Invalid image", "IMAGE_INVALID"],
    [413, "request too large", "REQUEST_TOO_LARGE"],
    [400, "prompt exceeds context length limit", "CONTEXT_TOO_LARGE"],
    [400, "unrecognized request", "REQUEST_REJECTED"],
    [529, "overloaded", "PROVIDER_UNAVAILABLE"],
  ];
  for (const [status, message, code] of cases) {
    const error = claudeProviderError(status, { error: { message: `${message} SECRET_PRIVATE_FILE_CONTENT` } });
    assert.equal(error.code, code);
    assert.ok(!error.message.includes("SECRET_PRIVATE_FILE_CONTENT"));
  }
  for (const malformed of [null, "error", { error: null }, { error: { message: [] } }]) assert.equal(claudeProviderError(400, malformed).code, "REQUEST_REJECTED");
});
