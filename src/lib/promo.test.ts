import { describe, expect, it } from "vitest";
import {
  PIX_DISCOUNT_DEADLINE,
  PIX_DISCOUNT_PCT,
  pixDiscountActive,
  pixDiscountCents,
  pixEligible,
} from "./promo";

// Promoção de 5% no Pix. O prazo mora só em promo.ts; estes testes garantem a fronteira exata e quem entra.

describe("pixEligible", () => {
  it("só produto com arte tem desconto", () => {
    expect(pixEligible({ is_blank: false, is_supply: false })).toBe(true);
    expect(pixEligible({})).toBe(true);
  });
  it("acrílico liso e tag NFC ficam de fora", () => {
    expect(pixEligible({ is_blank: true })).toBe(false);
    expect(pixEligible({ is_supply: true })).toBe(false);
  });
  it("sem produto não tem desconto", () => {
    expect(pixEligible(null)).toBe(false);
    expect(pixEligible(undefined)).toBe(false);
  });
});

describe("pixDiscountCents", () => {
  it("5% da parte elegível do total", () => {
    expect(PIX_DISCOUNT_PCT).toBe(5);
    expect(pixDiscountCents(10000, 1)).toBe(500);
    expect(pixDiscountCents(10000, 0.5)).toBe(250);
    expect(pixDiscountCents(10000, 0)).toBe(0);
  });
  it("arredonda para o centavo mais próximo", () => {
    expect(pixDiscountCents(3333, 1)).toBe(167); // 166,65
    expect(pixDiscountCents(3330, 1)).toBe(167); // 166,50 arredonda para cima
  });
  it("nunca passa do total", () => {
    for (const total of [100, 999, 57900, 1_000_000])
      expect(pixDiscountCents(total, 1)).toBeLessThanOrEqual(total);
  });
});

describe("pixDiscountActive", () => {
  const limite = new Date(PIX_DISCOUNT_DEADLINE).getTime();
  it("vale até o último instante antes do prazo", () => {
    expect(pixDiscountActive(new Date(limite - 1))).toBe(true);
    expect(pixDiscountActive(new Date(limite - 24 * 3600 * 1000))).toBe(true);
  });
  it("deixa de valer no prazo e depois dele", () => {
    expect(pixDiscountActive(new Date(limite))).toBe(false);
    expect(pixDiscountActive(new Date(limite + 1))).toBe(false);
    expect(pixDiscountActive(new Date(limite + 30 * 24 * 3600 * 1000))).toBe(false);
  });
  it("o prazo é à meia-noite de Brasília (fim do dia 29/11)", () => {
    expect(PIX_DISCOUNT_DEADLINE).toBe("2026-11-30T00:00:00-03:00");
    expect(pixDiscountActive(new Date("2026-11-29T23:59:59-03:00"))).toBe(true);
    expect(pixDiscountActive(new Date("2026-11-30T00:00:00-03:00"))).toBe(false);
  });
});
