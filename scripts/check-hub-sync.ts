// Verificação da carga diária para o hub (sem framework): npx tsx scripts/check-hub-sync.ts
// Cobre: mapeamento das colunas, lotes de 300, assinatura, respostas do hub (200/401/413/422/429/5xx) e campos proibidos.
import assert from "node:assert/strict";
import {
  SYNC_BATCH,
  chunk,
  classifySyncStatus,
  runSync,
  syncUrl,
  testRecords,
  toRecord,
  withLock,
  type LockStore,
  type PersonRow,
  type SyncRecord,
} from "../src/lib/hub-sync.server";
import { signBody } from "../src/lib/hub-outbox.server";

const person = (over: Partial<PersonRow> = {}): PersonRow => ({
  email: "  Pessoa@Exemplo.com ",
  name: " Maria ",
  phone: "(19) 99705-1919",
  first_source: "youtube",
  first_seen: "2026-10-01T10:00:00Z",
  orders_count: "3", // bigint do banco chega como texto
  paid_orders: 2,
  paid_total_cents: 12550,
  last_paid_at: "2026-10-10T12:00:00Z",
  plates_activated: 1,
  has_account: true,
  email_confirmed: false,
  marketing_consent_at: null,
  marketing_unsubscribed_at: "2026-10-12T00:00:00Z",
  ...over,
});

// --- mapeamento: mesmos nomes das exportações, e-mail minúsculo, total em reais, celular só dígitos
const r = toRecord(person())!;
assert.deepEqual(r, {
  email: "pessoa@exemplo.com",
  nome: "Maria",
  celular: "19997051919",
  origem: "youtube",
  primeiro_contato: "2026-10-01T10:00:00Z",
  pedidos: 3,
  pedidos_pagos: 2,
  total_pago_reais: 125.5,
  ultimo_pagamento: "2026-10-10T12:00:00Z",
  codigos_ativados: 1,
  tem_conta: true,
  email_confirmado: false,
  aceite_em: null,
  descadastrado_em: "2026-10-12T00:00:00Z",
});
// vazio vira null; sem e-mail não vai
assert.equal(toRecord(person({ name: null, phone: "", first_source: null, last_paid_at: null }))!.nome, null);
assert.equal(toRecord(person({ phone: "" }))!.celular, null);
assert.equal(toRecord(person({ email: "" })), null);
assert.equal(toRecord(person({ email: "sem-arroba" })), null);

// --- nada de CPF/CNPJ/senha/token/endereço/pagamento nas chaves enviadas
const FORBIDDEN = /cpf|cnpj|senha|password|token|secret|endereco|address|cartao|card/i;
for (const rec of [...testRecords(), r]) {
  for (const k of Object.keys(rec)) assert.ok(!FORBIDDEN.test(k), `chave proibida: ${k}`);
}

// --- lotes de no máximo 300
assert.equal(SYNC_BATCH, 300);
const many = Array.from({ length: 650 }, (_, i) => toRecord(person({ email: `p${i}@exemplo.com` }))!);
assert.deepEqual(chunk(many).map((b) => b.length), [300, 300, 50]);
assert.deepEqual(chunk([]), []);

// --- endereço derivado do mesmo HUB_INGEST_URL do outbox
assert.equal(syncUrl("https://hub.leonardomarusso.com.br/api/ingest/gcard"), "https://hub.leonardomarusso.com.br/api/sync/gcard");

// --- resposta do hub
assert.equal(classifySyncStatus(200), "aplicado");
assert.equal(classifySyncStatus(429), "esperar");
for (const s of [401, 413, 422, 400, 404]) assert.equal(classifySyncStatus(s), "parar", String(s));
for (const s of [500, 502, 503]) assert.equal(classifySyncStatus(s), "proxima_execucao", String(s));
assert.equal(classifySyncStatus(null), "proxima_execucao");

