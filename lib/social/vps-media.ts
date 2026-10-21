import { createHmac } from "node:crypto";
import { SocialError } from "./core";
import type { SocialMedia } from "./validation";

export const CHUNK_BYTES = 8 * 1024 * 1024;
export function usesVpsMedia() {
  return process.env.SOCIAL_MEDIA_PROVIDER === "VPS";
}
export function mediaVideoLimitMB() {
  return usesVpsMedia() ? 200 : 50;
}
function config() {
  const url = new URL(
    process.env.SOCIAL_VPS_MEDIA_URL || "https://unconfigured.invalid",
  );
  const secret = process.env.SOCIAL_VPS_MEDIA_SECRET || "";
  const instance = process.env.SOCIAL_VPS_MEDIA_INSTANCE || "";
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.hostname === "unconfigured.invalid" ||
    secret.length < 32 ||
    !/^[a-z0-9-]{1,48}$/.test(instance)
  )
    throw new SocialError(
      "O armazenamento de vídeos precisa ser configurado pela Hadar.",
      503,
    );
  return { url, secret, instance };
}
export function mediaTicket(
  asset: SocialMedia,
  action: "init" | "upload" | "complete" | "info" | "read" | "delete",
) {
  const { secret, instance } = config();
  if (!/^[a-f0-9]{16}\/[a-f0-9-]{36}\.(jpg|mp4)$/.test(asset.path))
    throw new SocialError("Caminho de mídia inválido.");
  const payload = Buffer.from(
    JSON.stringify({
      i: instance,
      p: asset.path,
      s: asset.bytes,
      m: asset.mime,
      a: action,
      e:
        Math.floor(Date.now() / 1000) +
        (action === "upload" ? 7200 : action === "read" ? 3600 : 300),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export async function vpsOperation(
  asset: SocialMedia,
  action: "init" | "complete" | "info" | "delete",
) {
  const { url } = config();
  let response: Response;
  try {
    response = await fetch(new URL(`/v1/${action}`, url), {
      method: action === "info" ? "GET" : "POST",
      headers: { Authorization: `Bearer ${mediaTicket(asset, action)}` },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new SocialError(
      "O armazenamento está indisponível. Tente novamente.",
      503,
    );
  }
  if (!response.ok)
    throw new SocialError(
      response.status === 507
        ? "O espaço reservado para mídias está cheio."
        : "O envio ainda não terminou ou o armazenamento está indisponível.",
      response.status === 507 ? 409 : 503,
    );
  return response.json() as Promise<{ bytes: number; mime: string }>;
}
export function vpsUpload(asset: SocialMedia) {
  return {
    url: new URL("/v1/chunk", config().url).href,
    token: mediaTicket(asset, "upload"),
    chunkBytes: CHUNK_BYTES,
  };
}
export function vpsRead(asset: SocialMedia) {
  const url = new URL("/v1/read", config().url);
  url.searchParams.set("ticket", mediaTicket(asset, "read"));
  return url.href;
}
