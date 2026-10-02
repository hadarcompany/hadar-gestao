import { AssistantError, type ToolDefinition, type AttachmentMediaType, type ChatMessage } from "./types";
import type { AssistantRuntimeConfig } from "./integration-server";
import { claudeProviderError } from "./provider-errors";

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type ImageBlock = { type: "image"; source: { type: "base64"; media_type: Exclude<AttachmentMediaType, "application/pdf">; data: string } };
export type DocumentBlock = { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };
export type ClaudeMessage = { role: "user" | "assistant"; content: string | (TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock | DocumentBlock)[] };
export type ClaudeResponse = { content: (TextBlock | ToolUseBlock)[]; stop_reason: string; usage: { input_tokens: number; output_tokens: number } };

export function chatMessageToClaude(message: ChatMessage): ClaudeMessage {
  if (!message.attachments?.length) return { role: message.role, content: message.content };
  const content: (TextBlock | ImageBlock | DocumentBlock)[] = [];
  for (const attachment of message.attachments) {
    content.push({ type: "text", text: `Arquivo de contexto enviado pelo usuário: ${attachment.name}` });
    if (attachment.mediaType === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.data } });
    else content.push({ type: "image", source: { type: "base64", media_type: attachment.mediaType, data: attachment.data } });
  }
  content.push({ type: "text", text: message.content });
  return { role: message.role, content };
}

export async function callClaude(messages: ClaudeMessage[], system: string, tools: ToolDefinition[], fetcher: typeof fetch = fetch, runtimeConfig?: AssistantRuntimeConfig, maxTokens = 2048): Promise<ClaudeResponse> {
  const config = runtimeConfig || await (await import("./integration-server")).getAssistantRuntimeConfig();
  let response: Response;
  try {
    response = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(35000),
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", ...(config.workspaceId ? { "anthropic-workspace-id": config.workspaceId } : {}) },
      body: JSON.stringify({ model: config.model, max_tokens: maxTokens, system, messages, ...(tools.length ? { tools } : {}) }),
    });
  } catch { throw new AssistantError("Não foi possível conectar ao Claude. Confira o resultado das ações abaixo antes de tentar novamente.", 502); }
  if (!response.ok) {
    // Não repassa o erro bruto nem repete comandos. A mensagem distingue configuração de arquivos.
    throw claudeProviderError(response.status, await response.json().catch(() => null));
  }
  const data = await response.json() as ClaudeResponse;
  if (!Array.isArray(data.content)) throw new AssistantError("O Claude retornou uma resposta inválida.", 502);
  // Respostas só podem conter texto e chamadas das ferramentas permitidas.
  return { ...data, content: data.content.filter((block) => block.type === "text" || block.type === "tool_use") };
}
