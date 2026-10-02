import { AssistantError } from "./types";

/** Classifica a resposta sem devolver mensagens arbitrárias, anexos ou credenciais do provedor. */
export function claudeProviderError(status: number, body: unknown): AssistantError {
  const error = body && typeof body === "object" && "error" in body ? body.error : null;
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message.slice(0, 4000).toLowerCase() : "";
  if (/not scoped to a workspace|anthropic-workspace-id.*(required|must include|must specify)|(?:must include|must specify|missing|required).*anthropic-workspace-id|workspace.*(must include|must specify)/.test(message)) return new AssistantError("Esta chave exige um workspace da Anthropic. Preencha o campo Workspace em Configurações > Integrações > Claude, ou use uma chave criada para um workspace específico.", 503, "WORKSPACE_REQUIRED");
  if (/workspace.*(not found|invalid|does not exist|access|permission)|(?:invalid|not.*(?:access|permission)).*workspace/.test(message)) return new AssistantError("A chave não tem acesso ao workspace informado, ou o ID está incorreto. Confira o campo Workspace em Integrações.", 503, "WORKSPACE_INVALID");
  if (/credit balance|insufficient credits?|not enough credits?|purchase credits|billing.*(inactive|disabled)|payment required/.test(message)) return new AssistantError("A conta Anthropic está sem créditos disponíveis para a API. Confira o saldo e a cobrança no Claude Console.", 402, "CREDITS_REQUIRED");
  if (status === 401) return new AssistantError("A chave do Claude não foi aceita. Confira-a em Configurações > Integrações.", 503, "INVALID_API_KEY");
  if (status === 403) return new AssistantError("A chave não tem permissão para esta operação na Anthropic. Confira a chave e o workspace em Integrações.", 503, "PERMISSION_DENIED");
  if (status === 429) return new AssistantError("O limite de uso do Claude foi atingido. Aguarde antes de enviar outro comando.", 429, "RATE_LIMITED");
  if (status === 404 || /model.*(not found|does not exist|not available|invalid)/.test(message)) return new AssistantError("O modelo configurado não está disponível para esta conta. Confira o campo Modelo do Claude em Integrações.", 503, "MODEL_NOT_FOUND");
  if (/(pdf|document)/.test(message) && /password|encrypt|decrypt/.test(message)) return new AssistantError("Um dos PDFs está protegido por senha ou criptografia. Envie uma cópia sem proteção ou imagens das páginas.", 400, "PDF_ENCRYPTED");
  if (/(pdf|document)/.test(message) && /invalid|corrupt|unsupported|unable to.*(process|parse)/.test(message)) return new AssistantError("A Anthropic não conseguiu ler um dos PDFs. Exporte-o novamente como PDF ou envie imagens das páginas.", 400, "PDF_INVALID");
  if (/image/.test(message) && /invalid|exceed|too large|dimension|unsupported|could not.*(process|decode)/.test(message)) return new AssistantError("A Anthropic não conseguiu ler uma das imagens. Envie-a novamente em JPG, PNG, GIF ou WebP, com resolução menor.", 400, "IMAGE_INVALID");
  if (status === 413 || /request.*too large/.test(message)) return new AssistantError("A solicitação ficou grande demais para a Anthropic. Divida os arquivos entre conversas menores.", 413, "REQUEST_TOO_LARGE");
  if (/context.*(limit|length)|too many tokens|maximum.*tokens|too many.*pages/.test(message)) return new AssistantError("Os arquivos ou o histórico ultrapassaram o limite de leitura do modelo. Divida os PDFs e inicie uma nova conversa.", 400, "CONTEXT_TOO_LARGE");
  if (status === 400) return new AssistantError("A Anthropic rejeitou a solicitação e não foi possível identificar a causa. Teste a conexão em Integrações antes de enviar novamente.", 502, "REQUEST_REJECTED");
  return new AssistantError("O Claude está indisponível no momento. Tente novamente mais tarde.", 502, "PROVIDER_UNAVAILABLE");
}
