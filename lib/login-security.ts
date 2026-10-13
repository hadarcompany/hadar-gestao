export function parseLogin(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password || email.length > 254 || password.length > 1024) return null;
  return { email: email.trim().toLowerCase(), password };
}

/** Extra protection for this single-server deployment; Supabase also limits Auth. */
export function createLoginLimiter(maxAttempts = 10, windowMs = 15 * 60 * 1000, maxAccounts = 5000) {
  const attempts = new Map<string, { count: number; expiresAt: number }>();
  return (email: string, now = Date.now()) => {
    for (const [key, value] of attempts) if (value.expiresAt <= now) attempts.delete(key);
    const entry = attempts.get(email);
    if (entry) { entry.count++; return entry.count <= maxAttempts; }
    if (attempts.size >= maxAccounts) return false;
    attempts.set(email, { count: 1, expiresAt: now + windowMs });
    return true;
  };
}

const globalState = globalThis as unknown as { loginLimiter?: ReturnType<typeof createLoginLimiter> };
export const allowLoginAttempt = globalState.loginLimiter ??= createLoginLimiter();
