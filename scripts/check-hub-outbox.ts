// Verificação do outbox do hub (sem framework): npx tsx scripts/check-hub-outbox.ts
// Cobre: assinatura, política de nova tentativa, mapeamento de status HTTP, validação do envelope e o ciclo de envio.
// A montagem do envelope e a resolução de e-mail acontecem no banco: ver docs/operacao/teste-hub-outbox.sql.
import assert from "node:assert/strict";
import {
  MAX_ATTEMPTS,
  classifyStatus,
  envelopeProblem,
  nextState,
  retryDelayMs,
  runOutbox,
  sendOne,
  signBody,
  type OutboxPatch,
  type OutboxRow,
  type OutboxStore,
} from "../src/lib/hub-outbox.server";

const MIN = 60_000;

// --- assinatura: HMAC-SHA256 hex de "<timestamp>.<corpo>" (vetor calculado à parte)
assert.equal(
  signBody("s".repeat(32), "1760000000", '{"a":1}'),
  "22533f1df35d53de3919c078fd11815fff60222df18c98f2448a5fa796c55ba5",
);
assert.notEqual(signBody("s".repeat(32), "1760000001", '{"a":1}'), signBody("s".repeat(32), "1760000000", '{"a":1}'));
assert.notEqual(signBody("t".repeat(32), "1760000000", '{"a":1}'), signBody("s".repeat(32), "1760000000", '{"a":1}'));

// --- espera entre tentativas: 1 min, 5 min, 30 min, 2 h, 12 h (e fica em 12 h)
assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(retryDelayMs), [1 * MIN, 5 * MIN, 30 * MIN, 120 * MIN, 720 * MIN, 720 * MIN, 720 * MIN]);
assert.equal(MAX_ATTEMPTS, 8);

// --- status HTTP do hub
for (const s of [200, 202]) assert.equal(classifyStatus(s), "enviado", String(s));
for (const s of [400, 401, 404, 413, 422, 403, 405]) assert.equal(classifyStatus(s), "morto", String(s));
for (const s of [429, 500, 502, 503, 504]) assert.equal(classifyStatus(s), "retry", String(s));
assert.equal(classifyStatus(null), "retry"); // rede ou tempo esgotado

// --- envelope válido e recusas (as mesmas do contrato)
const good = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema_version: 1,
  event_id: "gcard:abc",
  type: "pedido_pago",
  occurred_at: "2026-10-17T14:03:22Z",
  source: "gcard",
  person: { email: "pessoa@exemplo.com" },
  data: { order_number: 112, total_cents: 12500, provider: "pagarme", kind: "revenda" },
  ...over,
});
assert.equal(envelopeProblem(good()), null);
assert.equal(envelopeProblem(good({ schema_version: 2 })), "schema_version");
assert.equal(envelopeProblem(good({ source: "toqy" })), "source");
assert.equal(envelopeProblem(good({ occurred_at: "2026-10-17T14:03:22" })), "occurred_at");
assert.equal(envelopeProblem(good({ person: {} })), "person_email");
assert.equal(envelopeProblem(good({ data: { cpf: "1" } })), "data_chave_proibida");
assert.equal(envelopeProblem(good({ data: { api_token: "x" } })), "data_chave_proibida");
assert.equal(envelopeProblem(good({ data: { x: "a".repeat(301) } })), "data_valor");
assert.equal(envelopeProblem(good({ data: { x: { y: 1 } } })), "data_valor");
assert.equal(envelopeProblem(good({ data: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i])) })), "data_chaves");

// --- próximo estado por item
const row = (over: Partial<OutboxRow> = {}): OutboxRow => ({ id: "1", event_id: "gcard:abc", payload: good(), attempts: 0, priority: 0, created_at: "2026-10-17T00:00:00Z", ...over });
const T0 = Date.parse("2026-10-17T12:00:00Z");

let s = nextState(row(), { status: 200, error: null }, T0);
assert.equal(s.outcome, "enviado");
assert.equal(s.patch.status, "enviado");
assert.equal(s.patch.attempts, 1);
assert.equal(s.patch.last_error, null);

s = nextState(row(), { status: 500, error: null }, T0);
assert.equal(s.outcome, "retry");
assert.equal(s.patch.status, "pendente");
assert.equal(s.patch.next_attempt_at, new Date(T0 + 1 * MIN).toISOString());
assert.equal(s.patch.last_error, "http_500"); // só o código, nunca e-mail

