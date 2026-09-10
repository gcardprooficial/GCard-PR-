// ponytail: in-memory fixed-window limiter, best-effort only.
// Serverless instances don't share this map, so real limits are per-instance.
// Swap for Upstash/Redis before relying on it for abuse protection at scale.
const hits = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the call is allowed. `key` groups callers (ip, token, term). */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }
    return true;
  }

  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

/** Best-effort client key from proxy headers (Cloudflare / Vercel / generic). */
export function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
