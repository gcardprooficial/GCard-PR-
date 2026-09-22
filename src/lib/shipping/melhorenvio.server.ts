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
  "shipping-generate",
  "shipping-print",
  "shipping-tracking",
  "ecommerce-shipping",
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
  if (!res.ok) throw new Error(`Melhor Envio token exchange falhou [${res.status}]: ${await res.text()}`);
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
async function getValidAccessToken(): Promise<string | null> {
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
