// Destino de uma placa (para onde /r/<token> redireciona). A lista de hosts permitidos vive no banco
// (tabela allowed_destination_hosts) e é lida por /r, /ativar e pelo gatilho SQL: é a única fonte.
// A regra com host "*" libera qualquer domínio público https; apagar essa linha volta a só Google/TOQY.

export type DestinationRule = { host: string; include_subdomains: boolean };

export const MAX_DESTINATION_LENGTH = 2000;

/**
 * Plano B se a tabela allowed_destination_hosts ainda não existe (deploy antes da migração) ou veio vazia:
 * volta ao comportamento de antes (só Google). Assim nenhum QR já impresso quebra por uma ordem de deploy.
 */
export const FALLBACK_RULES: DestinationRule[] = ["search.google.com", "www.google.com", "google.com", "maps.google.com", "g.page"].map((host) => ({
  host,
  include_subdomains: false,
}));

export const rulesOrFallback = (rules: DestinationRule[] | null | undefined): DestinationRule[] => (rules && rules.length > 0 ? rules : FALLBACK_RULES);

/** Domínio público: tem ponto, não é IP, não é localhost nem rede interna. Vale mesmo com a regra "*". */
export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.includes(":") || h.startsWith("[")) return false;
  if (/^[0-9.]+$/.test(h)) return false;
  return !/\.(local|internal|localhost|lan|home|corp)$/.test(h);
}

export type NormalizedDestination =
  | { ok: true; url: string; upgradedToHttps: boolean }
  | { ok: false; reason: string };

/** Aceita só http/https, sem usuário/senha e sem porta; http vira https. Normaliza (host em minúsculas, sem espaços). */
export function normalizeDestination(raw: string): NormalizedDestination {
  const text = raw.trim();
  if (!text) return { ok: false, reason: "Cole o link de destino." };
  if (text.length > MAX_DESTINATION_LENGTH) return { ok: false, reason: "Link muito longo (máximo 2.000 caracteres)." };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, reason: "Esse link não parece válido. Ele começa com https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "Só links http ou https são aceitos." };
  if (url.username || url.password) return { ok: false, reason: "O link não pode ter usuário e senha." };
  if (url.port) return { ok: false, reason: "O link não pode ter porta no endereço." };
  if (!isPublicHost(url.hostname)) return { ok: false, reason: "Use o endereço de um site público (não vale IP nem endereço interno)." };
  const upgradedToHttps = url.protocol === "http:";
  url.protocol = "https:";
  return { ok: true, url: url.toString(), upgradedToHttps };
}

/** Host permitido? Exato, ou subdomínio quando a regra tem include_subdomains. */
export function isAllowedHost(host: string, rules: DestinationRule[]): boolean {
  const h = host.toLowerCase();
  return rules.some((r) => r.host === "*" || h === r.host || (r.include_subdomains && h.endsWith(`.${r.host}`)));
}

/** Normaliza e confere o host contra as regras. Mensagem pronta para mostrar. */
export function checkDestination(raw: string, rules: DestinationRule[]): NormalizedDestination {
  const n = normalizeDestination(raw);
  if (!n.ok) return n;
  if (!isAllowedHost(new URL(n.url).hostname, rulesOrFallback(rules))) {
    return { ok: false, reason: "Esse endereço não é aceito para este código." };
  }
  return n;
}

export function isToqyHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "toqy.com.br" || h.endsWith(".toqy.com.br");
}

/** Página do TOQY: o painel mostra uma etiqueta. */
export function isToqyUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return isToqyHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export const TOQY_ONBOARDING_BASE = "https://toqy.com.br/onboarding";

/** Botão "Criar minha página no TOQY": sempre com origem, para medir. */
export function toqyOnboardingUrl(code: string): string {
  const q = new URLSearchParams({ utm_source: "gcard", utm_medium: "painel", utm_campaign: "criar_pagina", codigo: code });
  return `${TOQY_ONBOARDING_BASE}?${q.toString()}`;
}
