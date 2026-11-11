import { beforeEach, describe, expect, it, vi } from "vitest";

// Gravação de pagamento no pedido: webhook, retorno e reconciliação passam todos por aqui.
// O banco é falso e guarda as linhas em memória para o teste poder conferir o que foi gravado.

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  db: {} as Record<string, Row[]>,
  insertError: null as null | { code: string },
  emitted: [] as string[],
  emails: [] as { id: string; ev: string }[],
  commissions: [] as string[],
  emailThrows: false,
  commissionThrows: false,
}));

vi.mock("@/integrations/supabase/client.server", () => {
  const from = (table: string) => {
    let op: "select" | "update" = "select";
    let patch: Row = {};
    const filters: [string, unknown][] = [];
    const rows = () => (h.db[table] ??= []).filter((r) => filters.every(([k, v]) => r[k] === v));
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return b;
      },
      maybeSingle: async () => ({ data: rows()[0] ? { ...rows()[0] } : null }),
      update: (p: Row) => {
        op = "update";
        patch = p;
        return b;
      },
      insert: async (r: Row) => {
        if (h.insertError) return { error: h.insertError };
        (h.db[table] ??= []).push(r);
        return { error: null };
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (op === "update") rows().forEach((r) => Object.assign(r, patch));
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return b;
  };
  return { supabaseAdmin: { from } };
});
vi.mock("@/lib/plate/emit.server", () => ({
  emitPlatesForOrder: async (id: string) => void h.emitted.push(id),
}));
vi.mock("@/lib/email-events.server", () => ({
  dispatchOrderEmailEvent: async (id: string, ev: string) => {
    if (h.emailThrows) throw new Error("e-mail fora do ar");
    h.emails.push({ id, ev });
  },
}));
vi.mock("@/lib/affiliates.server", () => ({
  recordAffiliateCommission: async (id: string) => {
    if (h.commissionThrows) throw new Error("falha");
    h.commissions.push(id);
  },
}));

import { applyPaymentToOrder, recordSaleEntry } from "./settle.server";
import type { PaymentResult } from "./provider";

const pay = (over: Partial<PaymentResult> = {}) =>
  ({
    status: "pago",
    providerPaymentId: "pg_1",
    method: "pix",
    externalReference: "o1",
    ...over,
  }) as PaymentResult;
const pedido = (over: Row = {}): Row => ({
  id: "o1",
  order_number: 252,
  total_cents: 57900,
  payment_status: "pendente",
  paid_at: null,
  payment_provider: null,
  payment_method: null,
  ...over,
});
const order = () => h.db["orders"]![0]!;
const entries = () => h.db["finance_entries"] ?? [];

