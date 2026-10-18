import { createHmac } from "node:crypto";

// Envio do outbox de eventos para o hub (contrato v1). Sem PII em log: só tipo do evento e código de erro.

export type OutboxRow = {
  id: string;
  event_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  priority: number;
  created_at: string;
};

export type Outcome = "enviado" | "morto" | "retry";

export const MAX_ATTEMPTS = 8;
const WAITS_MIN = [1, 5, 30, 120, 720];
export const SEND_TIMEOUT_MS = 10_000;

/** Espera até a próxima tentativa, dado quantas tentativas JÁ falharam (1ª falha: 1 min … 5ª em diante: 12 h). */
export const retryDelayMs = (failedAttempts: number): number =>
  WAITS_MIN[Math.min(Math.max(failedAttempts, 1), WAITS_MIN.length) - 1]! * 60_000;

/** Resposta do hub → o que fazer. `null` = rede ou tempo esgotado. */
export function classifyStatus(status: number | null): Outcome {
  if (status === null) return "retry";
  if (status === 429 || status >= 500) return "retry";
  if (status >= 200 && status < 300) return "enviado"; // 200 aceito/duplicado, 202 guardado (o hub reprocessa)
  return "morto"; // 400, 401, 404, 413, 422 e qualquer outro 4xx/3xx: permanente
}

export const signBody = (secret: string, timestamp: string, body: string): string =>
  createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

const FORBIDDEN_KEY = /cpf|cnpj|senha|password|token|secret/i;

/** Confere o envelope antes de enviar (as mesmas recusas do hub). Devolve o motivo, ou null se está ok. */
export function envelopeProblem(p: Record<string, unknown>): string | null {
  if (p["schema_version"] !== 1) return "schema_version";
  if (typeof p["event_id"] !== "string" || !p["event_id"]) return "event_id";
  if (typeof p["type"] !== "string" || !p["type"]) return "type";
  if (p["source"] !== "gcard") return "source";
  if (typeof p["occurred_at"] !== "string" || !p["occurred_at"].endsWith("Z")) return "occurred_at";
  const person = p["person"] as { email?: unknown } | undefined;
  if (!person || typeof person.email !== "string" || !person.email.includes("@")) return "person_email";
  const data = (p["data"] ?? {}) as Record<string, unknown>;
  const keys = Object.keys(data);
  if (keys.length > 20) return "data_chaves";
  for (const k of keys) {
    if (FORBIDDEN_KEY.test(k)) return "data_chave_proibida";
    const v = data[k];
    const ok = v === null || typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= 300);
    if (!ok) return "data_valor";
  }
  return null;
}

export type SendResult = { status: number | null; error: string | null };

/** Assina e envia UM item. O corpo assinado é exatamente a string enviada. */
export async function sendOne(
  row: OutboxRow,
  cfg: { url: string; secret: string; fetchImpl?: typeof fetch | undefined; now?: (() => number) | undefined },
): Promise<SendResult> {
  const body = JSON.stringify(row.payload);
  const timestamp = String(Math.floor((cfg.now?.() ?? Date.now()) / 1000));
  try {
    const res = await (cfg.fetchImpl ?? fetch)(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-timestamp": timestamp,
        "x-hub-signature": signBody(cfg.secret, timestamp, body),
        "x-hub-event-id": String(row.payload["event_id"]),
      },
      body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return { status: res.status, error: null };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { status: null, error: timedOut ? "timeout" : "rede" };
  }
}

export type OutboxPatch = {
  status?: "enviado" | "morto" | "pendente";
  attempts: number;
  next_attempt_at?: string;
  last_error: string | null;
  sent_at?: string | null;
};

export type OutboxStore = {
  claim: (limit: number) => Promise<OutboxRow[]>;
  update: (id: string, patch: OutboxPatch) => Promise<void>;
  alertDead: (row: OutboxRow, code: string) => void;
};

export type RunSummary = { claimed: number; enviado: number; morto: number; retry: number; invalid: number };

/** Decide e grava o resultado de UM item (separado para poder testar sem rede nem banco). */
export function nextState(row: OutboxRow, result: SendResult, nowMs: number): { outcome: Outcome; patch: OutboxPatch } {
  const attempts = row.attempts + 1;
  const code = result.status !== null ? `http_${result.status}` : (result.error ?? "rede");
  const outcome = classifyStatus(result.status);
  if (outcome === "enviado") {
    return { outcome, patch: { status: "enviado", attempts, last_error: null, sent_at: new Date(nowMs).toISOString() } };
  }
  if (outcome === "morto" || attempts >= MAX_ATTEMPTS) {
    return { outcome: "morto", patch: { status: "morto", attempts, last_error: code } };
  }
  return {
    outcome: "retry",
    patch: { status: "pendente", attempts, last_error: code, next_attempt_at: new Date(nowMs + retryDelayMs(attempts)).toISOString() },
  };
}

/** Uma rodada: pega até `limit` itens vencidos, envia com paralelismo pequeno e dentro de um orçamento de tempo. */
export async function runOutbox(
  store: OutboxStore,
  cfg: {
    url: string;
    secret: string;
    fetchImpl?: typeof fetch | undefined;
    limit?: number | undefined;
    concurrency?: number | undefined;
    budgetMs?: number | undefined;
    now?: (() => number) | undefined;
  },
): Promise<RunSummary> {
  const now = cfg.now ?? Date.now;
  const started = now();
  const budget = cfg.budgetMs ?? 120_000;
  const rows = (await store.claim(cfg.limit ?? 50)).sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));
  const summary: RunSummary = { claimed: rows.length, enviado: 0, morto: 0, retry: 0, invalid: 0 };
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length && now() - started < budget) {
      const row = rows[cursor++]!;
      const problem = envelopeProblem(row.payload);
      if (problem) {
        summary.invalid += 1;
        await store.update(row.id, { status: "morto", attempts: row.attempts + 1, last_error: `envelope_${problem}` });
        store.alertDead(row, `envelope_${problem}`);
        continue;
      }
      const result = await sendOne(row, { url: cfg.url, secret: cfg.secret, fetchImpl: cfg.fetchImpl, now });
      const { outcome, patch } = nextState(row, result, now());
      summary[outcome] += 1;
      await store.update(row.id, patch);
      if (outcome === "morto") store.alertDead(row, patch.last_error ?? "desconhecido");
    }
  }
  await Promise.all(Array.from({ length: cfg.concurrency ?? 5 }, () => worker()));
  return summary;
}

/** Armazenamento real: banco (service_role) + alerta no Sentry sem dado pessoal. */
export async function supabaseOutboxStore(): Promise<OutboxStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { untyped } = await import("@/lib/db-untyped");
  const { captureError } = await import("@/lib/sentry");
  const db = untyped(supabaseAdmin);
  return {
    async claim(limit) {
      const { data, error } = await db.rpc("hub_outbox_claim", { _limit: limit });
      if (error) throw new Error("hub_outbox_claim falhou");
      return (data ?? []) as OutboxRow[];
    },
    async update(id, patch) {
      const { error } = await db.from("hub_outbox").update(patch).eq("id", id);
      if (error) console.error("hub_outbox: falha ao gravar resultado");
    },
    alertDead(row, code) {
      const type = String(row.payload["type"] ?? "?");
      const revogacao = type === "consentimento_revogado";
      // Só tipo e código: sem e-mail, sem corpo.
      console.error("hub_outbox morto", { type, code, revogacao });
      captureError(new Error(`hub_outbox morto${revogacao ? " (REVOGAÇÃO DE CONSENTIMENTO)" : ""}: ${type} ${code}`));
    },
  };
}
