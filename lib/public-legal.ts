const LEGAL_PAGES = new Set(["/privacidade", "/exclusao-de-dados"]);

export function isPublicLegalPage(pathname: string, method: string) {
  return (method === "GET" || method === "HEAD") && LEGAL_PAGES.has(pathname);
}
