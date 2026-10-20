import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { guardApiRequest } from "@/lib/api-guard";
import { AsaasApiError, ASAAS_KEY_CONTEXT, ASAAS_WEBHOOK_CONTEXT, asaasIntegrationStatus, asaasRuntimeConfig, parseAsaasIntegrationInput } from "@/lib/asaas-integration";
import { getAsaasConfig } from "@/lib/asaas-integration-server";
import { encryptIntegrationSecret } from "@/lib/integrations/crypto";
import { requestAsaasWithConfig } from "@/lib/asaas";
import { publicOrigin } from "@/lib/public-url";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
function failure(error: unknown) {
  // Never forward the provider's raw payload, credentials or account data.
  const input = error instanceof AsaasApiError && [400, 503].includes(error.status);
  return NextResponse.json({ error: input ? error.message : "Não foi possível conectar ao Asaas. Confira a chave e o ambiente selecionado." }, { status: input ? error.status : 502, headers });
}
async function readInput(req: NextRequest) {
  if (Number(req.headers.get("content-length")) > 4096) throw new AsaasApiError("Configuração muito longa.", 400);
  const text = await req.text();
  if (text.length > 4096) throw new AsaasApiError("Configuração muito longa.", 400);
  try { return parseAsaasIntegrationInput(JSON.parse(text)); }
  catch (error) { if (error instanceof AsaasApiError) throw error; throw new AsaasApiError("Configuração inválida.", 400); }
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/integrations/asaas");
  if (denied) return denied;
  try { return NextResponse.json({ ...await getAsaasConfig(), webhookUrl: new URL("/api/webhooks/asaas", publicOrigin(req.url)).href }, { headers }); }
  catch { return NextResponse.json({ error: "Não foi possível consultar a configuração do Asaas." }, { status: 503, headers }); }
}

export async function PUT(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/integrations/asaas");
  if (denied) return denied;
  try {
    const input = await readInput(req);
    const existing = await prisma.asaasIntegration.findUnique({ where: { id: "primary" } });
    const status = asaasIntegrationStatus(existing);
    const environment = input.environment ?? status.environment;
    if (!input.apiKey && (!status.configured || environment !== status.environment)) throw new AsaasApiError("Informe uma chave para o ambiente selecionado.", 400);
    const apiKey = input.apiKey ?? asaasRuntimeConfig(existing).apiKey;
    parseAsaasIntegrationInput({ apiKey, environment });
    const data = { enabled: true, environment, apiKeyEncrypted: encryptIntegrationSecret(apiKey, ASAAS_KEY_CONTEXT), updatedById: auth.id, ...(input.webhookToken ? { webhookTokenEncrypted: encryptIntegrationSecret(input.webhookToken, ASAAS_WEBHOOK_CONTEXT) } : {}) };
    const saved = await prisma.asaasIntegration.upsert({ where: { id: "primary" }, create: { id: "primary", ...data }, update: data });
    return NextResponse.json({ ...asaasIntegrationStatus(saved), webhookUrl: new URL("/api/webhooks/asaas", publicOrigin(req.url)).href }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/integrations/asaas");
  if (denied) return denied;
  try {
    const input = await readInput(req);
    const existing = await prisma.asaasIntegration.findUnique({ where: { id: "primary" } });
    const environment = input.environment ?? asaasIntegrationStatus(existing).environment;
    const apiKey = input.apiKey ?? asaasRuntimeConfig(existing).apiKey;
    parseAsaasIntegrationInput({ apiKey, environment });
    const baseUrl = environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
    // Read-only connectivity check: creates no customer, charge or webhook.
    await requestAsaasWithConfig({ apiKey, baseUrl }, "/customers?limit=1");
    return NextResponse.json({ connected: true, environment }, { headers });
  } catch (error) { return failure(error); }
}

export async function DELETE(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/integrations/asaas");
  if (denied) return denied;
  try {
    const data = { enabled: false, apiKeyEncrypted: null, webhookTokenEncrypted: null, updatedById: auth.id };
    const saved = await prisma.asaasIntegration.upsert({ where: { id: "primary" }, create: { id: "primary", ...data }, update: data });
    return NextResponse.json({ ...asaasIntegrationStatus(saved), webhookUrl: new URL("/api/webhooks/asaas", publicOrigin(req.url)).href }, { headers });
  } catch (error) { return failure(error); }
}
