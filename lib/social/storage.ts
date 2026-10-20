import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SocialError } from "./core";
import type { SocialMedia } from "./validation";
export const SOCIAL_BUCKET = "social-media";
export async function verifyAssets(assets: SocialMedia[]) {
  const bucket = createSupabaseAdminClient().storage.from(SOCIAL_BUCKET);
  for (const asset of assets) {
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
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(SOCIAL_BUCKET)
    .createSignedUrl(asset.path, 3600);
  if (error || !data)
    throw new SocialError("Não foi possível carregar a mídia.", 503);
  return data.signedUrl;
}
