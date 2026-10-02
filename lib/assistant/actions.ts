import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";
import { getAction, validateActionInput } from "./catalog";
import { dispatchAssistantAction } from "./dispatch";
import { sanitizeAssistantData } from "./data";
import { AssistantError, type ActionView } from "./types";

export function publicAction(action: { id: string; name: string; input: unknown; status: string; result: unknown }, auth: AuthUser): ActionView {
  const target = action.result && typeof action.result === "object" && "targetLabel" in action.result ? action.result.targetLabel : null;
  return { id: action.id, name: action.name, label: `${getAction(action.name, auth).label}${typeof target === "string" ? ` · ${target}` : ""}`, input: action.input as Record<string, unknown>, status: action.status as ActionView["status"], ...(action.result ? { result: action.result } : {}) };
}

async function targetLabel(name: string, input: Record<string, unknown>, auth: AuthUser): Promise<string | null> {
  if (typeof input.id !== "string") return null;
  const where = { id: input.id };
  const resource = name.replace(/^(editar|excluir|transferir)_/, "");
  let target: { name?: string | null; title?: string } | null = null;
  switch (resource) {
    case "tarefa": target = await prisma.task.findUnique({ where, select: { title: true } }); break;
    case "cliente": target = await prisma.client.findUnique({ where, select: { name: true } }); break;
    case "projeto": target = await prisma.project.findUnique({ where, select: { name: true } }); break;
    case "lead": target = await prisma.lead.findUnique({ where, select: { name: true } }); break;
    case "meta": {
      const row = await prisma.goal.findUnique({ where, select: { title: true, type: true } });
      if (row?.type === "REVENUE" && !canEdit(auth, "financeiro")) throw new AssistantError("Sem permissão para alterar metas financeiras.", 403);
      target = row; break;
    }
    case "servico": target = await prisma.service.findUnique({ where, select: { name: true } }); break;
    case "cartao": target = await prisma.creditCard.findUnique({ where, select: { name: true } }); break;
    case "despesa_fixa": target = await prisma.fixedExpense.findUnique({ where, select: { name: true } }); break;
    case "despesa_avulsa": target = await prisma.variableExpense.findUnique({ where, select: { name: true } }); break;
    case "recebimento": {
      const row = await prisma.receivable.findUnique({ where, select: { amount: true, asaasPaymentId: true, client: { select: { name: true } } } });
      if (row?.asaasPaymentId) throw new AssistantError("Cobranças sincronizadas com Asaas não são alteradas pelo assistente. Use a aba Cobranças.");
      if (row) target = { name: `${row.client.name} · ${row.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` };
      break;
    }
  }
  if (!target) throw new AssistantError("Registro não encontrado. Consulte novamente antes de alterar.", 404);
  return target.name || target.title || input.id;
}

export async function prepareAction(runId: string, auth: AuthUser, name: string, raw: unknown) {
  const definition = getAction(name, auth);
  const input = validateActionInput(definition, raw, auth);
  const ordered = Object.fromEntries(Object.keys(input).sort().map((key) => [key, input[key]]));
  const dedupeKey = createHash("sha256").update(JSON.stringify({ name, input: ordered })).digest("hex");
  const previous = await prisma.assistantAction.findUnique({ where: { runId_dedupeKey: { runId, dedupeKey } } });
  if (previous) return publicAction(previous, auth);
  const target = await targetLabel(name, input, auth);
  const action = await prisma.assistantAction.upsert({ where: { runId_dedupeKey: { runId, dedupeKey } }, update: {}, create: { runId, name, dedupeKey, input: input as Prisma.InputJsonObject, ...(target ? { result: { targetLabel: target } } : {}), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  return publicAction(action, auth);
}

export async function executeAction(id: string, auth: AuthUser, cancel = false): Promise<ActionView> {
  const action = await prisma.assistantAction.findFirst({ where: { id, run: { userId: auth.id } } });
  if (!action) throw new AssistantError("Ação não encontrada.", 404);
  const definition = getAction(action.name, auth);
  const input = validateActionInput(definition, action.input, auth);
  if (action.status !== "PENDING") return publicAction(action, auth);
  if (action.expiresAt.getTime() <= Date.now()) throw new AssistantError("Esta confirmação expirou. Envie um novo comando.", 409);
  // A condição impede duplicação entre abas, cliques ou instâncias do servidor.
  const claim = await prisma.assistantAction.updateMany({ where: { id, status: "PENDING", expiresAt: { gt: new Date() }, run: { userId: auth.id } }, data: { status: cancel ? "CANCELLED" : "RUNNING" } });
  if (!claim.count) {
    const current = await prisma.assistantAction.findUniqueOrThrow({ where: { id } });
    return publicAction(current, auth);
  }
  if (cancel) return { ...publicAction(action, auth), status: "CANCELLED" };
  const target = action.result && typeof action.result === "object" && "targetLabel" in action.result ? { targetLabel: action.result.targetLabel } : {};
  try {
    await targetLabel(action.name, input, auth);
    const result = await dispatchAssistantAction(definition, input);
    const output = { ...(result && typeof result === "object" ? result : { data: result }), ...target };
    const updated = await prisma.assistantAction.update({ where: { id }, data: { status: "COMPLETED", result: output as Prisma.InputJsonObject } });
    return publicAction(updated, auth);
  } catch (error) {
    // Uma falha depois do início nunca provoca repetição automática da operação.
    const message = error instanceof AssistantError ? error.message : "Não foi possível concluir a ação. Confira o registro no aplicativo antes de tentar novamente.";
    const updated = await prisma.assistantAction.update({ where: { id }, data: { status: "FAILED", result: { error: sanitizeAssistantData(message), ...target } as Prisma.InputJsonObject } });
    return publicAction(updated, auth);
  }
}
