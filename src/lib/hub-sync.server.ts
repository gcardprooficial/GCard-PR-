import { signBody } from "./hub-outbox.server";

// Carga diária de contas para o hub (POST /api/sync/gcard). Reaproveita a assinatura e o segredo do outbox.
// Só as colunas combinadas, nunca CPF/CNPJ/senha/token/endereço/pagamento. Sem PII em log: só contagens.

export const SYNC_BATCH = 300;
export const SYNC_TIMEOUT_MS = 10_000;

/** Linha de people_summary() (já sem CPF/CNPJ). */
export type PersonRow = {
  email: string;
  name: string | null;
  phone: string | null;
  first_source: string | null;
  first_seen: string | null;
  orders_count: number | string;
  paid_orders: number | string;
  paid_total_cents: number | string;
  last_paid_at: string | null;
  plates_activated: number | string;
  has_account: boolean;
  email_confirmed: boolean;
  marketing_consent_at: string | null;
  marketing_unsubscribed_at: string | null;
};

export type SyncRecord = {
  email: string;
  nome: string | null;
  celular: string | null;
  origem: string | null;
  primeiro_contato: string | null;
  pedidos: number;
  pedidos_pagos: number;
  total_pago_reais: number;
  ultimo_pagamento: string | null;
  codigos_ativados: number;
  tem_conta: boolean;
  email_confirmado: boolean;
  aceite_em: string | null;
  descadastrado_em: string | null;
};

