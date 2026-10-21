import type { SocialPost, SocialAccount, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { meta, ProviderError, refreshInstagram } from "./meta";
import { unseal, seal, SocialError, type Provider } from "./core";
import { signedMedia } from "./storage";
import type { SocialMedia } from "./validation";
import { validateOptions } from "./options";

type Progress = {
  children?: string[];
  container?: string;
  videoId?: string;
  uploaded?: boolean;
  finalized?: boolean;
  startedAt?: number;
};
type Job = SocialPost & { account: SocialAccount };
type Save = (progress: Progress) => Promise<void>;
export class StillProcessing extends Error {}
export class PublicationUncertain extends Error {}
const id = (value: unknown) => {
  if (typeof value !== "string" || !/^[\d_]+$/.test(value))
    throw new SocialError("A Meta retornou um identificador inválido.", 502);
  return value;
};

// Once a publish request leaves the server, a lost response must never cause an
// automatic duplicate. Persist this boundary BEFORE sending that request.
export async function commitPublication<T>(
  job: Pick<SocialPost, "id" | "lockToken">,
  send: () => Promise<T>,
): Promise<T> {
  const marked = await prisma.socialPost.updateMany({
    where: { id: job.id, lockToken: job.lockToken, status: "PROCESSING" },
    data: { publishStartedAt: new Date() },
  });
  if (!marked.count) throw new PublicationUncertain();
  try {
    return await send();
  } catch (error) {
    if (error instanceof ProviderError && error.definitive) {
      await prisma.socialPost.updateMany({
        where: { id: job.id, lockToken: job.lockToken },
        data: { publishStartedAt: null },
      });
      throw error;
    }
    throw new PublicationUncertain();
  }
}

async function uploadFacebook(url: string, token: string, fileUrl: string) {
  const target = new URL(url);
  if (
    target.protocol !== "https:" ||
    target.hostname !== "rupload.facebook.com" ||
    target.username ||
    target.password
  )
    throw new SocialError("Destino de upload inválido.");
  const response = await fetch(target, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(90000),
    headers: { Authorization: `OAuth ${token}`, file_url: fileUrl },
  });
  const body = await response.json();
  if (!response.ok || !body.success)
    throw new ProviderError(
      Number(body.error?.code || response.status),
      response.status >= 400 && response.status < 500,
    );
}

async function instagram(
  job: Job,
  token: string,
  media: SocialMedia[],
  progress: Progress,
  save: Save,
) {
  const account = id(job.account.externalId);
  const options = validateOptions(job.options, "INSTAGRAM", job.format);
  const advanced: Record<string, string> = {};
  if (options.collaborators?.length)
    advanced.collaborators = JSON.stringify(options.collaborators);
  if (options.userTags?.length)
    advanced.user_tags = JSON.stringify(
      options.userTags.map((username) =>
        job.format === "REEL" ? { username } : { username, x: 0.5, y: 0.5 },
      ),
    );
  if (options.locationId) advanced.location_id = options.locationId;
  if (options.isAiGenerated) advanced.is_ai_generated = "true";
  if (!progress.container) {
    if (job.format === "CAROUSEL") {
      progress.children ||= [];
      while (progress.children.length < media.length) {
        const item = media[progress.children.length];
        const child = await meta<{ id: string }>(
          "INSTAGRAM",
          `${account}/media`,
          token,
          {
            image_url: await signedMedia(item),
            is_carousel_item: "true",
            ...(progress.children.length === 0 && advanced.user_tags
              ? { user_tags: advanced.user_tags }
              : {}),
            ...(progress.children.length === 0 && options.altText
              ? { alt_text: options.altText }
              : {}),
          },
          "POST",
        );
        progress.children.push(id(child.id));
        await save(progress);
      }
      const parent = await meta<{ id: string }>(
        "INSTAGRAM",
        `${account}/media`,
        token,
        {
          media_type: "CAROUSEL",
          children: progress.children.join(","),
          caption: job.caption,
          ...Object.fromEntries(
            Object.entries(advanced).filter(([key]) => key !== "user_tags"),
          ),
        },
        "POST",
      );
      progress.container = id(parent.id);
    } else {
      const fields: Record<string, string> =
        media[0].mime === "image/jpeg"
          ? { image_url: await signedMedia(media[0]) }
          : { video_url: await signedMedia(media[0]) };
      if (job.format === "STORY") fields.media_type = "STORIES";
      else if (job.format === "REEL") {
        fields.media_type = "REELS";
        fields.share_to_feed = String(options.shareToFeed !== false);
        if (options.audioName) fields.audio_name = options.audioName;
        if (options.coverAssetId) {
          const cover = await prisma.socialAsset.findFirst({
            where: {
              id: options.coverAssetId,
              clientId: job.clientId,
              mime: "image/jpeg",
              state: "AVAILABLE",
            },
          });
          if (!cover) throw new SocialError("A capa não está disponível.", 409);
          fields.cover_url = await signedMedia(cover);
        } else if (options.thumbOffset !== undefined)
          fields.thumb_offset = String(options.thumbOffset);
      }
      if (job.format !== "STORY") {
        fields.caption = job.caption;
        Object.assign(fields, advanced);
      }
      if (job.format === "POST" && options.altText)
        fields.alt_text = options.altText;
      const result = await meta<{ id: string }>(
        "INSTAGRAM",
        `${account}/media`,
        token,
        fields,
        "POST",
      );
      progress.container = id(result.id);
    }
    progress.startedAt = Date.now();
    await save(progress);
  }
  const status = await meta<{ status_code: string }>(
    "INSTAGRAM",
    id(progress.container),
    token,
    { fields: "status_code" },
  );
  if (status.status_code === "IN_PROGRESS") throw new StillProcessing();
  if (status.status_code !== "FINISHED")
    throw new SocialError(
      "A Meta não preparou a mídia. Confira o arquivo e crie um novo rascunho.",
      422,
    );
  const published = await commitPublication(job, () =>
    meta<{ id: string }>(
      "INSTAGRAM",
      `${account}/media_publish`,
      token,
      { creation_id: id(progress.container) },
      "POST",
    ),
  );
  return id(published.id);
}

