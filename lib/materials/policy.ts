export const MATERIAL_MIMES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4",
};
export const MATERIAL_CHUNK = 8 * 1024 * 1024;
export interface MaterialAsset { id: string; path: string; name: string; mime: string; bytes: number }
export class MaterialError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateFiles(input: unknown): Array<{name: string; mime: string; bytes: number}> {
  if (!Array.isArray(input) || input.length > 10) throw new MaterialError("Envie até 10 arquivos por solicitação.");
  let total = 0;
  return input.map(file => {
    if (!file || typeof file.name !== "string" || !Object.prototype.hasOwnProperty.call(MATERIAL_MIMES,file.mime) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > (file.mime === "video/mp4" ? 200 : 20) * 1024 ** 2) {
      throw new MaterialError("Use JPG, PNG ou WebP de até 20 MB e vídeos MP4 de até 200 MB.");
    }
    total += file.bytes;
    if (total > 500 * 1024 ** 2) throw new MaterialError("O total por envio deve ser de até 500 MB.");
    const name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 180).trim();
    if (!name) throw new MaterialError("Nome de arquivo inválido.");
    return {name, mime: file.mime, bytes: file.bytes};
  });
}
export function materialAssignee(needsEditing: boolean, config: Record<string,string|undefined> = process.env) {
  const email = needsEditing ? config.MATERIALS_EDITOR_EMAIL : config.MATERIALS_READY_EMAIL;
  if (!email) throw new MaterialError("A distribuição das tarefas precisa ser configurada pela equipe.", 503);
  return email;
}
export function validateSubmission(input: unknown) {
  const value = input as Record<string, unknown> | null;
  if (!value || typeof value.observations !== "string" || value.observations.trim().length < 3 || value.observations.length > 10000 || typeof value.needsEditing !== "boolean") {
    throw new MaterialError("Descreva o material e informe se precisa de edição.");
  }
  return {observations: value.observations.trim(), needsEditing: value.needsEditing};
}
