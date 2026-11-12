import { createHmac, timingSafeEqual } from "node:crypto";

// Resposta do suporte vinda do Hub. O Hub assina "reply.<timestamp>.<corpo exato>" com o mesmo segredo que o GCard usa
// para enviar eventos ao Hub (HUB_INGEST_SECRET). O prefixo "reply." impede reaproveitar uma assinatura de evento
// como pedido de resposta, e o contrário. Mesmo formato do Toqy.
export const HUB_REPLY_WINDOW_SECONDS = 300;

export function signHubReply(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`reply.${timestamp}.${rawBody}`).digest("hex");
}

export function validHubReplySignature(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  secret: string | undefined,
  nowSeconds: number,
): boolean {
  if (!secret || secret.length < 32 || !timestamp || !signature) return false;
  if (!/^\d{10}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > HUB_REPLY_WINDOW_SECONDS) return false;
  const want = Buffer.from(signHubReply(secret, timestamp, raw), "hex");
  const given = Buffer.from(signature.trim(), "hex");
  return given.length === want.length && timingSafeEqual(given, want);
}

export type HubReplyBody = { conversa: string; texto: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Corpo: { conversa: id da conversa do chat, texto: de 1 a 2000 caracteres }. */
export function parseHubReplyBody(raw: string): HubReplyBody | null {
  let b: unknown;
  try {
    b = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!b || typeof b !== "object") return null;
  const { conversa, texto } = b as { conversa?: unknown; texto?: unknown };
  if (typeof conversa !== "string" || !UUID.test(conversa) || typeof texto !== "string")
    return null;
  const t = texto.trim();
  if (t.length < 1 || t.length > 2000) return null;
  return { conversa: conversa.toLowerCase(), texto: t };
}
