/** HEIC pode chegar do navegador com MIME vazio ou application/octet-stream. */
type ImageFile = { name?: string; fileName?: string; type?: string; mimeType?: string };

export const IMAGE_FILE_ACCEPT = "image/*,.heic,.heif,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.tif,.tiff,.svg";
const IMAGE_EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", bmp: "image/bmp", tif: "image/tiff",
  tiff: "image/tiff", svg: "image/svg+xml",
};
const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function isHeicImage(file: ImageFile): boolean {
  return HEIC_TYPES.has((file.type || file.mimeType || "").toLowerCase())
    || /\.(heic|heif)$/i.test(file.name || file.fileName || "");
}

export function isImageFile(file: ImageFile): boolean {
  const extension = (file.name || file.fileName || "").split(".").pop()?.toLowerCase() || "";
  return (file.type || file.mimeType || "").startsWith("image/") || isHeicImage(file) || Boolean(IMAGE_EXTENSION_TYPES[extension]);
}

/** SVG continua sendo baixado como arquivo, sem exibição inline. */
export function isPreviewableImage(file: ImageFile): boolean {
  return INLINE_IMAGE_TYPES.has(file.type || file.mimeType || "") || isHeicImage(file);
}

export function imageMimeType(file: ImageFile): string {
  if (isHeicImage(file)) {
    return /\.heif$/i.test(file.name || file.fileName || "") ? "image/heif" : "image/heic";
  }
  const mimeType = file.type || file.mimeType || "";
  const extension = (file.name || file.fileName || "").split(".").pop()?.toLowerCase() || "";
  return (!mimeType || mimeType === "application/octet-stream")
    ? IMAGE_EXTENSION_TYPES[extension] || mimeType || "application/octet-stream"
    : mimeType;
}

/** Usado na foto do perfil, antes da prévia e do salvamento em data URL. */
export async function prepareImageForDisplay(file: File): Promise<Blob> {
  if (!isHeicImage(file)) return file;
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/images/convert", { method: "POST", body });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Não foi possível abrir a imagem HEIC.");
  }
  return response.blob();
}
