export function pickWritableFields(body: unknown, fields: readonly string[]) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Corpo inválido.");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !fields.includes(key))) throw new Error("Campo não permitido.");
  return { ...input };
}

export const TASK_FIELDS = ["title", "type", "description", "status", "priority", "startDate", "dueDate", "publishDate", "isExtra", "area", "projectId", "labelIds", "estimatedTime", "actualTime", "checklist", "extraFields", "tags", "assigneeIds", "clientId"] as const;
export const CLIENT_FIELDS = ["name", "email", "phone", "cpfCnpj", "driveLink", "contractLink", "briefing", "status", "contractStartDate", "renewalDate", "classification", "brandColors", "brandFontPrimary", "brandFontSecondary"] as const;
