import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { isAdmin } from "@/lib/permissions";
import { encryptMetaToken } from "@/lib/meta/crypto";
import { metaGraphRequest, metaGraphVersion, metaRedirectUri, syncMetaAdAccounts } from "@/lib/meta/graph";
import { prisma } from "@/lib/prisma";

interface TokenResponse { access_token: string; token_type?: string; expires_in?: number }

function settingsUrl(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/configuracoes", req.url);
  url.searchParams.set("tab", "integracoes");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth || !isAdmin(auth)) return NextResponse.redirect(settingsUrl(req, { meta_error: "unauthorized" }));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("meta_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(settingsUrl(req, { meta_error: "invalid_state" }));
  }

  try {
    const origin = new URL(req.url).origin;
    const exchange = new URL(`https://graph.facebook.com/${metaGraphVersion()}/oauth/access_token`);
    exchange.searchParams.set("client_id", process.env.META_APP_ID!);
    exchange.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    exchange.searchParams.set("redirect_uri", metaRedirectUri(origin));
    exchange.searchParams.set("code", code);
    const shortResponse = await fetch(exchange, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const short = await shortResponse.json() as TokenResponse & { error?: { message?: string } };
    if (!shortResponse.ok || !short.access_token) throw new Error(short.error?.message || "META_CODE_EXCHANGE_FAILED");

    const longUrl = new URL(`https://graph.facebook.com/${metaGraphVersion()}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", process.env.META_APP_ID!);
    longUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    longUrl.searchParams.set("fb_exchange_token", short.access_token);
    const longResponse = await fetch(longUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const long = await longResponse.json().catch(() => null) as TokenResponse | null;
    const token = longResponse.ok && long?.access_token ? long.access_token : short.access_token;
    const expiresIn = longResponse.ok && long?.expires_in ? long.expires_in : short.expires_in;
    const profile = await metaGraphRequest<{ id: string; name?: string }>("me", token, { fields: "id,name" });

    await prisma.metaConnection.upsert({
      where: { id: "primary" },
      create: {
        id: "primary",
        metaUserId: profile.id,
        metaUserName: profile.name ?? null,
        accessTokenEncrypted: encryptMetaToken(token),
        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      },
      update: {
        metaUserId: profile.id,
        metaUserName: profile.name ?? null,
        accessTokenEncrypted: encryptMetaToken(token),
        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      },
    });
    await syncMetaAdAccounts(token);
    const response = NextResponse.redirect(settingsUrl(req, { meta_connected: "1" }));
    response.cookies.delete("meta_oauth_state");
    return response;
  } catch (error) {
    console.error("Falha ao conectar Meta:", error);
    return NextResponse.redirect(settingsUrl(req, { meta_error: "connection_failed" }));
  }
}
