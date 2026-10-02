import { timingSafeEqual } from "node:crypto";

function cfg() {
  const id = process.env["ZAPI_INSTANCE_ID"];
  const token = process.env["ZAPI_TOKEN"];
  if (!id || !token) throw new Error("Z-API não configurada (ZAPI_INSTANCE_ID / ZAPI_TOKEN).");
  return { base: `https://api.z-api.io/instances/${id}/token/${token}`, clientToken: process.env["ZAPI_CLIENT_TOKEN"] };
}

export const zapiConfigured = () => Boolean(process.env["ZAPI_INSTANCE_ID"] && process.env["ZAPI_TOKEN"]);

/** Z-API não assina o webhook: a URL carrega um segredo (?secret=...) comparado em tempo constante. */
export function verifyWebhookSecret(given: string | null): boolean {
  const secret = process.env["ZAPI_WEBHOOK_SECRET"];
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function post(path: string, body: unknown): Promise<{ messageId?: string; id?: string }> {
  const { base, clientToken } = cfg();
  const res = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { messageId?: string; id?: string; error?: string; message?: string };
  if (!res.ok) throw new Error(`Z-API [${res.status}]: ${json.error ?? json.message ?? "erro desconhecido"}`);
  return json;
}

export async function sendText(to: string, text: string): Promise<string | null> {
  // delayTyping: mostra "digitando…" por 2s antes de enviar -- parece humano e reduz risco de bloqueio.
  const r = await post("send-text", { phone: to, message: text.slice(0, 4000), delayTyping: 2 });
  return r.messageId ?? r.id ?? null;
}

export async function sendAudio(to: string, bytes: Uint8Array, mime: string): Promise<string | null> {
  const b64 = Buffer.from(bytes).toString("base64");
  const r = await post("send-audio", { phone: to, audio: `data:${mime};base64,${b64}`, delayTyping: 2 });
  return r.messageId ?? r.id ?? null;
}

export async function markRead(to: string, messageId: string): Promise<void> {
  await post("read-message", { phone: to, messageId }).catch(() => undefined);
}
