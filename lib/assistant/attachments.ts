import type { AttachmentMediaType, ChatMessage } from "./types";

// Base64 ocupa 4/3 do tamanho original. Mantém a requisição abaixo do limite da hospedagem.
export const MAX_ATTACHMENT_BYTES = 3_000_000;
export const MAX_ATTACHMENTS = 8;
export const MAX_CHAT_BODY_BYTES = 4_300_000;
export const ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp";
export const ATTACHMENT_MEDIA_TYPES: readonly AttachmentMediaType[] = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

export function attachmentMediaType(name: string, mediaType: string): AttachmentMediaType | null {
  if (ATTACHMENT_MEDIA_TYPES.includes(mediaType as AttachmentMediaType)) return mediaType as AttachmentMediaType;
  if (mediaType && mediaType !== "application/octet-stream") return null;
  const extension = name.toLowerCase().split(".").pop() || "";
  const types: Record<string, AttachmentMediaType> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
  return Object.hasOwn(types, extension) ? types[extension] : null;
}

/** Mantém os anexos antigos como contexto mesmo quando o histórico textual é resumido. */
export function assistantConversationContext(messages: ChatMessage[]): ChatMessage[] {
  let start = Math.max(0, messages.length - 21);
  if (messages[start]?.role === "assistant") start++;
  const context = messages.slice(start).map(({ role, content, attachments }) => ({ role, content, ...(attachments?.length ? { attachments } : {}) }));
  const earlierAttachments = messages.slice(0, start).flatMap((message) => message.attachments || []);
  if (earlierAttachments.length && context[0]) {
    context[0] = { ...context[0], attachments: [...earlierAttachments, ...(context[0].attachments || [])] };
  }
  return context;
}
