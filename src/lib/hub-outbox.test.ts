import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
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
} from "./hub-outbox.server";
import { generatePlateToken } from "./plate/tokens";

// Envio de eventos do GCard para o Hub (contrato v1): assinatura, validação, tentativas e fila.

const payload = (over: Record<string, unknown> = {}) => ({
  schema_version: 1,
  event_id: "ev-1",
  type: "pedido_pago",
  source: "gcard",
  occurred_at: "2026-11-11T12:00:00Z",
  person: { email: "ana@exemplo.com" },
  data: { valor_centavos: 5790, pago: true, obs: null },
  ...over,
});
const row = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "r1",
  event_id: "ev-1",
  payload: payload(),
  attempts: 0,
  priority: 0,
  created_at: "2026-11-11T12:00:00Z",
  ...over,
});

describe("classifyStatus", () => {
  it("2xx foi entregue (200 aceito/duplicado, 202 guardado)", () => {
    for (const s of [200, 201, 202, 204]) expect(classifyStatus(s), String(s)).toBe("enviado");
  });
  it("rede, 429 e 5xx tentam de novo", () => {
    for (const s of [null, 429, 500, 502, 503]) expect(classifyStatus(s), String(s)).toBe("retry");
  });
  it("demais 3xx/4xx são definitivos", () => {
    for (const s of [301, 400, 401, 404, 413, 422])
      expect(classifyStatus(s), String(s)).toBe("morto");
  });
});

describe("retryDelayMs", () => {
  it("1 min, 5, 30 min, 2 h e 12 h depois disso", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(retryDelayMs)).toEqual(
      [1, 5, 30, 120, 720, 720, 720].map((m) => m * 60_000),
    );
  });
  it("valor menor que 1 conta como a 1ª falha", () => {
    expect(retryDelayMs(0)).toBe(60_000);
  });
});

describe("signBody", () => {
  it("é HMAC-SHA256 de 'timestamp.corpo' em hexadecimal", () => {
    const esperado = createHmac("sha256", "segredo").update("1700000000.{}").digest("hex");
    expect(signBody("segredo", "1700000000", "{}")).toBe(esperado);
  });
  it("muda com o segredo, o horário ou o corpo", () => {
    const base = signBody("a", "1", "x");
    expect(signBody("b", "1", "x")).not.toBe(base);
    expect(signBody("a", "2", "x")).not.toBe(base);
    expect(signBody("a", "1", "y")).not.toBe(base);
  });
});

describe("envelopeProblem", () => {
  it("evento correto não tem problema", () => {
    expect(envelopeProblem(payload())).toBeNull();
  });
  it("aponta o campo errado", () => {
    expect(envelopeProblem(payload({ schema_version: 2 }))).toBe("schema_version");
    expect(envelopeProblem(payload({ event_id: "" }))).toBe("event_id");
    expect(envelopeProblem(payload({ type: undefined }))).toBe("type");
    expect(envelopeProblem(payload({ source: "toqy" }))).toBe("source");
    expect(envelopeProblem(payload({ occurred_at: "2026-11-11T12:00:00-03:00" }))).toBe(
      "occurred_at",
    );
    expect(envelopeProblem(payload({ person: { email: "sem-arroba" } }))).toBe("person_email");
    expect(envelopeProblem(payload({ person: undefined }))).toBe("person_email");
  });
  it("recusa dado sensível e valores grandes ou aninhados", () => {
    for (const k of ["cpf", "CNPJ", "senha", "password", "api_token", "client_secret"]) {
      expect(envelopeProblem(payload({ data: { [k]: "x" } })), k).toBe("data_chave_proibida");
    }
    expect(envelopeProblem(payload({ data: { a: "x".repeat(301) } }))).toBe("data_valor");
    expect(envelopeProblem(payload({ data: { a: { b: 1 } } }))).toBe("data_valor");
    expect(envelopeProblem(payload({ data: { a: [1] } }))).toBe("data_valor");
  });
  it("aceita 20 chaves e recusa 21", () => {
    const n = (q: number) => Object.fromEntries(Array.from({ length: q }, (_, i) => [`k${i}`, i]));
    expect(envelopeProblem(payload({ data: n(20) }))).toBeNull();
    expect(envelopeProblem(payload({ data: n(21) }))).toBe("data_chaves");
  });
});

