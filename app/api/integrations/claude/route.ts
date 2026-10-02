import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { AssistantError } from "@/lib/assistant/types";
import { checkAssistantOrigin } from "@/lib/assistant/http";
import { DEFAULT_ASSISTANT_MODEL, parseAssistantIntegrationInput, requireAssistantIntegrationAdmin } from "@/lib/assistant/integration";
import { encryptAssistantKey } from "@/lib/assistant/integration-crypto";
import { assistantIntegrationStatus, getAssistantIntegrationStatus, getAssistantRuntimeConfig, type AssistantRuntimeConfig } from "@/lib/assistant/integration-server";
import { callClaude } from "@/lib/assistant/claude";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof AssistantError ? error.message : error instanceof SyntaxError ? "Configuração inválida." : "Não foi possível atualizar a integração Claude.", ...(error instanceof AssistantError && error.code ? { code: error.code } : {}) }, { status: error instanceof AssistantError ? error.status : error instanceof SyntaxError ? 400 : 500, headers });
}

async function readInput(req: NextRequest) {
  if (Number(req.headers.get("content-length")) > 4096) throw new AssistantError("Configuração muito longa.", 413);
  const text = await req.text();
  if (text.length > 4096) throw new AssistantError("Configuração muito longa.", 413);
  return parseAssistantIntegrationInput(JSON.parse(text));
}

export async function GET() {
  try {
    requireAssistantIntegrationAdmin(await getServerAuth());
    return NextResponse.json(await getAssistantIntegrationStatus(), { headers });
  } catch (error) { return failure(error); }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = requireAssistantIntegrationAdmin(await getServerAuth());
    checkAssistantOrigin(req);
    const input = await readInput(req);
    const existing = await prisma.assistantIntegration.findUnique({ where: { id: "primary" } });
    if (!input.apiKey && !existing?.apiKeyEncrypted && !process.env.ANTHROPIC_API_KEY?.trim()) throw new AssistantError("Informe a chave API do Claude para conectar.");
    const data = { enabled: true, model: input.model || existing?.model || process.env.ANTHROPIC_MODEL || DEFAULT_ASSISTANT_MODEL, updatedById: auth.id, ...(input.apiKey ? { apiKeyEncrypted: encryptAssistantKey(input.apiKey) } : {}), ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}) };
    const saved = await prisma.assistantIntegration.upsert({ where: { id: "primary" }, create: { id: "primary", ...data }, update: data });
    return NextResponse.json(assistantIntegrationStatus(saved), { headers });
  } catch (error) { return failure(error); }
}

// Testa a chave digitada ou a configuração salva. Nunca altera registros do aplicativo.
export async function POST(req: NextRequest) {
  try {
    requireAssistantIntegrationAdmin(await getServerAuth());
    checkAssistantOrigin(req);
    const input = await readInput(req);
    const config: AssistantRuntimeConfig = input.apiKey ? { apiKey: input.apiKey, model: input.model || DEFAULT_ASSISTANT_MODEL, workspaceId: (await getAssistantIntegrationStatus()).workspaceId || undefined } : await getAssistantRuntimeConfig();
    if (input.model) config.model = input.model;
    if (input.workspaceId !== undefined) config.workspaceId = input.workspaceId || undefined;
    await callClaude([{ role: "user", content: "Responda apenas OK." }], "Teste de conexão. Responda apenas OK, sem ferramentas.", [], fetch, config, 32);
    return NextResponse.json({ connected: true, model: config.model }, { headers });
  } catch (error) { return failure(error); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAssistantIntegrationAdmin(await getServerAuth());
    checkAssistantOrigin(req);
    // Desativar explicitamente impede que uma chave legada do ambiente reconecte a IA.
    const data = { enabled: false, apiKeyEncrypted: null, workspaceId: null, updatedById: auth.id };
    const saved = await prisma.assistantIntegration.upsert({ where: { id: "primary" }, create: { id: "primary", ...data }, update: data });
    return NextResponse.json(assistantIntegrationStatus(saved), { headers });
  } catch (error) { return failure(error); }
}