/** people_summary → registro do hub. Sem e-mail não vai (o e-mail é obrigatório). */
export function toRecord(p: PersonRow): SyncRecord | null {
  const email = (p.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  const digits = (p.phone ?? "").replace(/\D/g, "");
  return {
    email,
    nome: p.name?.trim() || null,
    celular: digits || null,
    origem: p.first_source || null,
    primeiro_contato: p.first_seen || null,
    pedidos: Number(p.orders_count) || 0,
    pedidos_pagos: Number(p.paid_orders) || 0,
    total_pago_reais: Math.round(Number(p.paid_total_cents) || 0) / 100,
    ultimo_pagamento: p.last_paid_at || null,
    codigos_ativados: Number(p.plates_activated) || 0,
    tem_conta: Boolean(p.has_account),
    email_confirmado: Boolean(p.email_confirmed),
    aceite_em: p.marketing_consent_at || null,
    descadastrado_em: p.marketing_unsubscribed_at || null,
  };
}

export function chunk<T>(items: T[], size = SYNC_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Endereço da carga, derivado do mesmo HUB_INGEST_URL do outbox (https://<hub>/api/ingest/gcard → /api/sync/gcard). */
export function syncUrl(ingestUrl: string): string {
  return `${new URL(ingestUrl).origin}/api/sync/gcard`;
}

export type SyncAction = "aplicado" | "esperar" | "parar" | "proxima_execucao";

/** Resposta do hub → o que fazer. 200 aplicado; 429 devagar; 401/413/422 (e outros 4xx) corrigir e não reenviar; 5xx/rede amanhã. */
export function classifySyncStatus(status: number | null): SyncAction {
  if (status === null) return "proxima_execucao";
  if (status === 200) return "aplicado";
  if (status === 429) return "esperar";
  if (status >= 500) return "proxima_execucao";
  return "parar";
}

export type BatchResult = { status: number | null; ok: boolean; linhas: number | null; retryAfterMs: number | null };

/** Assina e envia UM lote. O corpo assinado é exatamente a string enviada. */
export async function postBatch(
  records: SyncRecord[],
  cfg: { url: string; secret: string; fetchImpl?: typeof fetch | undefined; now?: (() => number) | undefined },
): Promise<BatchResult> {
  const body = JSON.stringify({ records });
  const timestamp = String(Math.floor((cfg.now?.() ?? Date.now()) / 1000));
  try {
    const res = await (cfg.fetchImpl ?? fetch)(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-timestamp": timestamp,
        "x-hub-signature": signBody(cfg.secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    let parsed: { ok?: unknown; linhas?: unknown } = {};
    try {
      parsed = (await res.json()) as typeof parsed;
    } catch {
      /* corpo vazio ou não JSON: vale só o status */
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    return {
      status: res.status,
      ok: parsed.ok === true,
      linhas: typeof parsed.linhas === "number" ? parsed.linhas : null,
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : null,
    };
  } catch {
    return { status: null, ok: false, linhas: null, retryAfterMs: null };
  }
}

export type SyncSummary = { registros: number; lotes: number; aplicados: number; linhas: number; parou: string | null };

const WAITS_429_MS = [5_000, 20_000];

/** Envia em lotes de até 300. 429: espera e tenta o mesmo lote (até 2 vezes). Outros erros: para esta execução. */
export async function runSync(
  records: SyncRecord[],
  cfg: {
    url: string;
    secret: string;
    fetchImpl?: typeof fetch | undefined;
    sleep?: ((ms: number) => Promise<void>) | undefined;
    now?: (() => number) | undefined;
  },
): Promise<SyncSummary> {
  const sleep = cfg.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const batches = chunk(records);
  const summary: SyncSummary = { registros: records.length, lotes: batches.length, aplicados: 0, linhas: 0, parou: null };

  for (const batch of batches) {
    let done = false;
    for (let attempt = 0; attempt <= WAITS_429_MS.length && !done; attempt++) {
      const r = await postBatch(batch, cfg);
      const action = classifySyncStatus(r.status);
      if (action === "aplicado") {
        summary.aplicados += 1;
        summary.linhas += r.linhas ?? batch.length;
        done = true;
      } else if (action === "esperar" && attempt < WAITS_429_MS.length) {
        await sleep(r.retryAfterMs ?? WAITS_429_MS[attempt]!);
      } else {
        summary.parou = action === "esperar" ? "http_429" : r.status === null ? "rede" : `http_${r.status}`;
        return summary;
      }
    }
  }
  return summary;
}

/** Duas contas FICTÍCIAS (domínio reservado example.com) para conferir a rota sem mexer em dado real. */
export function testRecords(): SyncRecord[] {
  const base = { celular: null, origem: "teste", pedidos: 0, pedidos_pagos: 0, total_pago_reais: 0, ultimo_pagamento: null, codigos_ativados: 0, tem_conta: true, email_confirmado: true, aceite_em: null, descadastrado_em: null };
  return [
    { ...base, email: "teste-sync-gcard-1@example.com", nome: "Conta Fictícia 1", primeiro_contato: "2026-01-01T00:00:00Z" },
    { ...base, email: "teste-sync-gcard-2@example.com", nome: "Conta Fictícia 2", primeiro_contato: "2026-01-02T00:00:00Z" },
  ];
}

const on = (v: string | undefined) => ["true", "on", "1"].includes((v ?? "").toLowerCase());
export const hubSyncEnabled = () => on(process.env["HUB_SYNC_ENABLED"]);
export const hubOutboxEnabled = () => on(process.env["HUB_OUTBOX_ENABLED"]);

/** Configuração do hub (a mesma do outbox). Null se faltar algo ou não for https. */
export function hubConfig(): { url: string; secret: string } | null {
  const ingest = process.env["HUB_INGEST_URL"];
  const secret = process.env["HUB_INGEST_SECRET"];
  if (!ingest || !ingest.startsWith("https://") || !secret || secret.length < 32) return null;
  try {
    return { url: syncUrl(ingest), secret };
  } catch {
    return null;
  }
}

/** Trava para não rodar duas cargas ao mesmo tempo (cron + botão, ou duplo clique). */
export type LockStore = { acquire: (ttlMs: number) => Promise<boolean>; release: () => Promise<void> };

export async function withLock<T>(
  store: LockStore,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false }> {
  if (!(await store.acquire(ttlMs))) return { ran: false };
  try {
    return { ran: true, value: await fn() };
  } finally {
    await store.release().catch(() => undefined);
  }
}

const LOCK_KEY = "hub_sync_lock";
const EPOCH = "1970-01-01T00:00:00.000Z";
export const LOCK_TTL_MS = 10 * 60_000; // se uma execução morrer no meio, a trava expira sozinha

/** Trava no banco (app_settings): a troca "livre → ocupada" é uma única atualização condicional, então só uma execução ganha. */
async function appSettingsLock(): Promise<LockStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { untyped } = await import("@/lib/db-untyped");
  const db = untyped(supabaseAdmin);
  return {
    async acquire(ttlMs) {
      await db.from("app_settings").upsert({ key: LOCK_KEY, value: { until: EPOCH } }, { onConflict: "key", ignoreDuplicates: true });
      const now = new Date().toISOString();
      const until = new Date(Date.now() + ttlMs).toISOString();
      const { data, error } = await db.from("app_settings").update({ value: { until } }).eq("key", LOCK_KEY).lt("value->>until", now).select("key");
      return !error && Array.isArray(data) && data.length === 1;
    },
    async release() {
      await db.from("app_settings").update({ value: { until: EPOCH } }).eq("key", LOCK_KEY);
    },
  };
}

export type DailySummary = SyncSummary & { lidos: number };

/** Carga completa: lê people_summary() e envia em lotes. Usada pelo cron diário e pelo botão do painel (a mesma função). */
export async function runDailyHubSync(): Promise<DailySummary | { skipped: string }> {
  const cfg = hubConfig();
  if (!cfg) return { skipped: "hub_nao_configurado" };
  const run = await withLock(await appSettingsLock(), LOCK_TTL_MS, async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { untyped } = await import("@/lib/db-untyped");
    const { data, error } = await untyped(supabaseAdmin).rpc("people_summary");
    if (error) return { skipped: "people_summary_falhou" } as const;
    const rows = (data ?? []) as PersonRow[];
    const records = rows.map(toRecord).filter((r): r is SyncRecord => r !== null);
    const summary: DailySummary = { lidos: rows.length, ...(await runSync(records, cfg)) };
    // Só contagens: sem e-mail, sem corpo.
    console.log("hub_sync", summary);
    if (summary.parou) {
      const { captureError } = await import("@/lib/sentry");
      captureError(new Error(`hub_sync parou: ${summary.parou}`));
    }
    return summary;
  });
  return run.ran ? run.value : { skipped: "ja_em_execucao" };
}
