import { createHmac } from "node:crypto";
import { MaterialAsset, MaterialError, MATERIAL_CHUNK, MATERIAL_MIMES } from "./policy";
function config() {
  const secret = process.env.MATERIALS_STORAGE_SECRET || "";
  const url = new URL(process.env.MATERIALS_STORAGE_URL || "https://unconfigured.invalid");
  if (secret.length < 32 || url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.hostname === "unconfigured.invalid") throw new MaterialError("Armazenamento não configurado.", 503);
  return {secret, url};
}
export function materialTicket(asset: MaterialAsset, action: string) {
  const {secret} = config();
  const ext = MATERIAL_MIMES[asset.mime];
  if (!ext || !new RegExp(`^[a-f0-9]{16}/[a-f0-9-]{36}\\.${ext}$`).test(asset.path)) throw new MaterialError("Arquivo inválido.");
  const payload = Buffer.from(JSON.stringify({i: "insider-materials", p: asset.path, s: asset.bytes, m: asset.mime, a: action, e: Math.floor(Date.now()/1000) + (action === "upload" ? 7200 : action === "read" ? 3600 : 300)})).toString("base64url");
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
}
function endpoint(action: string) { return new URL(`v1/${action}`, config().url.toString().replace(/\/?$/, "/")); }
export async function materialOperation(asset: MaterialAsset, action: "init" | "complete" | "info" | "delete") {
  try {
    const res = await fetch(endpoint(action), {method: action === "info" ? "GET" : "POST", headers: {Authorization: `Bearer ${materialTicket(asset, action)}`}, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(45000)});
    if (!res.ok) throw new MaterialError(res.status === 507 ? "O espaço para materiais está cheio. Avise a equipe." : "O arquivo ainda não terminou de subir ou o armazenamento está indisponível. Tente novamente.", res.status === 507 ? 409 : 503);
    return await res.json() as {bytes: number; mime: string; sha256: string};
  } catch (e) { if (e instanceof MaterialError) throw e; throw new MaterialError("Não foi possível acessar o armazenamento. Tente novamente.", 503); }
}
export function materialUpload(asset: MaterialAsset) { return {id: asset.id, url: endpoint("chunk").href, token: materialTicket(asset, "upload"), chunkBytes: MATERIAL_CHUNK}; }
export function materialRead(asset: MaterialAsset) { const url=endpoint("read");url.searchParams.set("ticket", materialTicket(asset,"read"));return url.href; }
export const MATERIAL_REFERENCE = "vps-material:";
export function materialReference(asset: MaterialAsset) { return MATERIAL_REFERENCE + JSON.stringify(asset); }
export function parseMaterialReference(value: string): MaterialAsset | null {
  if (!value.startsWith(MATERIAL_REFERENCE)) return null;
  try { const asset = JSON.parse(value.slice(MATERIAL_REFERENCE.length)); materialTicket(asset, "read"); return asset; }
  catch { throw new MaterialError("Referência de arquivo inválida.", 503); }
}
