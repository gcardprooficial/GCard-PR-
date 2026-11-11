import { beforeEach, describe, expect, it, vi } from "vitest";

// /r/<token>: o redirecionamento de cada placa impressa. Aqui o banco é falso e controlado por teste.
// Fica em src/lib (e não em src/routes) para o roteador de arquivos não tratar este arquivo como uma página.

type Table = { single?: unknown; list?: unknown[]; throws?: boolean };
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Table>,
  rpc: [] as { fn: string; args: Record<string, unknown> }[],
  rpcThrows: false,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const t = () => state.tables[table] ?? {};
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        limit: () => b,
        maybeSingle: async () => {
          if (t().throws) throw new Error("banco fora do ar");
          return { data: t().single ?? null };
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          if (t().throws)
            return Promise.reject(new Error("banco fora do ar")).then(resolve, reject);
          return Promise.resolve({ data: t().list ?? [] }).then(resolve, reject);
        },
      };
      return b;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (state.rpcThrows) throw new Error("rpc falhou");
      state.rpc.push({ fn, args });
      return { data: null, error: null };
    },
  },
}));

import { Route } from "./../routes/r.$token";

type Handler = (ctx: { params: { token: string }; request: Request }) => Promise<Response>;
const GET = (Route as unknown as { options: { server: { handlers: { GET: Handler } } } }).options
  .server.handlers.GET;

let ip = 0;
const CHROME =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";
function ler(
  token: string,
  opts: { query?: string; ua?: string; ip?: string; headers?: Record<string, string> } = {},
) {
  const headers = {
    "user-agent": opts.ua ?? CHROME,
    "x-real-ip": opts.ip ?? `10.0.0.${++ip}`,
    ...opts.headers,
  };
  return GET({
    params: { token },
    request: new Request(`https://www.gcardpro.com.br/r/${token}${opts.query ?? ""}`, { headers }),
  });
}
const placa = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  status: "ativada",
  destination_url: "https://g.page/r/abc/review",
  business_id: null,
  short_code: "GCARD-00252",
  batch_id: null,
  ...over,
});
const HOSTS = [
  { host: "g.page", include_subdomains: false },
  { host: "toqy.com.br", include_subdomains: true },
];

beforeEach(() => {
  state.tables = { plates: { single: placa() }, allowed_destination_hosts: { list: HOSTS } };
  state.rpc = [];
  state.rpcThrows = false;
});

describe("token", () => {
  it("recusa formato inválido sem consultar o banco", async () => {
    for (const bad of ["ab", "com espaço", "a".repeat(65), "x/../y", "<script>"]) {
      const r = await ler(bad);
      expect(r.status, bad).toBe(400);
    }
    expect(state.rpc).toHaveLength(0);
  });
  it("placa que não existe dá 404", async () => {
    state.tables["plates"] = { single: null as never };
    expect((await ler("naoexiste")).status).toBe(404);
  });
  it("limita leituras repetidas do mesmo aparelho (429)", async () => {
    const fixo = "203.0.113.9";
    let ultimo = 0;
    for (let i = 0; i < 61; i++) ultimo = (await ler("TOKEN1", { ip: fixo })).status;
    expect(ultimo).toBe(429);
  });
});

describe("placa bloqueada ou não ativada", () => {
  it("bloqueada mostra 'desativado' (410) e nunca redireciona", async () => {
    state.tables["plates"] = { single: placa({ status: "bloqueada" }) };
    const r = await ler("TOKENB");
    expect(r.status).toBe(410);
    expect(r.headers.get("location")).toBeNull();
    expect(await r.text()).toContain("GCARD-00252");
  });
  it("não ativada ou sem destino mostra a página de espera e não redireciona", async () => {
    for (const p of [placa({ status: "livre" }), placa({ destination_url: null })]) {
      state.tables["plates"] = { single: p };
      const r = await ler("TOKENC");
      expect(r.status).toBe(200);
      expect(r.headers.get("location")).toBeNull();
      expect(await r.text()).toContain("ainda não");
    }
  });
});

describe("redirecionamento", () => {
  it("responde 302 sem cache, sem indexar, para o destino atual", async () => {
    const r = await ler("TOKEND");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://g.page/r/abc/review");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
  });
  it("mudar o destino no banco vale na hora", async () => {
    expect((await ler("TOKENE")).headers.get("location")).toBe("https://g.page/r/abc/review");
    state.tables["plates"] = { single: placa({ destination_url: "https://toqy.com.br/b/loja" }) };
    expect((await ler("TOKENE")).headers.get("location")).toBe("https://toqy.com.br/b/loja");
  });
  it("mantém a query do destino e nunca repassa o ?s= da leitura", async () => {
    state.tables["plates"] = {
      single: placa({ destination_url: "https://g.page/r/abc/review?x=1" }),
    };
    const loc = (await ler("TOKENF", { query: "?s=n&utm=algo" })).headers.get("location")!;
    expect(loc).toBe("https://g.page/r/abc/review?x=1");
    expect(loc).not.toContain("s=n");
  });
  it("sem destino na placa usa o link de avaliação do negócio", async () => {
    state.tables["plates"] = { single: placa({ destination_url: null, business_id: "b1" }) };
    state.tables["businesses"] = { single: { review_url: "https://g.page/r/negocio/review" } };
    expect((await ler("TOKENG")).headers.get("location")).toBe("https://g.page/r/negocio/review");
  });
});

