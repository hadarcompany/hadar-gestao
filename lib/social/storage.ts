import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SocialError } from "./core";
import type { SocialMedia } from "./validation";
import { prisma } from "@/lib/prisma";
import { vpsOperation, vpsRead } from "./vps-media";
export const SOCIAL_BUCKET = "social-media";
export async function verifyAssets(assets: SocialMedia[]) {
  for (const asset of assets) {
    const record = await prisma.socialAsset.findUnique({
      where: { id: asset.id },
    });
    if (
      !record ||
      ["DELETING", "DELETED"].includes(record.state) ||
      record.path !== asset.path
    )
      throw new SocialError("Esta mídia não está mais disponível.", 409);
    if (record.storageProvider === "VPS") {
      const info = await vpsOperation(record, "info");
      if (info.bytes !== record.bytes || info.mime !== record.mime)
        throw new SocialError(
          "O arquivo enviado não corresponde à mídia.",
          409,
        );
      continue;
    }
    const bucket = createSupabaseAdminClient().storage.from(SOCIAL_BUCKET);
    const { data, error } = await bucket.info(asset.path);
    if (
      error ||
      !data ||
      Number(data.size) !== asset.bytes ||
      data.contentType !== asset.mime
    )
      throw new SocialError(
        "O envio de uma mídia ainda não terminou ou o arquivo não corresponde ao formato informado.",
      );
  }
}
export async function signedMedia(asset: SocialMedia) {
  const record = await prisma.socialAsset.findUnique({
    where: { id: asset.id },
  });
  if (!record || record.state !== "AVAILABLE" || record.path !== asset.path)
    throw new SocialError(
      "A mídia foi removida ou ainda não está disponível.",
      410,
    );
  if (record.storageProvider === "VPS") return vpsRead(record);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(SOCIAL_BUCKET)
    .createSignedUrl(asset.path, 3600);
  if (error || !data)
    throw new SocialError("Não foi possível carregar a mídia.", 503);
  return data.signedUrl;
}
export async function removeMedia(
  asset: SocialMedia & { storageProvider: string },
) {
  if (asset.storageProvider === "VPS") await vpsOperation(asset, "delete");
  else {
    const { error } = await createSupabaseAdminClient()
      .storage.from(SOCIAL_BUCKET)
      .remove([asset.path]);
    if (error) throw new SocialError("Não foi possível remover a mídia.", 503);
  }
}
