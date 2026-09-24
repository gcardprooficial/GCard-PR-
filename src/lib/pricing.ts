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

type PricedProduct = {
  is_blank: boolean;
  resale_tiers: PriceTier[];
  resale_delta_cents: number;
  price_delta_cents: number;
};

/**
 * Produto com faixa própria de revenda usa ela; senão, plano + adicional fixo.
 * Fonte única de verdade pra preço de produto — home e checkout usam a mesma conta,
 * pra nunca mostrar número diferente pro mesmo produto/quantidade.
 */
export function resolveUnitPrice(
  plan: { tiers: PriceTier[]; unit_price_cents: number },
  product: PricedProduct | null,
  quantity: number,
  isResale: boolean,
  colorDeltaCents = 0,
): number {
  if (product?.is_blank && product.resale_tiers?.length) {
    return (
      unitPriceForQuantity(product.resale_tiers, quantity, product.resale_tiers[0]!.unit_price_cents) +
      colorDeltaCents
    );
  }
  if (isResale && product?.resale_tiers?.length) {
    return (
      unitPriceForQuantity(product.resale_tiers, quantity, product.resale_tiers[0]!.unit_price_cents) +
      colorDeltaCents
    );
  }
  const delta = isResale ? (product?.resale_delta_cents ?? 0) : (product?.price_delta_cents ?? 0);
  return unitPriceForQuantity(plan.tiers, quantity, plan.unit_price_cents) + delta + colorDeltaCents;
}

/** Tabela de faixas de preço já resolvida pro produto (pra listar "a partir de X un: R$Y"). */
export function resolveTiersForProduct(
  plan: { tiers: PriceTier[]; unit_price_cents: number },
  product: PricedProduct | null,
  isResale: boolean,
): PriceTier[] {
  if (product?.is_blank && product.resale_tiers?.length) return product.resale_tiers;
  if (isResale && product?.resale_tiers?.length) return product.resale_tiers;
  const delta = isResale ? (product?.resale_delta_cents ?? 0) : (product?.price_delta_cents ?? 0);
  if (!delta) return plan.tiers;
  return plan.tiers.map((t) => ({ ...t, unit_price_cents: t.unit_price_cents + delta }));
}
