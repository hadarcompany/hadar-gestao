/** Reverse proxies may give Next.js an internal hostname; trust only explicit configuration. */
export function publicOrigin(requestUrl: string, configuredUrl = process.env.APP_URL) {
  const url = new URL(configuredUrl || requestUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("APP_URL inválida.");
  return url.origin;
}
