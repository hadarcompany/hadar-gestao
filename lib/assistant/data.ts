import { AssistantError, type ChatMessage } from "./types";

const SECRET_FIELDS = /password|secret|token|api.?key|encrypted|permissions|logoUrl|image|accesses|asaasCustomerId|cpfCnpj/i;

/** Não envia credenciais, imagens ou cadastros de acesso ao provedor. */
export function sanitizeAssistantData(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[conteúdo resumido]";
  if (typeof value === "string") {
    if (value.startsWith("data:")) return "[arquivo omitido]";
    return value.replace(/sk-ant-[\w-]+/g, "[chave omitida]").slice(0, 8000);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAssistantData(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_FIELDS.test(key)).map(([key, item]) => [key, sanitizeAssistantData(item, depth + 1)]));
  return value;
}

export function normalizeSearch(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

export function listResult(data: unknown, search = "", offset = 0) {
  if (!Array.isArray(data)) return { dados: sanitizeAssistantData(data) };
  const filtered = search ? data.filter((item) => normalizeSearch(JSON.stringify(sanitizeAssistantData(item))).includes(normalizeSearch(search))) : data;
  return { total: filtered.length, offset, proximoOffset: offset + 30 < filtered.length ? offset + 30 : null, registros: filtered.slice(offset, offset + 30).map((item) => sanitizeAssistantData(item)) };
}

export function parseChatBody(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AssistantError("Comando inválido.");
  const body = raw as Record<string, unknown>;
  if (typeof body.requestId !== "string" || !/^[\w-]{10,100}$/.test(body.requestId)) throw new AssistantError("Identificador da requisição inválido.");
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 24) throw new AssistantError("Envie até 24 mensagens por conversa.");
  let length = 0;
  const messages: ChatMessage[] = body.messages.map((rawMessage) => {
    if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) throw new AssistantError("Mensagem inválida.");
    const message = rawMessage as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string" || !message.content.trim() || message.content.length > 8000) throw new AssistantError("Mensagem inválida ou muito longa.");
    length += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (length > 32000 || messages[0].role !== "user" || messages[messages.length - 1].role !== "user") throw new AssistantError("Histórico inválido ou muito longo. Inicie uma nova conversa.");
  if (body.autoExecute !== undefined && typeof body.autoExecute !== "boolean") throw new AssistantError("Modo de execução inválido.");
  return { requestId: body.requestId, messages, autoExecute: body.autoExecute === true };
}