describe("sendOne", () => {
  const NOW = 1_700_000_000_000;
  it("envia o corpo exato, assinado, com os cabeçalhos do contrato", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const r = row();
    const res = await sendOne(r, {
      url: "https://hub.exemplo/ingest",
      secret: "s",
      fetchImpl: fetchImpl as never,
      now: () => NOW,
    });
    expect(res).toEqual({ status: 200, error: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe("https://hub.exemplo/ingest");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(r.payload));
    expect(init.headers["x-hub-timestamp"]).toBe("1700000000");
    expect(init.headers["x-hub-event-id"]).toBe("ev-1");
    expect(init.headers["x-hub-signature"]).toBe(signBody("s", "1700000000", init.body as string));
  });
  it("rede caída e tempo esgotado viram status null com o motivo", async () => {
    const cai = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await sendOne(row(), { url: "u", secret: "s", fetchImpl: cai as never })).toEqual({
      status: null,
      error: "rede",
    });
    const lento = vi.fn(async () => {
      throw new DOMException("t", "TimeoutError");
    });
    expect(await sendOne(row(), { url: "u", secret: "s", fetchImpl: lento as never })).toEqual({
      status: null,
      error: "timeout",
    });
  });
});

describe("nextState", () => {
  const NOW = Date.parse("2026-11-11T12:00:00Z");
  it("2xx marca enviado e limpa o erro", () => {
    const { outcome, patch } = nextState(row({ attempts: 2 }), { status: 200, error: null }, NOW);
    expect(outcome).toBe("enviado");
    expect(patch).toEqual({
      status: "enviado",
      attempts: 3,
      last_error: null,
      sent_at: "2026-11-11T12:00:00.000Z",
    });
  });
  it("falha temporária volta para pendente e agenda a próxima tentativa", () => {
    const { outcome, patch } = nextState(row({ attempts: 0 }), { status: 503, error: null }, NOW);
    expect(outcome).toBe("retry");
    expect(patch).toMatchObject({
      status: "pendente",
      attempts: 1,
      last_error: "http_503",
      next_attempt_at: "2026-11-11T12:01:00.000Z",
    });
    expect(
      nextState(row({ attempts: 2 }), { status: null, error: "timeout" }, NOW).patch,
    ).toMatchObject({
      last_error: "timeout",
      next_attempt_at: "2026-11-11T12:30:00.000Z",
    });
  });
  it("4xx é definitivo na primeira vez", () => {
    const { outcome, patch } = nextState(row(), { status: 401, error: null }, NOW);
    expect(outcome).toBe("morto");
    expect(patch).toEqual({ status: "morto", attempts: 1, last_error: "http_401" });
  });
  it("esgotadas as tentativas, vira morto mesmo sendo falha temporária", () => {
    expect(
      nextState(row({ attempts: MAX_ATTEMPTS - 2 }), { status: 500, error: null }, NOW).outcome,
    ).toBe("retry");
    expect(
      nextState(row({ attempts: MAX_ATTEMPTS - 1 }), { status: 500, error: null }, NOW).outcome,
    ).toBe("morto");
  });
});

