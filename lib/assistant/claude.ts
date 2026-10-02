import { AssistantError, type ToolDefinition } from "./types";

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type ClaudeMessage = { role: "user" | "assistant"; content: string | (TextBlock | ToolUseBlock | ToolResultBlock)[] };
export type ClaudeResponse = { content: (TextBlock | ToolUseBlock)[]; stop_reason: string; usage: { input_tokens: number; output_tokens: number } };

export async function callClaude(messages: ClaudeMessage[], system: string, tools: ToolDefinition[], fetcher: typeof fetch = fetch): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AssistantError("O assistente ainda não foi configurado. Defina ANTHROPIC_API_KEY no servidor.", 503);
  let response: Response;
  try {
    response = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(35000),
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 2048, system, messages, ...(tools.length ? { tools } : {}) }),
    });
  } catch { throw new AssistantError("Não foi possível conectar ao Claude. Confira o resultado das ações abaixo antes de tentar novamente.", 502); }
  if (!response.ok) {
    // Não repassa corpo de erro nem chave, e não repete automaticamente comandos.
    if (response.status === 401 || response.status === 403) throw new AssistantError("A chave do Claude não foi aceita. Confira a configuração no servidor.", 503);
    if (response.status === 429) throw new AssistantError("O limite de uso do Claude foi atingido. Aguarde antes de enviar outro comando.", 429);
    if (response.status === 400 || response.status === 404) throw new AssistantError("O Claude recusou a solicitação. Confira o modelo configurado e o saldo da API.", 502);
    throw new AssistantError("O Claude está indisponível no momento. Tente novamente mais tarde.", 502);
  }
  const data = await response.json() as ClaudeResponse;
  if (!Array.isArray(data.content)) throw new AssistantError("O Claude retornou uma resposta inválida.", 502);
  // O histórico enviado não contém thinking, imagens ou ferramentas externas.
  return { ...data, content: data.content.filter((block) => block.type === "text" || block.type === "tool_use") };
}
