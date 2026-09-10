import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  PLATE_BATCH_TRANSITIONS,
  PLATE_ORDER_TRANSITIONS,
  PLATE_UNIT_TRANSITIONS,
} from "./stateMachine";
import { newActivationCode, newPublicToken, normalizeActivationCode, platePublicUrl } from "./tokens";

describe("plate state machine", () => {
  it("no-op (from === to) sempre permitido", () => {
    expect(canTransition("order", "paid", "paid")).toBe(true);
  });

  it("transições válidas do pedido", () => {
    expect(canTransition("order", "draft", "pending_payment")).toBe(true);
    expect(canTransition("order", "pending_payment", "paid")).toBe(true);
    expect(canTransition("order", "shipped", "delivered")).toBe(true);
  });

  it("transições inválidas do pedido são rejeitadas", () => {
    expect(canTransition("order", "draft", "shipped")).toBe(false);
    expect(canTransition("order", "completed", "paid")).toBe(false);
    expect(canTransition("order", "refunded", "paid")).toBe(false);
  });

  it("unidade: revenda vai available_for_activation -> activated", () => {
    expect(canTransition("unit", "available_for_activation", "activated")).toBe(true);
  });

  it("unidade: não dá pra reativar uma cancelada", () => {
    expect(canTransition("unit", "cancelled", "activated")).toBe(false);
  });

  it("unidade: bloqueada volta pra available_for_activation (fluxo admin)", () => {
    expect(canTransition("unit", "blocked", "available_for_activation")).toBe(true);
    expect(canTransition("unit", "activated", "blocked")).toBe(false);
  });

  it("assertTransition lança em transição inválida", () => {
    expect(() => assertTransition("batch", "delivered", "reserved")).toThrow(/transição inválida/);
    expect(() => assertTransition("batch", "reserved", "manufacturing")).not.toThrow();
  });

  it("estados finais não têm saída", () => {
    for (const table of [PLATE_ORDER_TRANSITIONS, PLATE_UNIT_TRANSITIONS, PLATE_BATCH_TRANSITIONS]) {
      expect(table.cancelled).toEqual([]);
    }
    expect(PLATE_ORDER_TRANSITIONS.completed).toEqual([]);
    expect(PLATE_UNIT_TRANSITIONS.cancelled).toEqual([]);
    expect(PLATE_BATCH_TRANSITIONS.delivered).toEqual([]);
  });
});

describe("plate tokens", () => {
  it("token público: 20 chars do alfabeto seguro", () => {
    const t = newPublicToken();
    expect(t).toHaveLength(20);
    expect(t).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
  });

  it("código de ativação: 8 chars, sem 0/O/1/I/L", () => {
    const c = newActivationCode();
    expect(c).toHaveLength(8);
    expect(c).not.toMatch(/[0O1IL]/);
  });

  it("tokens não repetem em 100 gerações", () => {
    const set = new Set(Array.from({ length: 100 }, () => newPublicToken()));
    expect(set.size).toBe(100);
  });

  it("platePublicUrl monta /r/{token} sem barra dupla", () => {
    expect(platePublicUrl("https://meusite.com.br/", "ABC")).toBe("https://meusite.com.br/r/ABC");
    expect(platePublicUrl("https://meusite.com.br", "ABC")).toBe("https://meusite.com.br/r/ABC");
  });

  it("normalizeActivationCode tira espaço/traço e sobe pra maiúscula", () => {
    expect(normalizeActivationCode(" ab2-9x k4 ")).toBe("AB29XK4");
  });
});
