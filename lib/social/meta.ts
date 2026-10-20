import { SocialError, graphVersion, settings, type Provider } from "./core";

export class ProviderError extends SocialError {
  constructor(
    public code: number,
    public definitive: boolean,
  ) {
    super(
      code === 190 || code === 401
        ? "A autorização venceu. Reconecte a conta."
        : `A Meta recusou a operação (código ${code}). Confira o formato da mídia e as permissões.`,
      422,
    );
  }
}
// No arbitrary URLs, redirects or raw provider errors: tokens stay at Meta.
export async function meta<T>(
  p: Provider,
  path: string,
  token: string,
  fields: Record<string, string> = {},
  method = "GET",
): Promise<T> {
  const url = new URL(
    `https://${p === "INSTAGRAM" ? "graph.instagram.com" : "graph.facebook.com"}/${graphVersion()}/${path}`,
  );
  if (method === "GET")
    for (const [key, value] of Object.entries(fields))
      url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    ...(method === "POST" ? { body: new URLSearchParams(fields) } : {}),
  });
  const body = await response.json();
  if (!response.ok || body.error)
    throw new ProviderError(
      Number(body.error?.code || response.status),
      response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429,
    );
  return body as T;
}
async function exchange(
  url: string,
  fields: Record<string, string>,
  method = "POST",
) {
  const target = new URL(url);
  if (method === "GET")
    for (const [key, value] of Object.entries(fields))
      target.searchParams.set(key, value);
  const response = await fetch(target, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
    ...(method === "POST" ? { body: new URLSearchParams(fields) } : {}),
  });
  const value = await response.json();
  if (!response.ok || value.error)
    throw new SocialError(
      "A Meta não concluiu a autorização. Confira as permissões e a URL de retorno.",
      422,
    );
  return value;
}
export async function exchangeCode(
  p: Provider,
  code: string,
  requestUrl: string,
) {
  const config = settings(p, requestUrl);
  if (!config.id || !config.secret)
    throw new SocialError("Aplicativo Meta ainda não configurado.", 503);
  let short, long;
  if (p === "INSTAGRAM") {
    const result = await exchange(
      "https://api.instagram.com/oauth/access_token",
      {
        client_id: config.id,
        client_secret: config.secret,
        grant_type: "authorization_code",
        redirect_uri: config.redirect,
        code,
      },
    );
    short = result.access_token
      ? result
      : result.data?.length === 1
        ? result.data[0]
        : null;
    if (!short?.access_token)
      throw new SocialError("O Instagram não retornou a autorização.", 422);
    long = await exchange(
      "https://graph.instagram.com/access_token",
      {
        grant_type: "ig_exchange_token",
        client_secret: config.secret,
        access_token: short.access_token,
      },
      "GET",
    );
  } else {
    const endpoint = `https://graph.facebook.com/${graphVersion()}/oauth/access_token`;
    short = await exchange(endpoint, {
      client_id: config.id,
      client_secret: config.secret,
      redirect_uri: config.redirect,
      code,
    });
    long = await exchange(endpoint, {
      client_id: config.id,
      client_secret: config.secret,
      grant_type: "fb_exchange_token",
      fb_exchange_token: short.access_token,
    });
  }
  if (typeof long.access_token !== "string" || !long.expires_in)
    throw new SocialError(
      "A Meta não retornou uma autorização de longa duração.",
      422,
    );
  return {
    token: long.access_token as string,
    expiresAt: new Date(Date.now() + Number(long.expires_in) * 1000),
  };
}
export interface PageCandidate {
  id: string;
  name: string;
  token: string;
}
export async function discoverPages(token: string) {
  const pages: PageCandidate[] = [];
  let after = "";
  for (let i = 0; i < 20; i++) {
    const result = await meta<{
      data: {
        id: string;
        name: string;
        access_token?: string;
        tasks?: string[];
      }[];
      paging?: { next?: string; cursors?: { after?: string } };
    }>("FACEBOOK", "me/accounts", token, {
      fields: "id,name,access_token,tasks",
      limit: "100",
      ...(after ? { after } : {}),
    });
    for (const page of result.data || [])
      if (
        /^\d+$/.test(page.id) &&
        page.access_token &&
        page.tasks?.some((task) =>
          ["CREATE_CONTENT", "MANAGE", "PROFILE_PLUS_FULL_CONTROL"].includes(
            task,
          ),
        )
      )
        pages.push({ id: page.id, name: page.name, token: page.access_token });
    if (!result.paging?.next) return pages;
    after = result.paging.cursors?.after || "";
    if (!after) break;
  }
  throw new SocialError(
    "Há muitas páginas nesta conta. Autorize apenas as páginas do cliente.",
    422,
  );
}
export async function refreshInstagram(token: string) {
  return exchange(
    "https://graph.instagram.com/refresh_access_token",
    { grant_type: "ig_refresh_token", access_token: token },
    "GET",
  ) as Promise<{ access_token: string; expires_in: number }>;
}
