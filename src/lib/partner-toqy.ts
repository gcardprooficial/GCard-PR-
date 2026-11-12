import { createHmac, timingSafeEqual } from "node:crypto";
import { isPublicHost } from "@/lib/destination";

/** Janela de validade do carimbo de tempo (segundos). */
export const TOQY_WINDOW_SECONDS = 300;

/** Assinatura do Toqy: HMAC-SHA256 hex de "<timestamp>.<corpo exato>" com o segredo combinado. Compara em tempo constante. */
export function validToqySignature(raw: string, timestamp: string | null, signature: string | null, secret: string | undefined, nowSeconds: number): boolean {
  if (!secret || secret.length < 32 || !timestamp || !signature) return false;
  if (!/^\d{9,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOQY_WINDOW_SECONDS) return false;
  const want = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const given = Buffer.from(signature.toLowerCase());
  const expected = Buffer.from(want);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type AllowHostBody = { host: string; action: "add" | "remove"; ownerEmail: string | null };

/** Valida o corpo do pedido. Recusa "*", IP, localhost, porta, caminho e qualquer coisa que não seja um nome de site comum. */
export function parseAllowHostBody(raw: string): AllowHostBody | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const b = body as { host?: unknown; action?: unknown; owner_email?: unknown };
  if (b.action !== "add" && b.action !== "remove") return null;
  if (typeof b.host !== "string") return null;
  const host = b.host.trim();
  if (host !== host.toLowerCase()) return null;
  if (host.includes("*") || host.includes("/") || host.includes("?") || host.includes("#") || host.includes(" ")) return null;
  if (!/^[a-z0-9.-]+$/.test(host) || host.length > 253 || host.startsWith(".") || host.endsWith(".") || host.includes("..")) return null;
  if (!isPublicHost(host)) return null;
  let ownerEmail: string | null = null;
  if (b.owner_email !== undefined && b.owner_email !== null) {
    if (typeof b.owner_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.owner_email) || b.owner_email.length > 254) return null;
    ownerEmail = b.owner_email.toLowerCase();
  }
  return { host, action: b.action, ownerEmail };
}