// --- execução com hub de mentira
type Call = { url: string; headers: Record<string, string>; body: string };
function hub(statuses: number[], linhasPorLote = true) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
    const status = statuses[Math.min(i++, statuses.length - 1)]!;
    const n = (JSON.parse(String(init.body)).records as unknown[]).length;
    return new Response(JSON.stringify(status === 200 ? { ok: true, ...(linhasPorLote ? { linhas: n } : {}) } : { ok: false }), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const cfg = { url: "https://hub.exemplo.com/api/sync/gcard", secret: "s".repeat(32), now: () => Date.parse("2026-10-18T12:00:00Z"), sleep: async () => {} };

{
  // 650 registros → 3 lotes, todos aplicados; corpo { records: [...] } assinado byte a byte
  const { fetchImpl, calls } = hub([200]);
  const s = await runSync(many, { ...cfg, fetchImpl });
  assert.deepEqual(s, { registros: 650, lotes: 3, aplicados: 3, linhas: 650, parou: null });
  assert.equal(calls.length, 3);
  const first = calls[0]!;
  assert.deepEqual(Object.keys(JSON.parse(first.body)), ["records"]);
  assert.equal(JSON.parse(first.body).records.length, 300);
  assert.equal(first.headers["x-hub-timestamp"], String(Math.floor(cfg.now() / 1000)));
  assert.equal(first.headers["x-hub-signature"], signBody(cfg.secret, first.headers["x-hub-timestamp"]!, first.body));
}
{
  // dois registros de teste → ok e linhas = 2
  const { fetchImpl } = hub([200]);
  const s = await runSync(testRecords() as SyncRecord[], { ...cfg, fetchImpl });
  assert.deepEqual(s, { registros: 2, lotes: 1, aplicados: 1, linhas: 2, parou: null });
}
{
  // 429: espera e tenta o MESMO lote de novo; depois segue
  const sleeps: number[] = [];
  const { fetchImpl, calls } = hub([429, 200]);
  const s = await runSync(testRecords(), { ...cfg, fetchImpl, sleep: async (ms) => void sleeps.push(ms) });
  assert.equal(s.parou, null);
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [5_000]);
  assert.equal(calls[0]!.body, calls[1]!.body);
}
{
  // 429 sem parar: desiste depois de 2 esperas, sem laço infinito
  const { fetchImpl, calls } = hub([429]);
  const s = await runSync(testRecords(), { ...cfg, fetchImpl });
  assert.equal(s.parou, "http_429");
  assert.equal(calls.length, 3);
}
for (const [status, parou] of [[401, "http_401"], [413, "http_413"], [422, "http_422"], [503, "http_503"]] as const) {
  // erro permanente ou do hub: para a execução no primeiro lote (não repete, não segue)
  const { fetchImpl, calls } = hub([status]);
  const s = await runSync(many, { ...cfg, fetchImpl });
  assert.equal(s.parou, parou);
  assert.equal(calls.length, 1, `${status}: um envio só`);
  assert.equal(s.aplicados, 0);
}
{
  // rede caiu
  const boom = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  const s = await runSync(testRecords(), { ...cfg, fetchImpl: boom });
  assert.equal(s.parou, "rede");
}

// --- trava contra duas cargas ao mesmo tempo
{
  let held = false;
  let releases = 0;
  const store: LockStore = {
    acquire: async () => (held ? false : ((held = true), true)),
    release: async () => void ((held = false), releases++),
  };
  let inside = 0;
  let maxInside = 0;
  const work = async () => {
    inside++;
    maxInside = Math.max(maxInside, inside);
    await new Promise((r) => setTimeout(r, 20));
    inside--;
    return "feito";
  };
  // duplo clique: duas chamadas quase juntas → só uma roda
  const [a, b] = await Promise.all([withLock(store, 1000, work), withLock(store, 1000, work)]);
  assert.equal([a, b].filter((x) => x.ran).length, 1);
  assert.equal([a, b].filter((x) => !x.ran).length, 1);
  assert.equal(maxInside, 1);
  assert.equal(held, false, "trava liberada no fim");
  // depois de liberar, roda de novo
  assert.equal((await withLock(store, 1000, work)).ran, true);
  // erro dentro: a trava é liberada mesmo assim
  await assert.rejects(withLock(store, 1000, async () => { throw new Error("falhou"); }));
  assert.equal(held, false);
  assert.ok(releases >= 3);
}

console.log("check-hub-sync: ok");
