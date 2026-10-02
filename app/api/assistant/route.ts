import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { parseChatBody } from "@/lib/assistant/data";
import { AssistantError } from "@/lib/assistant/types";
import { runAssistant } from "@/lib/assistant/agent";
import { checkAssistantOrigin } from "@/lib/assistant/http";
import { MAX_CHAT_BODY_BYTES } from "@/lib/assistant/attachments";
import { getAssistantIntegrationStatus } from "@/lib/assistant/integration-server";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const { configured, model } = await getAssistantIntegrationStatus();
    return NextResponse.json({ configured, model }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível verificar a configuração do Assistente." }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let runId: string | undefined;
  try {
    checkAssistantOrigin(req);
    if (!(await getAssistantIntegrationStatus()).configured) throw new AssistantError("Configure a chave do Claude em Configurações > Integrações para usar o Assistente.", 503);
    if (Number(req.headers.get("content-length")) > MAX_CHAT_BODY_BYTES) throw new AssistantError("Arquivos ou comando muito grandes. Os anexos devem somar até 3 MB.", 413);
    const text = await req.text();
    if (Buffer.byteLength(text, "utf8") > MAX_CHAT_BODY_BYTES) throw new AssistantError("Arquivos ou comando muito grandes. Os anexos devem somar até 3 MB.", 413);
    const body = parseChatBody(JSON.parse(text));
    const run = await prisma.$transaction(async (db) => {
      // Serializa a admissão dos comandos por usuário entre instâncias do servidor.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auth.id}))`;
      const existing = await db.assistantRun.findUnique({ where: { userId_requestId: { userId: auth.id, requestId: body.requestId } } });
      if (existing) return existing;
      const minuteAgo = new Date(Date.now() - 60000);
      const count = await db.assistantRun.count({ where: { userId: auth.id, createdAt: { gte: minuteAgo } } });
      if (count >= 10) throw new AssistantError("Limite de 10 comandos por minuto. Aguarde antes de enviar outro.", 429);
      const active = await db.assistantRun.findFirst({ where: { userId: auth.id, status: { in: ["RUNNING", "PROCESSING"] }, createdAt: { gte: new Date(Date.now() - 180000) } } });
      if (active) throw new AssistantError("Você já tem um comando em andamento. Aguarde a conclusão.", 409);
      return db.assistantRun.create({ data: { userId: auth.id, requestId: body.requestId } });
    });
    // A resposta salva torna reenvios idempotentes. RUNNING nunca repete ferramentas.
    if (run.result) {
      const cached = run.result as Record<string, unknown>;
      return NextResponse.json(run.result, { status: typeof cached.error === "string" ? Number(cached.status) || 502 : 200, headers: { "Cache-Control": "no-store" } });
    }
    if (run.createdAt.getTime() < Date.now() - 30000) throw new AssistantError("Este comando foi interrompido ou ainda está em andamento. Consulte as ações no painel.", 409);
    // O requestId é exclusivo; só a chamada que criou a linha deve iniciar a execução.
    const claim = await prisma.assistantRun.updateMany({ where: { id: run.id, status: "RUNNING" }, data: { status: "PROCESSING" } });
    if (!claim.count) throw new AssistantError("Este comando já está em processamento. Aguarde.", 409);
    runId = run.id;
    const reply = await runAssistant(run.id, auth, body.messages, body.autoExecute);
    await prisma.assistantRun.update({ where: { id: run.id }, data: { status: "COMPLETED", result: reply as unknown as Prisma.InputJsonValue } });
    return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof AssistantError ? error.message : error instanceof SyntaxError ? "Comando inválido." : "Não foi possível processar o comando. Confira a configuração e a migração do assistente.";
    const status = error instanceof AssistantError ? error.status : error instanceof SyntaxError ? 400 : 500;
    const result = { error: message, status, ...(error instanceof AssistantError && error.code ? { code: error.code } : {}) };
    if (runId) await prisma.assistantRun.update({ where: { id: runId }, data: { status: "FAILED", result } }).catch(() => {});
    return NextResponse.json(result, { status });
  }
}
