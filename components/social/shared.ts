import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SocialOptions } from "@/lib/social/options";
export type Account = {
  id: string;
  name: string;
  provider: "INSTAGRAM" | "FACEBOOK";
  status: string;
  accountType?: string | null;
  tokenExpiresAt: string | null;
};
export type Asset = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  previewUrl?: string | null;
};
export type Target = {
  accountId: string;
  format: string;
  options: SocialOptions;
};
export type Post = {
  id: string;
  clientId: string;
  caption: string;
  format: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  lastError?: string | null;
  afterPublishError?: string | null;
  publishStartedAt?: string | null;
  seriesId?: string | null;
  client: { name: string };
  account: Pick<Account, "id" | "name" | "provider">;
};
export type Detail = {
  id: string;
  accountId: string;
  caption: string;
  format: string;
  media: Asset[];
  cover?: Asset | null;
  options: SocialOptions;
  scheduledAt: string | null;
  seriesId?: string | null;
};
export const states: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_APPROVAL: "Aguardando aprovação",
  SCHEDULED: "Agendado",
  PROCESSING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  UNCERTAIN: "Conferir na rede social",
};
export const formats: Record<string, string> = {
  POST: "Post",
  CAROUSEL: "Carrossel",
  REEL: "Reels",
  STORY: "Stories",
};
export const dayKey = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const clock = (value: string) =>
  new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
export const localStamp = (value: string) => dayKey(value) + "T" + clock(value);
export async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...init });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Não foi possível concluir.");
  return data;
}
export const mutation = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export async function uploadAsset(
  file: File,
  clientId: string,
  videoLimit: number,
  progress: (s: string) => void,
): Promise<Asset> {
  if (
    !["image/jpeg", "video/mp4"].includes(file.type) ||
    !file.size ||
    file.size > (file.type === "image/jpeg" ? 8 : videoLimit) * 1048576
  )
    throw Error(`Use JPEG de até 8 MB ou MP4 de até ${videoLimit} MB.`);
  const p = await api(
    "/api/social/media",
    mutation({ clientId, name: file.name, mime: file.type, bytes: file.size }),
  );
  if (p.provider === "VPS") {
    for (let offset = 0; offset < file.size; offset += p.upload.chunkBytes) {
      const chunk = file.slice(offset, offset + p.upload.chunkBytes);
      let sent = false;
      for (let attempt = 0; attempt < 3 && !sent; attempt++)
        try {
          const r = await fetch(
            `${p.upload.url}?index=${offset / p.upload.chunkBytes}`,
            {
              method: "PUT",
              body: chunk,
              credentials: "omit",
              redirect: "error",
              headers: {
                Authorization: `Bearer ${p.upload.token}`,
                "Content-Type": "application/octet-stream",
              },
              signal: AbortSignal.timeout(60000),
            },
          );
          sent = r.ok;
          if (!r.ok && r.status < 500) break;
        } catch {}
      if (!sent)
        throw Error(
          `O envio de ${file.name} foi interrompido. Tente novamente.`,
        );
      progress(
        `${file.name}: ${Math.round((Math.min(offset + chunk.size, file.size) / file.size) * 100)}%`,
      );
    }
  } else {
    const { error } = await createSupabaseBrowserClient()
      .storage.from("social-media")
      .uploadToSignedUrl(p.path, p.token, file, { contentType: file.type });
    if (error) throw Error(`Falha no envio de ${file.name}.`);
  }
  progress(`Conferindo ${file.name}…`);
  const verified = await api(
    "/api/social/media",
    mutation({ id: p.asset.id, clientId }, "PATCH"),
  );
  return { ...p.asset, previewUrl: verified.previewUrl };
}