s = nextState(row({ attempts: 3 }), { status: null, error: "timeout" }, T0);
assert.equal(s.patch.next_attempt_at, new Date(T0 + 120 * MIN).toISOString()); // 4ª falha: 2 h
assert.equal(s.patch.last_error, "timeout");

s = nextState(row({ attempts: 7 }), { status: 503, error: null }, T0); // 8ª falha
assert.equal(s.outcome, "morto");
assert.equal(s.patch.status, "morto");

s = nextState(row(), { status: 401, error: null }, T0);
assert.equal(s.outcome, "morto");
assert.equal(s.patch.last_error, "http_401");

// --- ciclo completo com banco e rede de mentira
function fakeStore(rows: OutboxRow[]) {
  const patches = new Map<string, OutboxPatch>();
  const dead: string[] = [];
  const store: OutboxStore = {
    claim: async () => rows,
    update: async (id, patch) => void patches.set(id, patch),
    alertDead: (r, code) => void dead.push(`${r.id}:${code}`),
  };
  return { store, patches, dead };
}
const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
const hub = (status: number) => (async (url: string, init: RequestInit) => {
  seen.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
  return new Response("{}", { status });
}) as unknown as typeof fetch;
const cfg = { url: "https://hub.exemplo.com/api/ingest/gcard", secret: "s".repeat(32), now: () => T0 };

{
  const rows = [
    row({ id: "a", event_id: "gcard:a", payload: good({ event_id: "gcard:a" }), created_at: "2026-10-17T00:00:02Z" }),
    row({ id: "r", event_id: "gcard:r", payload: good({ event_id: "gcard:r", type: "consentimento_revogado" }), priority: 10, created_at: "2026-10-17T00:00:09Z" }),
    row({ id: "bad", event_id: "gcard:bad", payload: good({ event_id: "gcard:bad", data: { senha: "x" } }) }),
  ];
  const { store, patches, dead } = fakeStore(rows);
  const sum = await runOutbox(store, { ...cfg, fetchImpl: hub(200), concurrency: 1 });
  assert.deepEqual(sum, { claimed: 3, enviado: 2, morto: 0, retry: 0, invalid: 1 });
  assert.equal(patches.get("a")?.status, "enviado");
  assert.equal(patches.get("bad")?.status, "morto");
  assert.equal(patches.get("bad")?.last_error, "envelope_data_chave_proibida");
  assert.deepEqual(dead, ["bad:envelope_data_chave_proibida"]);
  // revogação (prioridade) sai antes do evento comum
  assert.equal(JSON.parse(seen[0]!.body).type, "consentimento_revogado");
  // cabeçalhos do contrato e corpo assinado byte a byte
  const first = seen[0]!;
  assert.equal(first.url, cfg.url);
  assert.equal(first.headers["x-hub-event-id"], "gcard:r");
  assert.equal(first.headers["x-hub-timestamp"], String(Math.floor(T0 / 1000)));
  assert.equal(first.headers["x-hub-signature"], signBody(cfg.secret, first.headers["x-hub-timestamp"]!, first.body));
}

{
  // hub fora do ar: item continua pendente com espera; depois da 8ª falha vira morto e alerta
  const { store, patches, dead } = fakeStore([row({ id: "x", attempts: 0 })]);
  const sum = await runOutbox(store, { ...cfg, fetchImpl: hub(503), concurrency: 1 });
  assert.equal(sum.retry, 1);
  assert.equal(patches.get("x")?.status, "pendente");
  assert.equal(dead.length, 0);

  const last = fakeStore([row({ id: "y", attempts: MAX_ATTEMPTS - 1 })]);
  await runOutbox(last.store, { ...cfg, fetchImpl: hub(503), concurrency: 1 });
  assert.equal(last.patches.get("y")?.status, "morto");
  assert.deepEqual(last.dead, ["y:http_503"]);
}

{
  // rede caiu: erro vira "rede", sem e-mail nem corpo no registro
  const boom = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  const r = await sendOne(row(), { ...cfg, fetchImpl: boom });
  assert.deepEqual(r, { status: null, error: "rede" });
  const timeout = (async () => {
    throw Object.assign(new Error("t"), { name: "TimeoutError" });
  }) as unknown as typeof fetch;
  assert.deepEqual(await sendOne(row(), { ...cfg, fetchImpl: timeout }), { status: null, error: "timeout" });
}

console.log("check-hub-outbox: ok");
