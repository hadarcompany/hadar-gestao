import { SocialError, type Provider } from "./core";
export type SocialMedia = {
  id: string;
  path: string;
  name: string;
  mime: string;
  bytes: number;
};
export const FORMATS = ["POST", "CAROUSEL", "REEL", "STORY"] as const;
export function validateContent(
  p: Provider,
  format: string,
  caption: string,
  media: Pick<SocialMedia, "mime">[],
) {
  if (!(FORMATS as readonly string[]).includes(format))
    throw new SocialError("Formato inválido.");
  if (caption.length > (p === "INSTAGRAM" ? 2200 : 5000))
    throw new SocialError("A legenda excede o limite permitido.");
  if (media.length > 10)
    throw new SocialError("Use até 10 arquivos por publicação.");
  if (media.some((m) => !["image/jpeg", "video/mp4"].includes(m.mime)))
    throw new SocialError("Use imagens JPEG ou vídeos MP4.");
  if (
    format === "CAROUSEL" &&
    (media.length < 2 || media.some((m) => m.mime !== "image/jpeg"))
  )
    throw new SocialError("O carrossel precisa de 2 a 10 imagens JPEG.");
  if (
    format === "REEL" &&
    (media.length !== 1 || media[0].mime !== "video/mp4")
  )
    throw new SocialError("Selecione um vídeo MP4 para o Reel.");
  if (format === "STORY" && media.length !== 1)
    throw new SocialError("Selecione uma imagem ou vídeo para o Story.");
  if (
    format === "POST" &&
    (media.length > 1 || media.some((m) => m.mime !== "image/jpeg"))
  )
    throw new SocialError(
      "Use uma imagem JPEG no post; para vídeo, escolha Reel.",
    );
  if (p === "INSTAGRAM" && media.length === 0)
    throw new SocialError("O Instagram precisa de uma imagem ou vídeo.");
  if (!media.length && !caption.trim())
    throw new SocialError("Inclua uma legenda ou mídia.");
}
export function scheduledDate(value: unknown) {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new SocialError("Informe data e horário com fuso.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() + 60000)
    throw new SocialError("Agende para pelo menos um minuto no futuro.");
  if (date.getTime() > Date.now() + 366 * 86400000)
    throw new SocialError("Agende para até um ano no futuro.");
  return date;
}
