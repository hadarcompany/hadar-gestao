import { prisma } from "@/lib/prisma";
import { decryptMetaToken } from "@/lib/meta/crypto";

export const metaGraphVersion = () => process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
const graphBase = () => `https://graph.facebook.com/${metaGraphVersion()}`;

export function metaAppConfigured() {
  return Boolean(
    process.env.META_APP_ID?.trim() &&
    process.env.META_APP_SECRET?.trim() &&
    process.env.META_TOKEN_ENCRYPTION_KEY?.trim()
  );
}

export function metaRedirectUri(origin?: string) {
  return process.env.META_OAUTH_REDIRECT_URI?.trim() || `${origin}/api/meta/callback`;
}

export class MetaGraphError extends Error {
  constructor(message: string, public status: number, public code?: number) {
    super(message);
  }
}

interface GraphErrorResponse {
  error?: { message?: string; code?: number; error_subcode?: number };
}

export async function metaGraphRequest<T>(pathOrUrl: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${graphBase()}/${pathOrUrl.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({})) as T & GraphErrorResponse;
  if (!response.ok || body.error) {
    throw new MetaGraphError(body.error?.message || `Meta Graph API ${response.status}`, response.status, body.error?.code);
  }
  return body as T;
}

export async function metaGraphAll<T>(path: string, token: string, params: Record<string, string>) {
  const data: T[] = [];
  let next: string | null = path;
  let first = true;
  while (next && data.length < 5_000) {
    const page: { data?: T[]; paging?: { next?: string } } = await metaGraphRequest(next, token, first ? params : {});
    data.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
    first = false;
  }
  return data;
}

export async function getMetaAccessToken() {
  const connection = await prisma.metaConnection.findUnique({ where: { id: "primary" } });
  if (!connection) throw new Error("META_NOT_CONNECTED");
  if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) throw new Error("META_TOKEN_EXPIRED");
  return { token: decryptMetaToken(connection.accessTokenEncrypted), connection };
}

interface MetaAdAccountPayload {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
  business?: { id?: string; name?: string };
}

export async function syncMetaAdAccounts(token?: string) {
  const accessToken = token ?? (await getMetaAccessToken()).token;
  const accounts = await metaGraphAll<MetaAdAccountPayload>("me/adaccounts", accessToken, {
    fields: "id,account_id,name,currency,account_status,business{id,name}",
    limit: "200",
  });
  const now = new Date();
  await prisma.$transaction(accounts.map((account) => prisma.metaAdAccount.upsert({
    where: { externalId: account.id },
    create: {
      externalId: account.id,
      accountId: account.account_id ?? null,
      name: account.name || account.id,
      currency: account.currency ?? null,
      accountStatus: account.account_status ?? null,
      businessId: account.business?.id ?? null,
      businessName: account.business?.name ?? null,
      lastSyncedAt: now,
    },
    update: {
      accountId: account.account_id ?? null,
      name: account.name || account.id,
      currency: account.currency ?? null,
      accountStatus: account.account_status ?? null,
      businessId: account.business?.id ?? null,
      businessName: account.business?.name ?? null,
      lastSyncedAt: now,
    },
  })));
  return accounts.length;
}