describe("runOutbox", () => {
  function fakeStore(rows: OutboxRow[]) {
    const updates: { id: string; patch: OutboxPatch }[] = [];
    const dead: { id: string; code: string }[] = [];
    const store: OutboxStore = {
      claim: async () => rows,
      update: async (id, patch) => void updates.push({ id, patch }),
      alertDead: (r, code) => void dead.push({ id: r.id, code }),
    };
    return { store, updates, dead };
  }
  const ok = () => vi.fn(async () => new Response(null, { status: 200 }));

  it("envia os mais prioritários primeiro e, em empate, os mais antigos", async () => {
    const vistos: string[] = [];
    const fetchImpl = vi.fn(async (_u: unknown, init: RequestInit) => {
      vistos.push(String((init.headers as Record<string, string>)["x-hub-event-id"]));
      return new Response(null, { status: 200 });
    });
    const { store } = fakeStore([
      row({
        id: "a",
        payload: payload({ event_id: "A" }),
        priority: 0,
        created_at: "2026-11-11T10:00:00Z",
      }),
      row({
        id: "b",
        payload: payload({ event_id: "B" }),
        priority: 5,
        created_at: "2026-11-11T11:00:00Z",
      }),
      row({
        id: "c",
        payload: payload({ event_id: "C" }),
        priority: 0,
        created_at: "2026-11-11T09:00:00Z",
      }),
    ]);
    await runOutbox(store, {
      url: "u",
      secret: "s",
      fetchImpl: fetchImpl as never,
      concurrency: 1,
    });
    expect(vistos).toEqual(["B", "C", "A"]);
  });
  it("conta enviados, tentativas futuras e mortos, e avisa só dos mortos", async () => {
    const respostas = [200, 503, 400];
    let i = 0;
    const fetchImpl = vi.fn(async () => new Response(null, { status: respostas[i++]! }));
    const { store, updates, dead } = fakeStore([
      row({ id: "1", created_at: "1" }),
      row({ id: "2", created_at: "2" }),
      row({ id: "3", created_at: "3" }),
    ]);
    const s = await runOutbox(store, {
      url: "u",
      secret: "s",
      fetchImpl: fetchImpl as never,
      concurrency: 1,
    });
    expect(s).toEqual({ claimed: 3, enviado: 1, morto: 1, retry: 1, invalid: 0 });
    expect(updates.map((u) => u.patch.status)).toEqual(["enviado", "pendente", "morto"]);
    expect(dead).toEqual([{ id: "3", code: "http_400" }]);
  });
  it("evento inválido nunca sai: vira morto com o motivo, sem chamar o Hub", async () => {
    const fetchImpl = ok();
    const { store, updates, dead } = fakeStore([
      row({ payload: payload({ data: { cpf: "123" } }) }),
    ]);
    const s = await runOutbox(store, { url: "u", secret: "s", fetchImpl: fetchImpl as never });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(s.invalid).toBe(1);
    expect(updates[0]!.patch).toMatchObject({
      status: "morto",
      last_error: "envelope_data_chave_proibida",
    });
    expect(dead[0]!.code).toBe("envelope_data_chave_proibida");
  });
  it("para ao estourar o orçamento de tempo, deixando o resto para a próxima rodada", async () => {
    let t = 0;
    const fetchImpl = ok();
    const { store, updates } = fakeStore([row({ id: "1" }), row({ id: "2" }), row({ id: "3" })]);
    const s = await runOutbox(store, {
      url: "u",
      secret: "s",
      fetchImpl: fetchImpl as never,
      concurrency: 1,
      budgetMs: 1000,
      now: () => (t += 600),
    });
    expect(updates.length).toBeLessThan(3);
    expect(s.claimed).toBe(3);
  });
});

describe("generatePlateToken", () => {
  it("tem o tamanho pedido (12 por padrão) e passa na regra do /r/<token>", () => {
    expect(generatePlateToken()).toHaveLength(12);
    expect(generatePlateToken(32)).toHaveLength(32);
    for (let i = 0; i < 200; i++) expect(generatePlateToken()).toMatch(/^[A-Za-z0-9_-]{4,64}$/);
  });
  it("não usa letras parecidas (0, O, 1, I, l)", () => {
    const tudo = Array.from({ length: 300 }, () => generatePlateToken(20)).join("");
    expect(tudo).not.toMatch(/[01OIl]/);
  });
  it("não repete em amostra grande", () => {
    const set = new Set(Array.from({ length: 5000 }, () => generatePlateToken()));
    expect(set.size).toBe(5000);
  });
});