beforeEach(() => {
  h.db = { orders: [pedido()], finance_entries: [] };
  h.insertError = null;
  h.emitted = [];
  h.emails = [];
  h.commissions = [];
  h.emailThrows = false;
  h.commissionThrows = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("applyPaymentToOrder", () => {
  it("pedido que não existe não grava nada", async () => {
    expect(await applyPaymentToOrder("nao-existe", pay(), "pagarme")).toEqual({ found: false });
    expect(h.emitted).toEqual([]);
  });

  it("pagamento confirmado: grava o pedido, lança a venda, emite as placas e manda o e-mail", async () => {
    const r = await applyPaymentToOrder("o1", pay(), "infinitepay");
    expect(r).toEqual({ found: true, status: "pago", changed: true });
    expect(order()).toMatchObject({
      payment_status: "pago",
      payment_provider: "infinitepay",
      provider_payment_id: "pg_1",
      payment_method: "pix",
      external_reference: "o1",
    });
    expect(typeof order()["paid_at"]).toBe("string");
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({
      kind: "entrada",
      category: "Vendas",
      amount_cents: 57900,
      order_id: "o1",
    });
    expect(h.emitted).toEqual(["o1"]);
    expect(h.emails).toEqual([{ id: "o1", ev: "pagamento_confirmado" }]);
    expect(h.commissions).toEqual(["o1"]);
  });

  it("evento repetido não duplica venda, não muda a data do pagamento e não manda outro e-mail", async () => {
    await applyPaymentToOrder("o1", pay(), "infinitepay");
    const paidAt = order()["paid_at"];
    const r = await applyPaymentToOrder("o1", pay(), "infinitepay");
    expect(r).toMatchObject({ status: "pago", changed: false });
    expect(entries()).toHaveLength(1);
    expect(order()["paid_at"]).toBe(paidAt);
    expect(h.emails).toHaveLength(1);
  });

  it("evento atrasado (pendente/recusado) não rebaixa um pedido já pago", async () => {
    h.db["orders"] = [pedido({ payment_status: "pago", paid_at: "2026-11-10T12:00:00Z" })];
    for (const status of ["pendente", "recusado", "cancelado"] as const) {
      const r = await applyPaymentToOrder("o1", pay({ status } as never), "pagarme");
      expect(r).toEqual({ found: true, status: "pago", changed: false });
    }
    expect(order()["payment_status"]).toBe("pago");
    expect(order()["provider_payment_id"]).toBeUndefined();
  });

  it("estorno de pedido pago é gravado e não lança venda nova", async () => {
    h.db["orders"] = [pedido({ payment_status: "pago", paid_at: "2026-11-10T12:00:00Z" })];
    const r = await applyPaymentToOrder("o1", pay({ status: "estornado" } as never), "pagarme");
    expect(r).toMatchObject({ status: "estornado", changed: true });
    expect(order()["payment_status"]).toBe("estornado");
    expect(entries()).toHaveLength(0);
    expect(h.emitted).toEqual([]);
  });

  it("pagamento ainda pendente só atualiza o pedido: sem venda, placas ou e-mail", async () => {
    const r = await applyPaymentToOrder("o1", pay({ status: "pendente" } as never), "pagarme");
    expect(r).toMatchObject({ status: "pendente", changed: false });
    expect(order()["paid_at"]).toBeNull();
    expect(entries()).toHaveLength(0);
    expect(h.emitted).toEqual([]);
    expect(h.emails).toEqual([]);
  });

  it("pedido recusado que depois é pago passa a pago e dispara tudo", async () => {
    h.db["orders"] = [pedido({ payment_status: "recusado" })];
    expect(await applyPaymentToOrder("o1", pay(), "pagarme")).toMatchObject({
      status: "pago",
      changed: true,
    });
    expect(h.emitted).toEqual(["o1"]);
  });

  it("sem referência do provedor, usa o id do pedido; sem método, grava null", async () => {
    await applyPaymentToOrder(
      "o1",
      pay({ externalReference: undefined, method: undefined } as never),
      "pagarme",
    );
    expect(order()["external_reference"]).toBe("o1");
    expect(order()["payment_method"]).toBeNull();
  });

  it("falha ao mandar o e-mail não desfaz o pagamento", async () => {
    h.emailThrows = true;
    const r = await applyPaymentToOrder("o1", pay(), "pagarme");
    expect(r.status).toBe("pago");
    expect(order()["payment_status"]).toBe("pago");
    expect(h.emitted).toEqual(["o1"]);
  });

  it("pagamento já pago ainda reemite as placas (garante placas se a 1ª vez falhou no meio)", async () => {
    await applyPaymentToOrder("o1", pay(), "pagarme");
    await applyPaymentToOrder("o1", pay(), "pagarme");
    expect(h.emitted).toEqual(["o1", "o1"]);
  });
});

describe("recordSaleEntry", () => {
  it("pedido não pago não lança nada", async () => {
    expect(await recordSaleEntry("o1")).toEqual({ created: false });
    expect(entries()).toHaveLength(0);
    expect(h.commissions).toEqual([]);
  });
  it("usa a data de Brasília do pagamento (23h de Brasília ainda é o mesmo dia)", async () => {
    h.db["orders"] = [pedido({ payment_status: "pago", paid_at: "2026-11-11T02:30:00Z" })];
    await recordSaleEntry("o1");
    expect(entries()[0]!["entry_date"]).toBe("2026-11-10");
  });
  it("não lança duas vezes a mesma venda", async () => {
    h.db["orders"] = [pedido({ payment_status: "pago", paid_at: "2026-11-11T15:00:00Z" })];
    expect(await recordSaleEntry("o1")).toEqual({ created: true });
    expect(await recordSaleEntry("o1")).toEqual({ created: false });
    expect(entries().filter((e) => e["kind"] === "entrada")).toHaveLength(1);
  });
  it("conflito do índice único (outra chamada lançou primeiro) não é erro", async () => {
    h.db["orders"] = [pedido({ payment_status: "pago", paid_at: "2026-11-11T15:00:00Z" })];
    h.insertError = { code: "23505" };
    expect(await recordSaleEntry("o1")).toEqual({ created: false });
  });
  it("outro erro do banco sobe para quem chamou", async () => {
    h.db["orders"] = [pedido({ payment_status: "pago", paid_at: "2026-11-11T15:00:00Z" })];
    h.insertError = { code: "XX000" };
    await expect(recordSaleEntry("o1")).rejects.toMatchObject({ code: "XX000" });
  });
  it("Stone Pix: lança saída de 0,99% (arredondada para baixo)", async () => {
    h.db["orders"] = [
      pedido({
        payment_status: "pago",
        paid_at: "2026-11-11T15:00:00Z",
        payment_provider: "pagarme",
        payment_method: "pix",
        total_cents: 57900,
      }),
    ];
    await recordSaleEntry("o1");
    const taxa = entries().find((e) => e["kind"] === "saida")!;
    expect(taxa).toMatchObject({
      category: "Taxas Stone",
      amount_cents: Math.floor(57900 * 0.0099),
    });
    expect(taxa["description"]).toContain("Pix");
  });
  it("Stone cartão: 4,04%; outros provedores e métodos não têm taxa", async () => {
    h.db["orders"] = [
      pedido({
        payment_status: "pago",
        paid_at: "2026-11-11T15:00:00Z",
        payment_provider: "pagarme",
        payment_method: "credit_card",
        total_cents: 10000,
      }),
    ];
    await recordSaleEntry("o1");
    expect(entries().find((e) => e["kind"] === "saida")).toMatchObject({ amount_cents: 404 });

    h.db = {
      orders: [
        pedido({
          payment_status: "pago",
          paid_at: "2026-11-11T15:00:00Z",
          payment_provider: "infinitepay",
          payment_method: "pix",
        }),
      ],
      finance_entries: [],
    };
    await recordSaleEntry("o1");
    expect(entries().filter((e) => e["kind"] === "saida")).toHaveLength(0);
  });
  it("falha na comissão do parceiro não impede a venda", async () => {
    h.commissionThrows = true;
    h.db["orders"] = [pedido({ payment_status: "pago", paid_at: "2026-11-11T15:00:00Z" })];
    expect(await recordSaleEntry("o1")).toEqual({ created: true });
  });
});
