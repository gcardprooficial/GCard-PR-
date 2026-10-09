// SuperFrete (cotação). Só lê preço: não gasta saldo nem compra etiqueta.
// Token fica só em SUPERFRETE_TOKEN (Vercel). SUPERFRETE_API_URL troca para o sandbox em testes.
const ORIGIN_POSTAL_CODE = "13344652"; // Indaiatuba/SP -- mesma origem do Melhor Envio
const USER_AGENT = "GCard-PRO site (gcardpro.oficial@gmail.com)";

export function superFreteConfigured() {
  return Boolean(process.env["SUPERFRETE_TOKEN"]);
}

function baseUrl() {
  return (process.env["SUPERFRETE_API_URL"] ?? "https://api.superfrete.com").replace(/\/$/, "");
}

export type SuperFreteQuote = { id: number; name: string; priceCents: number; deliveryDays: number | null };

/** Cotação de um pacote. Medidas em cm, peso em kg. Serviços: 1 PAC, 2 SEDEX, 17 Mini Envios. */
export async function calculateSuperFrete(input: {
  destinationCep: string;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  weightKg: number;
}): Promise<{ ok: true; quotes: SuperFreteQuote[] } | { ok: false; error: string }> {
  const token = process.env["SUPERFRETE_TOKEN"];
  if (!token) return { ok: false, error: "SuperFrete não está configurado (falta SUPERFRETE_TOKEN)." };
  const res = await fetch(`${baseUrl()}/api/v0/calculator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { postal_code: ORIGIN_POSTAL_CODE },
      to: { postal_code: input.destinationCep.replace(/\D/g, "") },
      services: "1,2,17",
      options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
      package: { height: input.heightCm, width: input.widthCm, length: input.lengthCm, weight: input.weightKg },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return { ok: false, error: `SuperFrete recusou a cotação [${res.status}]: ${(await res.text()).slice(0, 200)}` };
  const json = (await res.json()) as { id: number; name: string; price?: number | string; delivery_time?: number; has_error?: boolean; error?: string }[];
  const quotes = json
    .filter((r) => !r.has_error && !r.error && Number(r.price) > 0)
    .map((r) => ({ id: r.id, name: r.name, priceCents: Math.round(Number(r.price) * 100), deliveryDays: r.delivery_time ?? null }))
    .sort((a, b) => a.priceCents - b.priceCents);
  return { ok: true, quotes };
}
