import * as meta from "./graph.server";
import * as zapi from "./zapi.server";

/** Z-API é o padrão quando configurada; senão cai pra API oficial da Meta. */
export const provider = (): "zapi" | "meta" => (zapi.zapiConfigured() ? "zapi" : "meta");

/** Botão nativo: sempre na Meta; na Z-API só se ZAPI_NATIVE_BUTTONS=true (senão vira lista numerada). */
export const supportsNativeButtons = () => provider() === "meta" || process.env["ZAPI_NATIVE_BUTTONS"] === "true";

/**
 * Chave geral de ENVIO. Desligada por padrão: o número foi banido e o sistema não pode mandar nada por ele.
 * Para religar (com outro número): defina WHATSAPP_OUTBOUND=on na Vercel e faça redeploy.
 * Receber mensagens e mostrar o histórico no painel continuam funcionando; só o envio para.
 */
export const outboundEnabled = (): boolean => process.env["WHATSAPP_OUTBOUND"] === "on";

export const sendText = async (to: string, text: string): Promise<string | null> =>
  !outboundEnabled() ? null : provider() === "zapi" ? zapi.sendText(to, text) : meta.sendText(to, text);

export const sendAudio = async (to: string, bytes: Uint8Array, mime: string): Promise<string | null> =>
  !outboundEnabled() ? null : provider() === "zapi" ? zapi.sendAudio(to, bytes, mime) : meta.sendAudio(to, bytes, mime);

export const sendButtons = async (to: string, text: string, buttons: { id: string; title: string }[]): Promise<string | null> =>
  !outboundEnabled() ? null : provider() === "zapi" ? zapi.sendButtons(to, text, buttons) : meta.sendButtons(to, text, buttons);

export const sendImage = async (to: string, url: string, caption: string): Promise<string | null> =>
  !outboundEnabled() ? null : provider() === "zapi" ? zapi.sendImage(to, url, caption) : meta.sendImage(to, url, caption);

export const markRead = async (to: string, messageId: string): Promise<void> => {
  if (!outboundEnabled()) return;
  return provider() === "zapi" ? zapi.markRead(to, messageId) : meta.markRead(messageId);
};
