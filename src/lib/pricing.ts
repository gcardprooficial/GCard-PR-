export type PriceTier = {
  min_quantity: number;
  unit_price_cents: number;
  label: string | null;
};

/** Preço unitário da faixa aplicável à quantidade escolhida. */
export function unitPriceForQuantity(tiers: PriceTier[], quantity: number, fallback: number): number {
  const applicable = [...tiers]
    .filter((tier) => quantity >= tier.min_quantity)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0];
  return applicable?.unit_price_cents ?? fallback;
}

export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
