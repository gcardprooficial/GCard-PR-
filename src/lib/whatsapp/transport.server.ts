import * as meta from "./graph.server";
import * as zapi from "./zapi.server";

/** Z-API é o padrão quando configurada; senão cai pra API oficial da Meta. */
export const provider = (): "zapi" | "meta" => (zapi.zapiConfigured() ? "zapi" : "meta");

/** Botão nativo: sempre na Meta; na Z-API só se ZAPI_NATIVE_BUTTONS=true (senão vira lista numerada). */
export const supportsNativeButtons = () => provider() === "meta" || process.env["ZAPI_NATIVE_BUTTONS"] === "true";

export const sendText = (to: string, text: string) =>
  provider() === "zapi" ? zapi.sendText(to, text) : meta.sendText(to, text);

export const sendAudio = (to: string, bytes: Uint8Array, mime: string) =>
  provider() === "zapi" ? zapi.sendAudio(to, bytes, mime) : meta.sendAudio(to, bytes, mime);

export const sendButtons = (to: string, text: string, buttons: { id: string; title: string }[]) =>
  provider() === "zapi" ? zapi.sendButtons(to, text, buttons) : meta.sendButtons(to, text, buttons);

export const sendImage = (to: string, url: string, caption: string) =>
  provider() === "zapi" ? zapi.sendImage(to, url, caption) : meta.sendImage(to, url, caption);

export const markRead = (to: string, messageId: string) =>
  provider() === "zapi" ? zapi.markRead(to, messageId) : meta.markRead(messageId);
