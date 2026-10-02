import { ATTACHMENT_MEDIA_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "./attachments";
import { AssistantError, type AssistantAttachment, type AttachmentMediaType } from "./types";

function matchesSignature(bytes: Buffer, mediaType: AttachmentMediaType) {
  switch (mediaType) {
    case "application/pdf": return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    case "image/jpeg": return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/gif": return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
    case "image/webp": return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
}

export function parseAssistantAttachments(raw: unknown): AssistantAttachment[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) throw new AssistantError(`Envie até ${MAX_ATTACHMENTS} arquivos por conversa.`);
  return raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new AssistantError("Anexo inválido.");
    const attachment = item as Record<string, unknown>;
    if (typeof attachment.name !== "string" || !attachment.name.trim() || attachment.name.length > 200 || /[\x00-\x1f]/.test(attachment.name)) throw new AssistantError("Nome do arquivo inválido.");
    if (!ATTACHMENT_MEDIA_TYPES.includes(attachment.mediaType as AttachmentMediaType)) throw new AssistantError("Envie um PDF ou uma imagem JPG, PNG, GIF ou WebP.");
    if (typeof attachment.data !== "string" || !attachment.data.length || attachment.data.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4) throw new AssistantError("Os anexos devem somar até 3 MB por conversa.", 413);
    if (attachment.data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.data)) throw new AssistantError("Conteúdo do arquivo inválido.");
    const bytes = Buffer.from(attachment.data, "base64");
    if (bytes.toString("base64") !== attachment.data || !matchesSignature(bytes, attachment.mediaType as AttachmentMediaType)) throw new AssistantError("O conteúdo do arquivo não corresponde ao formato informado.");
    return { name: attachment.name.trim(), mediaType: attachment.mediaType as AttachmentMediaType, data: attachment.data, size: bytes.length };
  });
}
