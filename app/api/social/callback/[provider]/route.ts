import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/public-url";
import {
  socialAuth,
  provider,
  nonceHash,
  seal,
  SocialError,
} from "@/lib/social/core";
import { exchangeCode, discoverPages, meta } from "@/lib/social/meta";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const access = await socialAuth(req, "/api/social/callback");
  if (access.response) return access.response;
  const back = new URL("/publicacoes", publicOrigin(req.url));
  let p: "INSTAGRAM" | "FACEBOOK" | undefined;
  try {
    p = provider((await context.params).provider.toUpperCase());
    const state = req.nextUrl.searchParams.get("state"),
      cookie = req.cookies.get(`social_state_${p}`)?.value;
    if (!state || !cookie || nonceHash(state) !== nonceHash(cookie))
      throw new SocialError("invalid_state");
    const id = nonceHash(state),
      session = await prisma.socialOAuthSession.findUnique({ where: { id } });
    if (
      !session ||
      session.userId !== access.auth!.id ||
      session.provider !== p ||
      session.expiresAt <= new Date() ||
      session.consumedAt
    )
      throw new SocialError("invalid_state");
    back.searchParams.set("clientId", session.clientId);
    const claimed = await prisma.socialOAuthSession.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (!claimed.count) throw new SocialError("invalid_state");
    if (req.nextUrl.searchParams.has("error")) {
      back.searchParams.set("social", "cancelled");
    } else {
      const code = req.nextUrl.searchParams.get("code");
      if (!code) throw new SocialError("missing_code");
      const { token, expiresAt } = await exchangeCode(p, code, req.url);
      if (p === "INSTAGRAM") {
        const account = await meta<{
          id: string;
          user_id?: string;
          username: string;
          account_type?: string;
        }>(p, "me", token, { fields: "user_id,username,account_type" });
        const externalId = String(account.user_id || account.id);
        if (!/^\d+$/.test(externalId) || !account.username)
          throw new SocialError("invalid_profile");
        await prisma.$transaction(async (tx) => {
          const existing = await tx.socialAccount.findUnique({
            where: { provider_externalId: { provider: p!, externalId } },
          });
          if (existing && existing.clientId !== session.clientId)
            throw new SocialError("account_in_use");
          const data = {
            clientId: session.clientId,
            name: account.username,
            accountType: account.account_type,
            tokenEncrypted: seal(token),
            tokenExpiresAt: expiresAt,
            tokenRefreshedAt: new Date(),
            status: "CONNECTED",
            connectedById: access.auth!.id,
          };
          const { clientId: _owner, ...update } = data;
          const saved = await tx.socialAccount.upsert({
            where: { provider_externalId: { provider: p!, externalId } },
            create: { ...data, provider: p!, externalId },
            update,
          });
          if (saved.clientId !== session.clientId)
            throw new SocialError("account_in_use");
          await tx.socialReportSnapshot.deleteMany({
            where: { accountId: saved.id },
          });
        });
        await prisma.socialOAuthSession.delete({ where: { id } });
        back.searchParams.set("social", "connected");
      } else {
        const pages = await discoverPages(token);
        if (!pages.length) throw new SocialError("no_pages");
        await prisma.socialOAuthSession.update({
          where: { id },
          data: {
            resultEncrypted: seal(
              JSON.stringify({ pages, expiresAt: expiresAt.toISOString() }),
            ),
          },
        });
        back.searchParams.set("social", "select_pages");
        back.searchParams.set("session", id);
      }
    }
  } catch (error) {
    const known = ["invalid_state", "no_pages", "account_in_use"];
    back.searchParams.set(
      "social",
      error instanceof SocialError && known.includes(error.message)
        ? error.message
        : "connection_failed",
    );
    console.error(
      "Social OAuth failed",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
  const response = NextResponse.redirect(back);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (p)
    response.cookies.set(`social_state_${p}`, "", {
      path: "/api/social",
      maxAge: 0,
    });
  return response;
}
