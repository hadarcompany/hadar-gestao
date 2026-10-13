import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type KeySource = "integration" | "supabase";
function keyFor(source: KeySource, context: string) {
  const secret = (source === "integration" ? process.env.INTEGRATIONS_ENCRYPTION_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!secret || secret.length < 32) throw new Error("INTEGRATION_ENCRYPTION_UNAVAILABLE");
  return createHash("sha256").update(context).update("\0").update(secret).digest();
}

export function encryptIntegrationSecret(value: string, context: string) {
  const source: KeySource = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim() ? "integration" : "supabase";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(source, context), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", source, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptIntegrationSecret(value: string, context: string) {
  const [version, source, iv, tag, data, extra] = value.split(".");
  if (version !== "v1" || !["integration", "supabase"].includes(source) || !iv || !tag || !data || extra !== undefined) throw new Error("INVALID_ENCRYPTED_INTEGRATION");
  const decipher = createDecipheriv("aes-256-gcm", keyFor(source as KeySource, context), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
