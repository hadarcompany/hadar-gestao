import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { publicOrigin } from "@/lib/public-url";
import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";

export type Provider = "INSTAGRAM" | "FACEBOOK";
export class SocialError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function provider(value: unknown): Provider {
  if (value !== "INSTAGRAM" && value !== "FACEBOOK")
    throw new SocialError("Rede inválida.");
  return value;
}
export function socialKey() {
  const value = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!value || value.length < 32)
    throw new SocialError(
      "Configure a chave privada de publicações na hospedagem.",
      503,
    );
  return createHash("sha256").update(value).digest();
}
export function seal(value: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", socialKey(), nonce);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), data]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function unseal(value: string) {
  const parts = value.split(".").map((x) => Buffer.from(x, "base64url"));
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16)
    throw new SocialError("Reconecte a conta.", 409);
  const cipher = createDecipheriv("aes-256-gcm", socialKey(), parts[0]);
  cipher.setAuthTag(parts[1]);
  return Buffer.concat([cipher.update(parts[2]), cipher.final()]).toString(
    "utf8",
  );
}
export const nonceHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const graphVersion = () =>
  process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
export function settings(p: Provider, requestUrl: string) {
  const prefix = p === "INSTAGRAM" ? "SOCIAL_INSTAGRAM" : "SOCIAL_FACEBOOK";
  return {
    id: process.env[`${prefix}_APP_ID`]?.trim(),
    secret: process.env[`${prefix}_APP_SECRET`]?.trim(),
    redirect: `${publicOrigin(requestUrl)}/api/social/callback/${p.toLowerCase()}`,
  };
}
export async function socialAuth(req: Request, route: string) {
  const auth = await getServerAuth();
  if (!auth)
    return {
      response: NextResponse.json(
        { error: "Entre na sua conta." },
        { status: 401 },
      ),
    };
  const denied = await guardApiRequest(auth, req, route);
  return denied ? { response: denied } : { auth };
}
export async function requireClient(id: unknown) {
  if (typeof id !== "string" || !id || id.length > 100)
    throw new SocialError("Selecione um cliente.");
  if (
    !(await prisma.client.findUnique({ where: { id }, select: { id: true } }))
  )
    throw new SocialError("Cliente não encontrado.", 404);
  return id;
}
export function failure(error: unknown) {
  if (error instanceof SocialError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  // Provider responses and Prisma errors may contain tokens or customer data.
  console.error(
    "Social operation failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    {
      error:
        "Não foi possível concluir. Verifique a configuração e tente novamente.",
    },
    { status: 500 },
  );
}
