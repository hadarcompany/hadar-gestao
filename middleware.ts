import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "./lib/public-url";
import { trialDenial } from "./lib/instance-trial";
import { isPublicLegalPage } from "./lib/public-legal";

export async function middleware(request: NextRequest) {
  // Static notices must remain readable without an account or an active trial.
  if (isPublicLegalPage(request.nextUrl.pathname, request.method)) return NextResponse.next();
  const expired = trialDenial(request);
  if (expired) return expired;
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isApiAuth = pathname.startsWith("/api/auth");
  // Worker authenticates its own bearer secret, never a browser session.
  const isSocialWorker = pathname === "/api/social/worker" || pathname === "/api/social/analytics/worker";
  const isPublicWebhook =
    pathname === "/api/webhooks/asaas" ||
    pathname === "/api/webhooks/whatsapp" ||
    pathname === "/api/webhooks/meta/whatsapp";

  if (!isApiAuth && !isPublicWebhook && !isSocialWorker) {
    if (!user && !isLoginPage) {
      const url = new URL(request.nextUrl.pathname + request.nextUrl.search, publicOrigin(request.url));
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (user && isLoginPage) {
      const url = new URL(request.nextUrl.pathname + request.nextUrl.search, publicOrigin(request.url));
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/api/social/")) supabaseResponse.headers.set("Cache-Control", "private, no-store");
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
