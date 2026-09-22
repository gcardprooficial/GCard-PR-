/** Transportadoras usadas hoje (Correios direto ou via Melhor Envio) + link de rastreio de cada uma. */
export const CARRIERS = [
  { value: "correios", label: "Correios" },
  { value: "jadlog", label: "Jadlog" },
  { value: "loggi", label: "Loggi" },
  { value: "azul_cargo", label: "Azul Cargo" },
  { value: "latam_cargo", label: "LATAM Cargo" },
  { value: "j_e_t", label: "J&T Express" },
  { value: "outra", label: "Outra transportadora" },
] as const;

export type CarrierValue = (typeof CARRIERS)[number]["value"];

const TRACKING_URL: Partial<Record<CarrierValue, (code: string) => string>> = {
  correios: (code) => `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`,
  jadlog: (code) => `https://www.jadlog.com.br/tracking/${encodeURIComponent(code)}`,
  loggi: (code) => `https://www.loggi.com/rastreador/${encodeURIComponent(code)}`,
};

export function carrierLabel(value: string | null): string {
  return CARRIERS.find((c) => c.value === value)?.label ?? "Transportadora";
}

/** Link de rastreio pronto quando a transportadora tem um; senão null (mostra só o código). */
export function trackingUrl(carrier: string | null, code: string): string | null {
  if (!carrier) return null;
  return TRACKING_URL[carrier as CarrierValue]?.(code) ?? null;
}
