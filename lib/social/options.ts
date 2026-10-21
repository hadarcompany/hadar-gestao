import { SocialError, type Provider } from "./core";
export type SocialOptions = {
  coverAssetId?: string;
  thumbOffset?: number;
  shareToFeed?: boolean;
  collaborators?: string[];
  userTags?: string[];
  locationId?: string;
  altText?: string;
  audioName?: string;
  firstComment?: string;
  disableComments?: boolean;
  isAiGenerated?: boolean;
};
const usernames = (value: unknown, max: number) => {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some(
      (v) => typeof v !== "string" || !/^@?[a-zA-Z0-9._]{1,30}$/.test(v),
    )
  )
    throw new SocialError(
      `Informe até ${max} nomes de usuário válidos, sem links.`,
    );
  return [
    ...new Set(value.map((v) => String(v).replace(/^@/, "").toLowerCase())),
  ];
};
export function validateOptions(
  value: unknown,
  provider: Provider,
  format: string,
): SocialOptions {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new SocialError("Configurações avançadas inválidas.");
  const input = value as Record<string, unknown>,
    result: SocialOptions = {};
  const allowed = [
    "coverAssetId",
    "thumbOffset",
    "shareToFeed",
    "collaborators",
    "userTags",
    "locationId",
    "altText",
    "audioName",
    "firstComment",
    "disableComments",
    "isAiGenerated",
  ];
  if (Object.keys(input).some((k) => !allowed.includes(k)))
    throw new SocialError("Esta configuração avançada não é suportada.");
  if (provider !== "INSTAGRAM" || format === "STORY") {
    if (
      Object.values(input).some(
        (v) =>
          v !== "" &&
          v !== false &&
          v !== undefined &&
          v !== null &&
          (!Array.isArray(v) || v.length),
      )
    )
      throw new SocialError(
        "As opções avançadas selecionadas são para posts ou Reels do Instagram.",
      );
    return {};
  }
  for (const key of [
    "shareToFeed",
    "disableComments",
    "isAiGenerated",
  ] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "boolean")
        throw new SocialError("Opção inválida.");
      result[key] = input[key];
    }
  }
  for (const [key, max] of [
    ["altText", 1000],
    ["audioName", 80],
    ["firstComment", 2200],
  ] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "string" || input[key].length > max)
        throw new SocialError(`O campo ${key} excedeu o limite.`);
      if (input[key].trim()) result[key] = input[key].trim();
    }
  }
  const collab = usernames(input.collaborators, 3),
    tags = usernames(input.userTags, 20);
  if (collab?.length) result.collaborators = collab;
  if (tags?.length) result.userTags = tags;
  if (input.locationId) {
    if (
      typeof input.locationId !== "string" ||
      !/^\d{1,40}$/.test(input.locationId)
    )
      throw new SocialError("Informe um ID de local válido da Meta.");
    result.locationId = input.locationId;
  }
  if (input.coverAssetId) {
    if (
      format !== "REEL" ||
      typeof input.coverAssetId !== "string" ||
      input.coverAssetId.length > 100
    )
      throw new SocialError("A capa é uma imagem JPEG separada para Reels.");
    result.coverAssetId = input.coverAssetId;
  }
  if (input.thumbOffset !== undefined) {
    if (
      format !== "REEL" ||
      typeof input.thumbOffset !== "number" ||
      !Number.isSafeInteger(input.thumbOffset) ||
      input.thumbOffset < 0 ||
      input.thumbOffset > 900000
    )
      throw new SocialError("O instante da capa é inválido.");
    result.thumbOffset = input.thumbOffset;
  }
  if (
    format !== "REEL" &&
    (result.audioName || result.shareToFeed !== undefined)
  )
    throw new SocialError(
      "Áudio e compartilhamento no feed são opções de Reels.",
    );
  if (!["POST", "CAROUSEL"].includes(format) && result.altText)
    throw new SocialError("O texto alternativo é para um post de imagem.");
  return result;
}
