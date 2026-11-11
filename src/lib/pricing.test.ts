import { describe, expect, it } from "vitest";
import {
  money,
  resolveTiersForProduct,
  resolveUnitPrice,
  unitPriceForQuantity,
  type PriceTier,
} from "./pricing";

// Preço sempre sai desta conta, no site e no checkout. Aqui ficam as faixas reais do kit de 10 (preço em centavos).

const PLAQUINHA: PriceTier[] = [
  { min_quantity: 10, unit_price_cents: 5790, label: "10 a 24" },
  { min_quantity: 25, unit_price_cents: 4790, label: "25 a 99" },
  { min_quantity: 100, unit_price_cents: 3990, label: "100+" },
];
const PLANO = { tiers: PLAQUINHA, unit_price_cents: 5790 };

describe("unitPriceForQuantity", () => {
  it("usa a maior faixa que a quantidade alcança", () => {
    expect(unitPriceForQuantity(PLAQUINHA, 10, 0)).toBe(5790);
    expect(unitPriceForQuantity(PLAQUINHA, 24, 0)).toBe(5790);
    expect(unitPriceForQuantity(PLAQUINHA, 25, 0)).toBe(4790);
    expect(unitPriceForQuantity(PLAQUINHA, 99, 0)).toBe(4790);
    expect(unitPriceForQuantity(PLAQUINHA, 100, 0)).toBe(3990);
    expect(unitPriceForQuantity(PLAQUINHA, 5000, 0)).toBe(3990);
  });
  it("abaixo da primeira faixa usa o preço de reserva", () => {
    expect(unitPriceForQuantity(PLAQUINHA, 9, 7777)).toBe(7777);
    expect(unitPriceForQuantity([], 50, 1234)).toBe(1234);
  });
  it("não depende da ordem das faixas e não altera a lista original", () => {
    const embaralhada = [PLAQUINHA[2]!, PLAQUINHA[0]!, PLAQUINHA[1]!];
    const copia = JSON.stringify(embaralhada);
    expect(unitPriceForQuantity(embaralhada, 30, 0)).toBe(4790);
    expect(JSON.stringify(embaralhada)).toBe(copia);
  });
});

describe("resolveUnitPrice", () => {
  const liso = {
    is_blank: true,
    resale_tiers: [
      { min_quantity: 10, unit_price_cents: 1050, label: null },
      { min_quantity: 50, unit_price_cents: 850, label: null },
    ],
    resale_delta_cents: 0,
    price_delta_cents: 0,
  };
  const arte = {
    is_blank: false,
    resale_tiers: [] as PriceTier[],
    resale_delta_cents: 300,
    price_delta_cents: 900,
  };
  const comFaixaPropria = {
    is_blank: false,
    resale_tiers: [{ min_quantity: 10, unit_price_cents: 1890, label: null }],
    resale_delta_cents: 0,
    price_delta_cents: 0,
  };

  it("produto liso usa sempre a faixa própria de revenda", () => {
    expect(resolveUnitPrice(PLANO, liso, 10, true)).toBe(1050);
    expect(resolveUnitPrice(PLANO, liso, 50, false)).toBe(850);
  });
  it("revenda com faixa própria usa ela", () => {
    expect(resolveUnitPrice(PLANO, comFaixaPropria, 20, true)).toBe(1890);
  });
  it("revenda sem faixa própria usa o plano mais o adicional de revenda", () => {
    expect(resolveUnitPrice(PLANO, arte, 10, true)).toBe(5790 + 300);
  });
  it("compra comum usa o plano mais o adicional do produto", () => {
    expect(resolveUnitPrice(PLANO, arte, 10, false)).toBe(5790 + 900);
  });
  it("sem produto usa só o plano", () => {
    expect(resolveUnitPrice(PLANO, null, 25, false)).toBe(4790);
  });
  it("soma o adicional da cor em qualquer caminho", () => {
    expect(resolveUnitPrice(PLANO, liso, 10, true, 100)).toBe(1150);
    expect(resolveUnitPrice(PLANO, arte, 10, true, 100)).toBe(5790 + 300 + 100);
    expect(resolveUnitPrice(PLANO, null, 10, false, 100)).toBe(5890);
  });
});

describe("resolveTiersForProduct", () => {
  const arte = {
    is_blank: false,
    resale_tiers: [] as PriceTier[],
    resale_delta_cents: 300,
    price_delta_cents: 900,
  };
  it("devolve as faixas do plano quando não há adicional", () => {
    const sem = { ...arte, resale_delta_cents: 0, price_delta_cents: 0 };
    expect(resolveTiersForProduct(PLANO, sem, false)).toBe(PLANO.tiers);
  });
  it("aplica o adicional em cada faixa sem mexer no plano", () => {
    const antes = JSON.stringify(PLANO.tiers);
    const r = resolveTiersForProduct(PLANO, arte, true);
    expect(r.map((t) => t.unit_price_cents)).toEqual([6090, 5090, 4290]);
    expect(JSON.stringify(PLANO.tiers)).toBe(antes);
  });
  it("a tabela mostrada bate com o preço cobrado, em qualquer quantidade", () => {
    for (const qtd of [10, 24, 25, 99, 100]) {
      const tabela = resolveTiersForProduct(PLANO, arte, true);
      expect(unitPriceForQuantity(tabela, qtd, 0)).toBe(resolveUnitPrice(PLANO, arte, qtd, true));
    }
  });
});

describe("money", () => {
  it("formata em reais", () => {
    expect(money(5790).replace(/\s/g, " ")).toBe("R$ 57,90");
    expect(money(0).replace(/\s/g, " ")).toBe("R$ 0,00");
    expect(money(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});
