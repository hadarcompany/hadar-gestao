import { AssistantError, type ChatMessage } from "./types";
import { parseAssistantAttachments } from "./attachments-server";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "./attachments";

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
  let attachmentBytes = 0;
  let attachmentCount = 0;
  const messages: ChatMessage[] = body.messages.map((rawMessage) => {
    if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) throw new AssistantError("Mensagem inválida.");
    const message = rawMessage as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string" || !message.content.trim() || message.content.length > 8000) throw new AssistantError("Mensagem inválida ou muito longa.");
    length += message.content.length;
    const attachments = parseAssistantAttachments(message.attachments);
    if (message.role === "assistant" && attachments.length) throw new AssistantError("Anexos só podem ser enviados pelo usuário.");
    attachmentBytes += attachments.reduce((total, attachment) => total + attachment.size, 0);
    attachmentCount += attachments.length;
    if (attachmentBytes > MAX_ATTACHMENT_BYTES) throw new AssistantError("Os anexos devem somar até 3 MB por conversa. Inicie uma nova conversa para enviar outros arquivos.", 413);
    if (attachmentCount > MAX_ATTACHMENTS) throw new AssistantError(`Envie até ${MAX_ATTACHMENTS} arquivos por conversa.`);
    return { role: message.role, content: message.content, ...(attachments.length ? { attachments } : {}) };
  });
  if (length > 32000 || messages[0].role !== "user" || messages[messages.length - 1].role !== "user") throw new AssistantError("Histórico inválido ou muito longo. Inicie uma nova conversa.");
  if (body.autoExecute !== undefined && typeof body.autoExecute !== "boolean") throw new AssistantError("Modo de execução inválido.");
  return { requestId: body.requestId, messages, autoExecute: body.autoExecute === true };
}
