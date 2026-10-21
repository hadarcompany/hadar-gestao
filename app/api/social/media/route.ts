import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_BUCKET } from "@/lib/social/storage";
import {
  usesVpsMedia,
  mediaVideoLimitMB,
  vpsOperation,
  vpsUpload,
} from "@/lib/social/vps-media";
export const maxDuration = 60;
import {
  socialAuth,
  requireClient,
  failure,
  SocialError,
  nonceHash,
} from "@/lib/social/core";
export async function POST(req: Request) {
  const access = await socialAuth(req, "/api/social/media");
  if (access.response) return access.response;
  try {
    const body = await req.json(),
      clientId = await requireClient(body.clientId);
    const mime = body.mime,
      bytes = body.bytes;
    if (
      !["image/jpeg", "video/mp4"].includes(mime) ||
      !Number.isSafeInteger(bytes) ||
      bytes < 1 ||
      bytes > (mime === "image/jpeg" ? 8 : mediaVideoLimitMB()) * 1024 * 1024
    )
      throw new SocialError(
        `Use JPEG de até 8 MB ou MP4 de até ${mediaVideoLimitMB()} MB.`,
      );
    const vps = usesVpsMedia();
    const storage = vps ? null : createSupabaseAdminClient().storage;
    if (storage) {
      const { data: bucket, error: bucketError } =
        await storage.getBucket(SOCIAL_BUCKET);
      if (bucketError || !bucket || bucket.public)
        throw new SocialError(
          "O armazenamento privado de publicações precisa ser preparado pela Hadar.",
          503,
        );
      if (
        !bucket.file_size_limit ||
        bucket.file_size_limit > 50 * 1024 * 1024 ||
        !bucket.allowed_mime_types?.length ||
        bucket.allowed_mime_types.some(
          (type) => !["image/jpeg", "video/mp4"].includes(type),
        )
      )
        throw new SocialError(
          "Os limites do armazenamento precisam ser configurados pela Hadar.",
          503,
        );
    }
    const asset = await prisma.$transaction(async (tx) => {
      // Serialize reservations across all clients before issuing a direct-upload token.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(197632084)`;
      const used = await tx.socialAsset.aggregate({
        _sum: { reservedBytes: true },
      });
      const limit =
        Number(process.env.SOCIAL_STORAGE_LIMIT_MB || 512) * 1024 * 1024;
      // Supabase upload tokens allow the bucket's maximum, while the VPS ticket
      // enforces the declared size for every chunk and for final assembly.
      const reservedBytes = vps
        ? bytes
        : (mime === "image/jpeg" ? 8 : 50) * 1024 * 1024;
      if (
        !Number.isFinite(limit) ||
        (used._sum.reservedBytes || 0) + reservedBytes > limit
      )
        throw new SocialError(
          "O limite de armazenamento de publicações foi atingido.",
          409,
        );
      return tx.socialAsset.create({
        data: {
          clientId,
          userId: access.auth!.id,
          path: `${nonceHash(clientId).slice(0, 16)}/${randomUUID()}.${mime === "image/jpeg" ? "jpg" : "mp4"}`,
          mime,
          bytes,
          reservedBytes,
          storageProvider: vps ? "VPS" : "SUPABASE",
          name: String(body.name || "Midia").slice(0, 180),
        },
      });
    });
    if (vps) {
      // On an uncertain network failure retain the reservation. Cleanup removes
      // a possibly created remote upload before releasing its database quota.
      await vpsOperation(asset, "init");
      return NextResponse.json({
        asset: { id: asset.id, name: asset.name, mime, bytes },
        provider: "VPS",
        upload: vpsUpload(asset),
      });
    }
    const { data, error } = await storage!
      .from(SOCIAL_BUCKET)
      .createSignedUploadUrl(asset.path, { upsert: false });
    if (error || !data) {
      await prisma.socialAsset.delete({ where: { id: asset.id } });
      throw new SocialError("Não foi possível preparar o envio.", 503);
    }
    return NextResponse.json({
      asset: { id: asset.id, name: asset.name, mime, bytes },
      path: asset.path,
      token: data.token,
      provider: "SUPABASE",
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(req: Request) {
  const access = await socialAuth(req, "/api/social/media");
  if (access.response) return access.response;
  try {
    const body = await req.json(),
      clientId = await requireClient(body.clientId);
    const asset = await prisma.socialAsset.findFirst({
      where: { id: String(body.id), clientId, userId: access.auth!.id },
    });
    if (!asset) throw new SocialError("Mídia não encontrada.", 404);
    if (["DELETING", "DELETED"].includes(asset.state))
      throw new SocialError(
        "Este envio expirou. Envie o arquivo novamente.",
        409,
      );
    if (asset.storageProvider === "VPS") await vpsOperation(asset, "complete");
    const { verifyAssets } = await import("@/lib/social/storage");
    await verifyAssets([asset]);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(197632084)`;
      const changed = await tx.socialAsset.updateMany({
        where: { id: asset.id, state: { in: ["UPLOADING", "AVAILABLE"] } },
        data: {
          verifiedAt: new Date(),
          reservedBytes: asset.bytes,
          state: "AVAILABLE",
        },
      });
      if (!changed.count)
        throw new SocialError(
          "Este envio expirou. Envie o arquivo novamente.",
          409,
        );
    });
    const { signedMedia } = await import("@/lib/social/storage");
    return NextResponse.json({
      verified: true,
      previewUrl: await signedMedia(asset),
    });
  } catch (error) {
    return failure(error);
  }
}