describe("destino perigoso ou não liberado", () => {
  it("host fora da lista é recusado na leitura, mesmo já gravado na placa", async () => {
    state.tables["plates"] = {
      single: placa({ destination_url: "https://site-nao-liberado.com/x" }),
    };
    const r = await ler("TOKENH");
    expect(r.status).toBe(400);
    expect(r.headers.get("location")).toBeNull();
  });
  it("endereço exato liberado por pedido aprovado passa", async () => {
    const url = "https://site-nao-liberado.com/x";
    state.tables["plates"] = { single: placa({ destination_url: url }) };
    state.tables["allowed_destination_urls"] = { list: [{ url }] };
    expect((await ler("TOKENI")).status).toBe(302);
  });
  it("http, porta, usuário e IP são recusados", async () => {
    for (const bad of [
      "http://g.page/x",
      "https://g.page:8443/x",
      "https://user:senha@g.page/x",
      "https://10.0.0.1/x",
      "https://localhost/x",
    ]) {
      state.tables["plates"] = { single: placa({ destination_url: bad }) };
      const r = await ler("TOKENJ");
      expect(r.status, bad).toBe(400);
      expect(r.headers.get("location"), bad).toBeNull();
    }
  });
  it("texto que não é URL dá erro 500 amigável", async () => {
    state.tables["plates"] = { single: placa({ destination_url: "isto não é url" }) };
    expect((await ler("TOKENK")).status).toBe(500);
  });
  it("tabela de hosts vazia volta ao plano B (só Google) em vez de abrir tudo", async () => {
    state.tables["allowed_destination_hosts"] = { list: [] };
    state.tables["plates"] = {
      single: placa({ destination_url: "https://www.google.com/maps/place/x" }),
    };
    expect((await ler("TOKENL")).status).toBe(302);
    state.tables["plates"] = { single: placa({ destination_url: "https://instagram.com/loja" }) };
    expect((await ler("TOKENL")).status).toBe(400);
  });
});

describe("registro da leitura", () => {
  it("separa NFC e QR, e ignora qualquer outro valor", async () => {
    await ler("TOKENM", { query: "?s=n" });
    await ler("TOKENM", { query: "?s=q" });
    await ler("TOKENM", { query: "?s=hack" });
    await ler("TOKENM");
    expect(state.rpc.map((c) => c.args["_source"])).toEqual(["n", "q", null, null]);
    expect(state.rpc.every((c) => c.fn === "plate_register_scan")).toBe(true);
  });
  it("robô e pré-visualização são marcados, mas o redirecionamento continua", async () => {
    const r = await ler("TOKENN", { ua: "WhatsApp/2.24.1 A" });
    expect(r.status).toBe(302);
    expect(state.rpc[0]!.args["_is_bot"]).toBe(true);
    const gente = await ler("TOKENN");
    expect(gente.status).toBe(302);
    expect(state.rpc[1]!.args["_is_bot"]).toBe(false);
  });
  it("não grava IP nem User-Agent: só um hash", async () => {
    await ler("TOKENO", { ip: "198.51.100.77" });
    const args = state.rpc[0]!.args;
    expect(JSON.stringify(args)).not.toContain("198.51.100.77");
    expect(JSON.stringify(args)).not.toContain("Chrome");
    expect(String(args["_visitor_hash"])).toMatch(/^[0-9a-f]{24}$/);
    expect(args["_device"]).toBe("mobile");
  });
  it("se registrar a leitura falhar, o cliente é redirecionado do mesmo jeito", async () => {
    state.rpcThrows = true;
    expect((await ler("TOKENP")).status).toBe(302);
  });
});

describe("regras de horário do Plus", () => {
  const regraSempre = {
    id: "r1",
    label: null,
    destination_url: "https://g.page/r/regra",
    days: null,
    start_time: null,
    end_time: null,
    valid_from: null,
    valid_until: null,
    enabled: true,
    position: 0,
  };
  beforeEach(() => {
    state.tables["plates"] = { single: placa({ batch_id: "bt1" }) };
    state.tables["plate_rules"] = { list: [regraSempre] };
    state.tables["batches"] = { single: { owner_email: "Dono@Exemplo.com" } };
  });
  it("com assinatura do Plus ativa, a regra que vale agora manda", async () => {
    state.tables["plus_subscriptions"] = { list: [{ id: "s1" }] };
    expect((await ler("TOKENQ")).headers.get("location")).toBe("https://g.page/r/regra");
  });
  it("sem assinatura, o destino normal segue (a regra não vale)", async () => {
    state.tables["plus_subscriptions"] = { list: [] };
    expect((await ler("TOKENR")).headers.get("location")).toBe("https://g.page/r/abc/review");
  });
  it("se falhar ao ler as regras, cai no destino normal e redireciona", async () => {
    state.tables["plate_rules"] = { throws: true };
    state.tables["plus_subscriptions"] = { list: [{ id: "s1" }] };
    const r = await ler("TOKENS");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://g.page/r/abc/review");
  });
  it("a regra também passa pela lista de hosts permitidos", async () => {
    state.tables["plate_rules"] = {
      list: [{ ...regraSempre, destination_url: "https://site-nao-liberado.com/x" }],
    };
    state.tables["plus_subscriptions"] = { list: [{ id: "s1" }] };
    expect((await ler("TOKENT")).status).toBe(400);
  });
});