async function facebook(
  job: Job,
  token: string,
  media: SocialMedia[],
  progress: Progress,
  save: Save,
) {
  const account = id(job.account.externalId);
  if (job.format === "STORY" && media[0].mime === "image/jpeg") {
    if (!progress.children?.length) {
      const photo = await meta<{ id: string }>(
        "FACEBOOK",
        `${account}/photos`,
        token,
        { url: await signedMedia(media[0]), published: "false" },
        "POST",
      );
      progress.children = [id(photo.id)];
      await save(progress);
    }
    const story = await commitPublication(job, () =>
      meta<{ post_id?: string; id?: string; success?: boolean }>(
        "FACEBOOK",
        `${account}/photo_stories`,
        token,
        { photo_id: progress.children![0] },
        "POST",
      ),
    );
    if (!story.success && !story.post_id && !story.id)
      throw new PublicationUncertain();
    return id(story.post_id || story.id || progress.children[0]);
  }
  if (job.format === "REEL" || job.format === "STORY") {
    const edge = job.format === "STORY" ? "video_stories" : "video_reels";
    if (!progress.videoId) {
      const session = await meta<{ video_id: string; upload_url: string }>(
        "FACEBOOK",
        `${account}/${edge}`,
        token,
        { upload_phase: job.format === "STORY" ? "START" : "start" },
        "POST",
      );
      progress.videoId = id(session.video_id);
      await uploadFacebook(
        session.upload_url,
        token,
        await signedMedia(media[0]),
      );
      progress.uploaded = true;
      progress.startedAt = Date.now();
      await save(progress);
    }
    if (!progress.finalized) {
      await commitPublication(job, () =>
        meta(
          "FACEBOOK",
          `${account}/${edge}`,
          token,
          {
            upload_phase: job.format === "STORY" ? "FINISH" : "finish",
            video_id: id(progress.videoId),
            video_state: "PUBLISHED",
            ...(job.format === "REEL" ? { description: job.caption } : {}),
          },
          "POST",
        ),
      );
      progress.finalized = true;
      await save(progress);
    }
    const video = await meta<{
      status?: { publishing_phase?: { status: string }; video_status?: string };
    }>("FACEBOOK", id(progress.videoId), token, { fields: "status" });
    if (video.status?.publishing_phase?.status === "complete")
      return progress.videoId;
    if (
      video.status?.publishing_phase?.status === "error" ||
      video.status?.video_status === "error"
    )
      throw new PublicationUncertain();
    throw new StillProcessing();
  }
  progress.children ||= [];
  while (progress.children.length < media.length) {
    const photo = await meta<{ id: string }>(
      "FACEBOOK",
      `${account}/photos`,
      token,
      {
        url: await signedMedia(media[progress.children.length]),
        published: "false",
      },
      "POST",
    );
    progress.children.push(id(photo.id));
    await save(progress);
  }
  const fields: Record<string, string> = { message: job.caption };
  if (progress.children.length)
    fields.attached_media = JSON.stringify(
      progress.children.map((media_fbid) => ({ media_fbid })),
    );
  const result = await commitPublication(job, () =>
    meta<{ id: string }>("FACEBOOK", `${account}/feed`, token, fields, "POST"),
  );
  return id(result.id);
}

