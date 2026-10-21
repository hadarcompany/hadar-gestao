import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  socialAuth,
  failure,
  provider,
  requireClient,
  settings,
  socialKey,
  nonceHash,
  graphVersion,
  SocialError,
} from "@/lib/social/core";

export async function POST(req: Request) {
  const access = await socialAuth(req, "/api/social/connect");
  if (access.response) return access.response;
  try {
    const body = await req.json(),
      p = provider(body.provider),
      clientId = await requireClient(body.clientId);
    socialKey();
    const config = settings(p, req.url);
    if (!config.id || !config.secret)
      throw new SocialError(
        `A conexão com ${p === "INSTAGRAM" ? "Instagram" : "Facebook"} ainda precisa ser configurada pela Hadar.`,
        503,
      );
    const state = randomBytes(32).toString("base64url");
    await prisma.socialOAuthSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await prisma.socialOAuthSession.create({
      data: {
        id: nonceHash(state),
        clientId,
        userId: access.auth!.id,
        provider: p,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const url = new URL(
      p === "INSTAGRAM"
        ? "https://www.instagram.com/oauth/authorize"
        : `https://www.facebook.com/${graphVersion()}/dialog/oauth`,
    );
    url.searchParams.set("client_id", config.id);
    url.searchParams.set("redirect_uri", config.redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    if (p === "INSTAGRAM") {
      url.searchParams.set(
        "scope",
        "instagram_business_basic,instagram_business_content_publish" +
          (body.extended === true
            ? ",instagram_business_manage_insights,instagram_business_manage_comments"
            : ""),
      );
      url.searchParams.set("enable_fb_login", "0");
      url.searchParams.set("force_authentication", "1");
    } else {
      url.searchParams.set("auth_type", "rerequest");
      const configId = process.env.SOCIAL_FACEBOOK_CONFIG_ID?.trim();
      if (configId) url.searchParams.set("config_id", configId);
      else
        url.searchParams.set(
          "scope",
          "pages_show_list,pages_read_engagement,pages_manage_posts",
        );
    }
    const response = NextResponse.json({ url: url.href });
    response.cookies.set(`social_state_${p}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/social",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
