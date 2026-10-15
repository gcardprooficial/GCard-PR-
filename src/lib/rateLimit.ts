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

/**
 * Limite compartilhado entre instâncias (tabela rate_limits + RPC rate_limit_hit). Use nos endpoints sensíveis
 * (criar pedido, denúncia, lead). Se o banco falhar (ou a migração ainda não rodou), cai no limite em memória:
 * nunca bloqueia o cliente por erro nosso.
 */
export async function rateLimitShared(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    }).rpc("rate_limit_hit", { _key: key, _max: max, _window_seconds: Math.max(1, Math.round(windowMs / 1000)) });
    if (error || typeof data !== "boolean") return rateLimit(key, max, windowMs);
    return data;
  } catch {
    return rateLimit(key, max, windowMs);
  }
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