export async function publishJob(job: Job) {
  const progress = (job.progress || {}) as Progress;
  const save: Save = async (data) => {
    const result = await prisma.socialPost.updateMany({
      where: { id: job.id, status: "PROCESSING", lockToken: job.lockToken },
      data: { progress: data as Prisma.InputJsonValue },
    });
    if (!result.count) throw new PublicationUncertain();
  };
  if (job.account.status !== "CONNECTED" || !job.account.tokenEncrypted)
    throw new SocialError("Reconecte a conta antes de publicar.", 409);
  let token = unseal(job.account.tokenEncrypted);
  if (job.account.tokenExpiresAt && job.account.tokenExpiresAt <= new Date())
    throw new ProviderError(190, true);
  if (
    job.account.provider === "INSTAGRAM" &&
    job.account.tokenExpiresAt &&
    job.account.tokenExpiresAt.getTime() - Date.now() < 10 * 86400000 &&
    Date.now() - job.account.tokenRefreshedAt.getTime() > 86400000
  ) {
    const fresh = await refreshInstagram(token);
    if (!fresh.access_token || !fresh.expires_in)
      throw new SocialError("Reconecte o Instagram.", 409);
    token = fresh.access_token;
    await prisma.socialAccount.update({
      where: { id: job.accountId },
      data: {
        tokenEncrypted: seal(token),
        tokenExpiresAt: new Date(Date.now() + fresh.expires_in * 1000),
        tokenRefreshedAt: new Date(),
      },
    });
  }
  if (progress.startedAt && Date.now() - progress.startedAt > 2 * 3600000) {
    if (job.publishStartedAt) throw new PublicationUncertain();
    throw new SocialError(
      "A Meta não concluiu o processamento em duas horas. Revise a mídia antes de tentar novamente.",
      422,
    );
  }
  return job.account.provider === "INSTAGRAM"
    ? instagram(job, token, job.media as SocialMedia[], progress, save)
    : facebook(job, token, job.media as SocialMedia[], progress, save);
}

// Auxiliary operations cannot change a confirmed publication into a failed one.
// Claim once before sending: a lost comment response must not create duplicates.
export async function afterPublish(job: Job, externalId: string) {
  if (job.account.provider !== "INSTAGRAM" || job.format === "STORY") return;
  const options = validateOptions(job.options, "INSTAGRAM", job.format);
  if (!options.firstComment && !options.disableComments) return;
  const claim = await prisma.socialPost.updateMany({
    where: { id: job.id, status: "PUBLISHED", afterPublishState: "NONE" },
    data: { afterPublishState: "RUNNING" },
  });
  if (!claim.count) return;
  try {
    const current = await prisma.socialAccount.findUniqueOrThrow({
      where: { id: job.accountId },
    });
    if (current.status !== "CONNECTED") throw new Error("Disconnected");
    const token = unseal(current.tokenEncrypted);
    if (options.firstComment)
      await meta(
        "INSTAGRAM",
        `${id(externalId)}/comments`,
        token,
        { message: options.firstComment },
        "POST",
      );
    if (options.disableComments)
      await meta(
        "INSTAGRAM",
        id(externalId),
        token,
        { comment_enabled: "false" },
        "POST",
      );
    await prisma.socialPost.updateMany({
      where: { id: job.id, afterPublishState: "RUNNING" },
      data: { afterPublishState: "DONE" },
    });
  } catch {
    await prisma.socialPost.updateMany({
      where: { id: job.id, afterPublishState: "RUNNING" },
      data: {
        afterPublishState: "WARNING",
        afterPublishError:
          "O conteúdo foi publicado. Confira o primeiro comentário e os comentários na rede social; a autorização adicional pode estar pendente. Não repetiremos automaticamente para evitar duplicação.",
      },
    });
  }
}
