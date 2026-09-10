// Validação do destino da rota pública /r/[token] (Fase 3).
// Regra da spec §5/§14: só https, e SÓ destinos de família Google
// (avaliação/perfil) ou do domínio próprio. Nunca open redirect genérico.

// Adicionar aqui o domínio próprio quando existir.
const ALLOWED_HOST_SUFFIXES = [
  "google.com",
  "goo.gl",
  "g.page",
];

/** true se `url` pode ser usada como destino de redirect de uma placa. */
export function isSafePlateDestination(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Monta a URL de "escrever avaliação" do Google a partir do place_id. */
export function googleWriteReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
