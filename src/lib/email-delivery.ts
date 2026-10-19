import { createHmac, timingSafeEqual } from "node:crypto";

/** Assinatura Svix (usada pelo Resend): HMAC-SHA256 de `${id}.${timestamp}.${corpo}` com o segredo `whsec_...` em base64. */
export function validSvixSignature(
  raw: string,
  h: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string | undefined,
  nowMs = Date.now(),
): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 5 * 60) return false; // repetição de aviso antigo
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const want = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${raw}`).digest();
  return h.signature.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

export type DeliveryStatus = "entregue" | "atrasado" | "bounce" | "suprimido" | "reclamacao";
export type DeliveryChange = { messageId: string; status: DeliveryStatus; detail: string | null };

const BY_TYPE: Record<string, DeliveryStatus> = {
  "email.delivered": "entregue",
  "email.delivery_delayed": "atrasado",
  "email.bounced": "bounce",
  "email.suppressed": "suprimido",
  "email.complained": "reclamacao",
};

/** null = evento que não muda o estado de entrega (aberto, clicado, enviado…). */
export function parseResendEvent(body: unknown): DeliveryChange | null {
  const b = body as { type?: unknown; data?: { email_id?: unknown; bounce?: { message?: unknown }; suppressed?: { message?: unknown } } } | null;
  const status = typeof b?.type === "string" ? BY_TYPE[b.type] : undefined;
  const messageId = b?.data?.email_id;
  if (!status || typeof messageId !== "string" || !messageId) return null;
  const msg = b?.data?.bounce?.message ?? b?.data?.suppressed?.message;
  return { messageId, status, detail: typeof msg === "string" ? msg.slice(0, 300) : null };
}

/** Problema que o admin precisa ver (cliente não recebeu): avisa por outro canal. */
export const isDeliveryProblem = (s: DeliveryStatus) => s === "bounce" || s === "suprimido" || s === "reclamacao";
