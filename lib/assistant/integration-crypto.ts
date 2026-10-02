import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AssistantError } from "./types";

type KeySource = "integration" | "supabase";
const AAD = Buffer.from("hadar/assistant-integration/primary/v1");

function keyFor(source: KeySource) {
  const secret = (source === "integration" ? process.env.INTEGRATIONS_ENCRYPTION_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!secret || secret.length < 32) throw new AssistantError("A proteção das integrações não está disponível no servidor. Configure INTEGRATIONS_ENCRYPTION_KEY.", 503);
  return createHash("sha256").update(AAD).update("\0").update(secret).digest();
}

export function encryptAssistantKey(value: string) {
  const source: KeySource = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim() ? "integration" : "supabase";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(source), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", source, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptAssistantKey(value: string) {
  try {
    const parts = value.split(".");
    const [version, source, iv, tag, data] = parts;
    if (parts.length !== 5 || version !== "v1" || (source !== "integration" && source !== "supabase")) throw new Error("Invalid encrypted credential");
    const decipher = createDecipheriv("aes-256-gcm", keyFor(source), Buffer.from(iv, "base64url"));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new AssistantError("Não foi possível ler a chave do Claude. Cadastre-a novamente em Configurações > Integrações.", 503); }
}
