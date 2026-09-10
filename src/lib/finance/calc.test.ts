import { describe, expect, it } from "vitest";
import { breakEvenUnits, marginFromPrice, splitProfit, summarize, targetPrice } from "./calc";

describe("summarize", () => {
  it("soma entradas, saídas e lucro", () => {
    const r = summarize([
      { kind: "in", category: "venda", amount: 100, entryDate: "2026-09-01" },
      { kind: "in", category: "venda", amount: 50, entryDate: "2026-09-02" },
      { kind: "out", category: "embalagem", amount: 30, entryDate: "2026-09-03" },
      { kind: "out", category: "api_claude", amount: 20, entryDate: "2026-09-04" },
    ]);
    expect(r.totalIn).toBe(150);
    expect(r.totalOut).toBe(50);
    expect(r.profit).toBe(100);
    expect(r.byCategory.venda).toBe(150);
    expect(r.byCategory.embalagem).toBe(-30);
  });
});

describe("splitProfit", () => {
  it("divide 50/50", () => {
    expect(splitProfit(100, [{ name: "Léo", sharePercent: 50 }, { name: "Sócio", sharePercent: 50 }]))
      .toEqual([{ name: "Léo", amount: 50 }, { name: "Sócio", amount: 50 }]);
  });
  it("divide 60/40", () => {
    expect(splitProfit(1000, [{ name: "A", sharePercent: 60 }, { name: "B", sharePercent: 40 }]))
      .toEqual([{ name: "A", amount: 600 }, { name: "B", amount: 400 }]);
  });
});

describe("targetPrice", () => {
  it("custo 20, margem 60% -> 50", () => {
    expect(targetPrice(20, 60)).toBe(50);
  });
  it("custo 12, margem 50% -> 24", () => {
    expect(targetPrice(12, 50)).toBe(24);
  });
});

describe("marginFromPrice", () => {
  it("preço 50, custo 20 -> margem 60%, markup 150%, lucro 30", () => {
    const r = marginFromPrice(50, 20);
    expect(r.marginPercent).toBe(60);
    expect(r.markupPercent).toBe(150);
    expect(r.profitPerUnit).toBe(30);
  });
});

describe("breakEvenUnits", () => {
  it("custo fixo 900, preço 50, custo unit 20 -> 30 unidades", () => {
    expect(breakEvenUnits(900, 50, 20)).toBe(30);
  });
  it("sem contribuição positiva -> Infinity", () => {
    expect(breakEvenUnits(900, 20, 20)).toBe(Infinity);
  });
});
