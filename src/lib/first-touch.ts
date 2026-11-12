// Origem da primeira visita (first-touch): cookie próprio do site por 30 dias, sem terceiros.
// Gravado uma vez e nunca sobrescrito por visitas posteriores. O servidor revalida tudo (o cookie vem do navegador).

export type FirstTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  /** Parâmetros da Utmify (src e sck) e identificadores de clique dos anúncios. Diferenciam maiúsculas e minúsculas. */
  src?: string;
  sck?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  ref?: string;
  landing?: string;
  referrer_host?: string;
  ts?: string;
};

const COOKIE = "gcard_ft";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "ref"] as const;
/** Valores que não podem ser passados para minúsculas (identificadores de clique e códigos da Utmify). */
const RAW_KEYS = ["src", "sck", "fbclid", "gclid", "ttclid"] as const;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Valores padrão de origem usados nos links: youtube, instagram, discord, curso, apuracao, toqy, whatsapp, email. */
export function sanitizeFirstTouch(raw: unknown): FirstTouch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: FirstTouch = {};
  for (const k of KEYS) {
    const v = clean(r[k], k === "utm_campaign" || k === "utm_content" || k === "utm_term" ? 80 : 60).toLowerCase();
    if (v) out[k] = v;
  }
  for (const k of RAW_KEYS) {
    const v = clean(r[k], 200);
    if (v) out[k] = v;
  }
  const landing = clean(r["landing"], 120);
  if (landing) out.landing = landing;
  const host = clean(r["referrer_host"], 80).toLowerCase();
  if (host) out.referrer_host = host;
  const ts = clean(r["ts"], 40);
  if (ts) out.ts = ts;
  return Object.keys(out).length ? out : null;
}

/** Lê o cookie de um cabeçalho Cookie (servidor) ou de document.cookie (navegador). */
export function parseFirstTouchCookie(cookieHeader: string | null | undefined): FirstTouch | null {
  if (!cookieHeader) return null;
  const part = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!part) return null;
  try {
    return sanitizeFirstTouch(JSON.parse(decodeURIComponent(part.slice(COOKIE.length + 1))));
  } catch {
    return null;
  }
}

export function getFirstTouch(): FirstTouch | null {
  if (typeof document === "undefined") return null;
  return parseFirstTouchCookie(document.cookie);
}

/** Chamado uma vez no layout raiz. Se o cookie já existe, não faz nada (first-touch). */
export function captureFirstTouch(): void {
  if (typeof document === "undefined" || getFirstTouch()) return;
  const params = new URLSearchParams(window.location.search);
  const raw: Record<string, string> = {};
  for (const k of KEYS) {
    const v = params.get(k) ?? (k === "ref" ? params.get("cupom") : null);
    if (v) raw[k] = v;
  }
  for (const k of RAW_KEYS) {
    const v = params.get(k);
    if (v) raw[k] = v;
  }
  // Quem chega pelo atalho do kit (/comprar?kit=...) e não traz utm_source vem do curso/personalizar.
  if (!raw["utm_source"] && params.get("kit")) raw["utm_source"] = "personalizar";
  raw["landing"] = window.location.pathname;
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname : "";
    if (ref && ref !== window.location.hostname) raw["referrer_host"] = ref;
  } catch {
    /* referrer inválido: ignora */
  }
  raw["ts"] = new Date().toISOString();
  const ft = sanitizeFirstTouch(raw);
  if (!ft) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(ft))}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

/** Parâmetros de rastreio no formato que a Utmify usa (para enviar junto do pedido quando a integração for ligada). */
export function trackingParameters(ft: FirstTouch | null | undefined) {
  const f = ft ?? {};
  return {
    src: f.src ?? null,
    sck: f.sck ?? null,
    utm_source: f.utm_source ?? null,
    utm_campaign: f.utm_campaign ?? null,
    utm_medium: f.utm_medium ?? null,
    utm_content: f.utm_content ?? null,
    utm_term: f.utm_term ?? null,
  };
}

/** Acrescenta a origem da primeira visita (UTM, src, sck e cliques) a um link que sai do site, sem sobrescrever o que o link já traz. */
export function appendTracking(url: string): string {
  const ft = getFirstTouch();
  if (!ft) return url;
  try {
    const u = new URL(url);
    for (const k of [...KEYS, ...RAW_KEYS]) {
      if (k === "ref") continue;
      const v = ft[k];
      if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}
