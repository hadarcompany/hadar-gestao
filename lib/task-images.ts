import { isImageFile } from "./image-files";

export const MAX_TASK_IMAGES = 10;
export const MAX_TASK_IMAGE_BYTES = 8 * 1024 * 1024;

/** Alguns navegadores expõem arquivos copiados apenas em files, outros em items. */
export function transferredFiles(transfer: Pick<DataTransfer, "files" | "items"> | null): File[] {
  if (!transfer) return [];
  const files = Array.from(transfer.files ?? []);
  if (files.length) return files;
  return Array.from(transfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/** Um único caminho de validação para seleção, arrastar e colar. */
export function addTaskImages(current: File[], incoming: File[]) {
  const added: File[] = [];
  const errors = new Set<string>();
  for (const file of incoming) {
    const name = file.name || "Imagem colada";
    if (!isImageFile(file)) {
      errors.add(`${name}: selecione um arquivo de imagem.`);
    } else if (file.size === 0) {
      errors.add(`${name}: o arquivo está vazio.`);
    } else if (file.size > MAX_TASK_IMAGE_BYTES) {
      errors.add(`${name}: cada imagem deve ter no máximo 8 MB.`);
    } else if (current.length + added.length >= MAX_TASK_IMAGES) {
      errors.add("É possível adicionar até 10 imagens por tarefa.");
    } else {
      added.push(file);
    }
  }
  return { files: [...current, ...added], added, error: [...errors].join(" ") || null };
}
