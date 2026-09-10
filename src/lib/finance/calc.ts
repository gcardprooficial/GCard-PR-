// Calculadoras financeiras — funções puras (testáveis, sem banco).
// Usadas pelo painel admin: preço-alvo, margem, ponto de equilíbrio, P&L.

export type FinanceEntry = {
  kind: "in" | "out";
  category: string;
  amount: number;
  entryDate: string; // YYYY-MM-DD
};

/** Resumo de entrada/saída/lucro de uma lista de lançamentos. */
export function summarize(entries: FinanceEntry[]) {
  let totalIn = 0;
  let totalOut = 0;
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    if (e.kind === "in") totalIn += e.amount;
    else totalOut += e.amount;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + (e.kind === "in" ? e.amount : -e.amount);
  }
  return { totalIn, totalOut, profit: totalIn - totalOut, byCategory };
}

/** Divide o lucro entre sócios pelos percentuais. shares soma ~100. */
export function splitProfit(profit: number, shares: { name: string; sharePercent: number }[]) {
  return shares.map((s) => ({ name: s.name, amount: Math.round(profit * (s.sharePercent / 100) * 100) / 100 }));
}

/**
 * Preço de venda sugerido a partir do custo unitário e da margem desejada.
 * marginPercent = margem SOBRE O PREÇO (markup on price), não sobre o custo.
 * Ex: custo 20, margem 60% → preço = 20 / (1 - 0.60) = 50.
 */
export function targetPrice(unitCost: number, marginPercent: number): number {
  const m = Math.min(Math.max(marginPercent, 0), 99) / 100;
  return Math.round((unitCost / (1 - m)) * 100) / 100;
}

/** Margem % e markup % a partir de preço e custo. */
export function marginFromPrice(price: number, unitCost: number) {
  if (price <= 0) return { marginPercent: 0, markupPercent: 0, profitPerUnit: 0 };
  const profitPerUnit = price - unitCost;
  return {
    marginPercent: Math.round((profitPerUnit / price) * 1000) / 10,
    markupPercent: unitCost > 0 ? Math.round((profitPerUnit / unitCost) * 1000) / 10 : 0,
    profitPerUnit: Math.round(profitPerUnit * 100) / 100,
  };
}

/**
 * Ponto de equilíbrio: quantas unidades vender pra cobrir o custo fixo,
 * dado o lucro por unidade (preço - custo variável unitário).
 */
export function breakEvenUnits(fixedCost: number, price: number, unitCost: number): number {
  const contribution = price - unitCost;
  if (contribution <= 0) return Infinity;
  return Math.ceil(fixedCost / contribution);
}
