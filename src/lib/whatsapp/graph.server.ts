import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

function cfg() {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneId) throw new Error("WhatsApp não configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).");
  return { token, phoneId };
}

/** Confere a assinatura X-Hub-Signature-256 da Meta -- sem isso qualquer um poderia forjar mensagens. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env["WHATSAPP_APP_SECRET"];
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function post(path: string, body: unknown): Promise<{ messages?: { id: string }[] }> {
  const { token } = cfg();
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(`WhatsApp [${res.status}]: ${json.error?.message ?? "erro desconhecido"}`);
  return json as { messages?: { id: string }[] };
}

export async function sendText(to: string, text: string): Promise<string | null> {
  const { phoneId } = cfg();
  const r = await post(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text.slice(0, 4000), preview_url: true },
  });
  return r.messages?.[0]?.id ?? null;
}

/** Até 3 botões de resposta (título máx. 20 caracteres, regra da Meta). O clique volta no webhook com o id. */
export async function sendButtons(
  to: string,
  text: string,
  buttons: { id: string; title: string }[],
): Promise<string | null> {
  const { phoneId } = cfg();
  const r = await post(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: text.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  });
  return r.messages?.[0]?.id ?? null;
}

/** Sobe o áudio na Meta e envia. ogg/opus aparece como mensagem de voz; mp3/m4a vai como arquivo de áudio. */
export async function sendAudio(to: string, bytes: Uint8Array, mime: string): Promise<string | null> {
  const { token, phoneId } = cfg();
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), "audio");
  const up = await fetch(`${GRAPH}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const upJson = (await up.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!up.ok || !upJson.id) throw new Error(`WhatsApp mídia [${up.status}]: ${upJson.error?.message ?? "falha no upload"}`);
  const r = await post(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "audio",
    audio: { id: upJson.id },
  });
  return r.messages?.[0]?.id ?? null;
}

export async function sendImage(to: string, url: string, caption: string): Promise<string | null> {
  const { phoneId } = cfg();
  const r = await post(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: url, caption: caption.slice(0, 1000) },
  });
  return r.messages?.[0]?.id ?? null;
}

export async function markRead(waMessageId: string): Promise<void> {
  const { phoneId } = cfg();
  await post(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: waMessageId,
  }).catch(() => undefined);
}
