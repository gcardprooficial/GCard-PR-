// Integração OAuth2 com o Melhor Envio. Fase 1: conectar a conta e provar que o token
// funciona (chama /me). Cotação de frete e compra de etiqueta entram numa fase 2, depois
// de confirmar que essa base está sólida -- comprar etiqueta mexe com saldo de verdade.

function baseUrl() {
  return process.env["MELHORENVIO_ENV"] === "production"
    ? "https://melhorenvio.com.br"
    : "https://sandbox.melhorenvio.com.br";
}

function redirectUri() {
  const origin = (process.env["PUBLIC_APP_URL"] ?? "https://www.gcardpro.com.br").replace(/\/$/, "");
  return `${origin}/api/melhorenvio/callback`;
}

const SCOPES = [
  "cart-write",
  "shipping-calculate",
  "shipping-checkout", // POST /shipment/checkout -- faltava, dava 403 "unauthorized"
  "shipping-generate",
  "shipping-print",
  "shipping-tracking",
  "ecommerce-shipping",
  "users-read", // GET /me (usado no "Testar conexão")
].join(" ");

async function hmac(message: string): Promise<string> {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente (usado pra assinar o state do OAuth).");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** state assinado (timestamp + assinatura) -- prova que o callback veio de um connect que nós mesmos geramos. */
async function signState(): Promise<string> {
  const ts = Date.now().toString();
  const sig = await hmac(ts);
  return `${ts}.${sig}`;
}

async function verifyState(state: string): Promise<boolean> {
  const [ts, sig] = state.split(".");
  if (!ts || !sig) return false;
  if (Date.now() - Number(ts) > 10 * 60_000) return false; // 10min pra completar o login no Melhor Envio
  const expected = await hmac(ts);
  return expected === sig;
}

const USER_AGENT = "GCard-PRO (contato@gcardpro.com.br)";

function clientId(): string {
  const id = process.env["MELHORENVIO_CLIENT_ID"];
  if (!id) throw new Error("MELHORENVIO_CLIENT_ID ausente.");
  return id;
}
function clientSecret() {
  const secret = process.env["MELHORENVIO_CLIENT_SECRET"];
  if (!secret) throw new Error("MELHORENVIO_CLIENT_SECRET ausente.");
  return secret;
}

export async function getConnectUrl(): Promise<string> {
  const state = await signState();
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${baseUrl()}/oauth/authorize?${params.toString()}`;
}

type TokenSet = { access_token: string; refresh_token: string; expires_at: number };

async function saveTokens(tokens: { access_token: string; refresh_token: string; expires_in: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const value: TokenSet = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  const { error } = await db
    .from("app_settings")
    .upsert({ key: "melhorenvio_oauth", value }, { onConflict: "key" });
  if (error) throw error;
}

async function loadTokens(): Promise<TokenSet | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data } = await db.from("app_settings").select("value").eq("key", "melhorenvio_oauth").maybeSingle();
  return (data?.value as TokenSet | undefined) ?? null;
}

/** O endpoint de token quer multipart/form-data, não JSON -- confirmado contra o SDK oficial (não a doc). */
function tokenForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

/** Só pra depurar 'invalid_client' sem vazar o secret: id/redirect mascarados, mas visíveis. */
function debugContext() {
  const id = process.env["MELHORENVIO_CLIENT_ID"] ?? "(ausente)";
  const secret = process.env["MELHORENVIO_CLIENT_SECRET"] ?? "";
  return {
    env: process.env["MELHORENVIO_ENV"] ?? "(ausente, default=sandbox)",
    baseUrl: baseUrl(),
    clientId: id,
    clientSecretLen: secret.length,
    clientSecretEdges: secret ? `${secret.slice(0, 3)}…${secret.slice(-3)}` : "(ausente)",
    redirectUri: redirectUri(),
  };
}

/** Troca o `code` do redirect pelo primeiro par de tokens. Verifica o state antes de tudo. */
export async function exchangeCodeForTokens(code: string, state: string) {
  if (!(await verifyState(state))) throw new Error("state inválido ou expirado -- inicie a conexão de novo.");
  const res = await fetch(`${baseUrl()}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    body: tokenForm({
      grant_type: "authorization_code",
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Melhor Envio token exchange falhou [${res.status}]: ${await res.text()} | debug: ${JSON.stringify(debugContext())}`,
    );
  }
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  await saveTokens(json);
}

async function refreshTokens(refreshToken: string) {
  const res = await fetch(`${baseUrl()}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    body: tokenForm({
      grant_type: "refresh_token",
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Melhor Envio refresh falhou [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  await saveTokens(json);
  return json.access_token;
}

/** Token válido pra usar agora -- renova sozinho se estiver perto de expirar. */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (tokens.expires_at - Date.now() > 5 * 60_000) return tokens.access_token;
  return refreshTokens(tokens.refresh_token);
}

export async function getConnectionStatus() {
  const tokens = await loadTokens();
  return { connected: !!tokens, expiresAt: tokens?.expires_at ?? null };
}

/** GET /me -- prova que o token funciona sem mexer em frete ou etiqueta. */
export async function testConnection() {
  const token = await getValidAccessToken();
  if (!token) return { ok: false as const, error: "not_connected" as const };
  const res = await fetch(`${baseUrl()}/api/v2/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return { ok: false as const, error: `http_${res.status}` as const };
  const json = (await res.json()) as { firstname?: string; lastname?: string; email?: string };
  return {
    ok: true as const,
    name: [json.firstname, json.lastname].filter(Boolean).join(" ") || json.email || "Conta conectada",
  };
}

// ---- Cotação de frete (fase 2a) -----------------------------------------------------
// Só lê preço, não gasta saldo nem compra etiqueta. Só pra você comparar transportadoras
// antes de decidir. O preço aqui NUNCA aparece pro comprador -- o site já cobra o frete
// diluído no preço do produto.

const ORIGIN_POSTAL_CODE = "13344652";

/** Peso/medidas de um kit fechado de 10 unidades. Ajuste aqui se a embalagem mudar. */
const PACKAGE_PROFILES = {
  acrilico: { heightCm: 4, widthCm: 4, lengthCm: 10, weightKg: 0.5, perUnits: 10 },
  pvc: { heightCm: 2, widthCm: 2, lengthCm: 8, weightKg: 0.3, perUnits: 10 },
} as const;
export type PackageProfileKey = keyof typeof PACKAGE_PROFILES;

export type FreightQuote = {
  id: number;
  name: string;
  company: string;
  priceCents: number;
  deliveryDays: number | null;
};

/**
 * Cotação pra N unidades de um perfil de embalagem. Kits fechados de 10 são empilháveis
 * (placa/cartão são planos), então N unidades viram ceil(N/10) caixas do mesmo tamanho
 * base, empilhadas (altura escala com a quantidade de kits; largura/comprimento ficam
 * fixos -- é a área da própria peça).
 * ponytail: aproximação de empacotamento, não é cubagem exata. Você vê o preço final do
 * Melhor Envio antes de comprar qualquer etiqueta -- se destoar muito, ajuste o perfil.
 */
export async function calculateFreight(input: {
  destinationCep: string;
  profile: PackageProfileKey;
  quantity: number;
}): Promise<{ ok: true; quotes: FreightQuote[] } | { ok: false; error: string }> {
  const token = await getValidAccessToken();
  if (!token) return { ok: false, error: "Melhor Envio não está conectado." };

  const p = PACKAGE_PROFILES[input.profile];
  const kits = Math.max(1, Math.ceil(input.quantity / p.perUnits));
  const destCep = input.destinationCep.replace(/\D/g, "");

  const res = await fetch(`${baseUrl()}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      from: { postal_code: ORIGIN_POSTAL_CODE },
      to: { postal_code: destCep },
      package: {
        height: p.heightCm * kits,
        width: p.widthCm,
        length: p.lengthCm,
        weight: p.weightKg * kits,
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `Melhor Envio recusou a cotação [${res.status}]: ${await res.text()}` };

  const json = (await res.json()) as {
    id: number;
    name: string;
    price?: string;
    delivery_time?: number;
    company?: { name?: string };
    error?: string;
  }[];

  const quotes: FreightQuote[] = json
    .filter((r) => !r.error && r.price)
    .map((r) => ({
      id: r.id,
      name: r.name,
      company: r.company?.name ?? r.name,
      priceCents: Math.round(Number(r.price) * 100),
      deliveryDays: r.delivery_time ?? null,
    }))
    .sort((a, b) => a.priceCents - b.priceCents);

  return { ok: true, quotes };
}

// ---- Compra de etiqueta (fase 2b) ---------------------------------------------------
// Gasta saldo real da carteira Melhor Envio. Preço mostrado ao comprador NUNCA muda --
// isso é só pra Leonardo comprar a etiqueta mais barata e ter rastreio automático.

/** Remetente (Leonardo/Marusso Produções) -- dado real, confirmado 24/09/2026. */
const ORIGIN_ADDRESS = {
  name: "Leonardo Marusso",
  document: "47350379854", // CPF (conta Melhor Envio é pessoa física)
  company_document: "68194199000170", // CNPJ Marusso Produções
  phone: "19997051919",
  email: "gcardpro.oficial@gmail.com",
  address: "Romeu Ferigati",
  number: "330",
  complement: "Apartamento 01",
  district: "Jardim Belo Horizonte",
  city: "Indaiatuba",
  state_abbr: "SP",
  postal_code: ORIGIN_POSTAL_CODE,
  country_id: "BR",
};

export type LabelPurchaseInput = {
  quoteId: number;
  profile: PackageProfileKey;
  quantity: number;
  /** Valor declarado por unidade (reais, com centavos) -- pra alfândega/seguro do Melhor Envio. */
  unitaryValue: number;
  destination: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string;
    street: string;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string;
    stateAbbr: string;
    postalCode: string;
  };
};

async function meFetch(path: string, token: string, body: unknown) {
  const res = await fetch(`${baseUrl()}/api/v2/me${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Melhor Envio [${path}] falhou [${res.status}]: ${JSON.stringify(json)}`);
  return json;
}

/**
 * Compra a etiqueta de uma cotação já mostrada (id de `calculateFreight`): adiciona ao
 * carrinho, paga com saldo da carteira e gera a etiqueta. Retorna o código de rastreio.
 * ponytail: sem função de cancelamento aqui -- se pagar errado, cancelar direto no painel
 * do Melhor Envio (eles reembolsam pra carteira). Adicionar se virar rotina.
 */
export async function buyShippingLabel(
  input: LabelPurchaseInput,
): Promise<{ ok: true; trackingCode: string; carrier: string } | { ok: false; error: string }> {
  const token = await getValidAccessToken();
  if (!token) return { ok: false, error: "Melhor Envio não está conectado." };

  const p = PACKAGE_PROFILES[input.profile];
  const kits = Math.max(1, Math.ceil(input.quantity / p.perUnits));
  const d = input.destination;

  try {
    const cartItem = (await meFetch("/cart", token, {
      service: input.quoteId,
      from: ORIGIN_ADDRESS,
      to: {
        name: d.name,
        document: (d.document ?? "").replace(/\D/g, "") || undefined,
        phone: (d.phone ?? "").replace(/\D/g, "") || undefined,
        email: d.email,
        address: d.street,
        number: d.number || "S/N",
        complement: d.complement || undefined,
        district: d.district || undefined,
        city: d.city,
        state_abbr: d.stateAbbr,
        postal_code: d.postalCode.replace(/\D/g, ""),
        country_id: "BR",
      },
      products: [
        {
          name: "Placa GCard-PRÓ",
          quantity: input.quantity,
          unitary_value: Number(input.unitaryValue.toFixed(2)),
        },
      ],
      volumes: [
        { height: p.heightCm * kits, width: p.widthCm, length: p.lengthCm, weight: p.weightKg * kits },
      ],
      // Precisa bater com o valor declarado dos produtos (unitary_value x quantidade) e ser >= R$1.
      options: {
        insurance_value: Math.max(1, Number((input.unitaryValue * input.quantity).toFixed(2))),
        receipt: false,
        own_hand: false,
        non_commercial: false,
      },
    })) as { id: string };

    await meFetch("/shipment/checkout", token, { orders: [cartItem.id] });
    const generated = (await meFetch("/shipment/generete", token, { orders: [cartItem.id] })) as {
      id?: string;
      tracking?: string;
    }[];

    const trackingCode = generated?.[0]?.tracking;
    if (!trackingCode) return { ok: false, error: "Etiqueta gerada mas sem código de rastreio ainda -- confira no painel do Melhor Envio." };

    return { ok: true, trackingCode, carrier: "melhor-envio" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido na compra." };
  }
}
