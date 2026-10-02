export type AttachmentMediaType = "application/pdf" | "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export type AssistantAttachment = { name: string; mediaType: AttachmentMediaType; data: string; size: number };
export type ChatMessage = { role: "user" | "assistant"; content: string; attachments?: AssistantAttachment[] };
export type ActionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ActionView = {
  id: string;
  name: string;
  label: string;
  input: Record<string, unknown>;
  status: ActionStatus;
  result?: unknown;
};
export type AssistantReply = { text: string; actions: ActionView[]; navigation?: string; usage?: { inputTokens: number; outputTokens: number } };
export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
};
export class AssistantError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
