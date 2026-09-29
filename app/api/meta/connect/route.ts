import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { isAdmin } from "@/lib/permissions";
import { metaAppConfigured, metaGraphVersion, metaRedirectUri } from "@/lib/meta/graph";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.redirect(new URL("/login", req.url));
  if (!isAdmin(auth)) return NextResponse.json({ error: "Apenas administradores podem conectar a Meta." }, { status: 403 });
  if (!metaAppConfigured()) return NextResponse.json({ error: "Configure as credenciais do aplicativo Meta na Vercel." }, { status: 503 });

  const state = randomBytes(24).toString("base64url");
  const origin = new URL(req.url).origin;
  const redirectUri = metaRedirectUri(origin);
  const oauth = new URL(`https://www.facebook.com/${metaGraphVersion()}/dialog/oauth`);
  oauth.searchParams.set("client_id", process.env.META_APP_ID!);
  oauth.searchParams.set("redirect_uri", redirectUri);
  oauth.searchParams.set("state", state);
  oauth.searchParams.set("scope", "ads_read,business_management");
  oauth.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(oauth);
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
