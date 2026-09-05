/**
 * Minimal in-memory token-bucket rate limiter for /api/ai/*.
 * Keyed by IP (x-forwarded-for or x-real-ip or req.ip). Window = 60s.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(req: Request, maxPerMinute = 30): { ok: true } | { ok: false; retryAfterMs: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now >= entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return { ok: true };
  }
  if (entry.count >= maxPerMinute) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  return { ok: true };
}

// Periodic cleanup to avoid unbounded growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }, 5 * 60_1000).unref?.();
}

export function requireAdminAuth(req: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true; // no token configured → open (dev)
  const supplied = req.headers.get("x-admin-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return supplied === token;
}
