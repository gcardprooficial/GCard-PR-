import * as meta from "./graph.server";
import * as zapi from "./zapi.server";

/** Z-API é o padrão quando configurada; senão cai pra API oficial da Meta. */
export const provider = (): "zapi" | "meta" => (zapi.zapiConfigured() ? "zapi" : "meta");

/** Botão nativo só é confiável na API oficial; na Z-API vira lista numerada em texto. */
export const supportsNativeButtons = () => provider() === "meta";

export const sendText = (to: string, text: string) =>
  provider() === "zapi" ? zapi.sendText(to, text) : meta.sendText(to, text);

export const sendAudio = (to: string, bytes: Uint8Array, mime: string) =>
  provider() === "zapi" ? zapi.sendAudio(to, bytes, mime) : meta.sendAudio(to, bytes, mime);

export const sendButtons = (to: string, text: string, buttons: { id: string; title: string }[]) =>
  meta.sendButtons(to, text, buttons);

export const markRead = (to: string, messageId: string) =>
  provider() === "zapi" ? zapi.markRead(to, messageId) : meta.markRead(messageId);
