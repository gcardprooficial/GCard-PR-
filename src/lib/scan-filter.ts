import { createHash } from "node:crypto";

// Filtro de robôs e pré-visualização de link no /r. A leitura continua redirecionando (a pré-visualização
// precisa resolver), mas entra como "robô" e não soma no contador de gente.
const BOT_UA =
  /(facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|whatsapp\/\d|twitterbot|slackbot|slack-imgproxy|telegrambot|discordbot|linkedinbot|pinterest|skypeuripreview|googlebot|google-inspectiontool|adsbot|bingbot|bingpreview|yandex|baiduspider|duckduckbot|applebot|embedly|quora link preview|redditbot|vkshare|W3C_Validator|headlesschrome|phantomjs|puppeteer|playwright|curl\/|wget\/|python-requests|python-urllib|go-http-client|okhttp\/|java\/|libwww|httpclient|node-fetch|axios\/|postmanruntime|insomnia|uptimerobot|pingdom|statuscake|crawler|spider|bot\b)/i;

export type ScanClass = { isBot: boolean; reason: string | null };

/** Robô, pré-carregamento ou pré-visualização? Usa o User-Agent e cabeçalhos de prefetch. */
export function classifyScan(headers: Headers): ScanClass {
  const ua = headers.get("user-agent") ?? "";
  if (!ua.trim()) return { isBot: true, reason: "sem_user_agent" };
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-purpose") ?? ""} ${headers.get("x-moz") ?? ""}`.toLowerCase();
  if (/(prefetch|prerender|preview)/.test(purpose)) return { isBot: true, reason: "prefetch" };
  const m = BOT_UA.exec(ua);
  if (m) return { isBot: true, reason: `ua:${m[1]!.toLowerCase().slice(0, 40)}` };
  return { isBot: false, reason: null };
}

/** Só aceita q (QR) ou n (NFC); qualquer outro valor é ignorado (vira desconhecido) e nunca segue para o destino. */
export function parseScanSource(value: string | null): "q" | "n" | null {
  return value === "q" || value === "n" ? value : null;
}

/** País: Vercel primeiro; Cloudflare como alternativa. Só o código de 2 letras. */
export function scanCountry(headers: Headers): string | null {
  const raw = headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry");
  return raw && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
}

/** Identificador do visitante no dia: hash com sal; não guarda IP nem User-Agent e não se liga entre dias. */
export function visitorHash(ip: string, ua: string, day: string): string {
  const salt = process.env["SCAN_HASH_SALT"] ?? "gcard-scan";
  return createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 24);
}
