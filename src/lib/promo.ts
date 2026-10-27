// Promoção temporária: 5% de desconto pagando via Pix. Prazo real vive só aqui --
// mudou a data, muda aqui uma vez só (banner do site e checkout leem a mesma constante).
export const PIX_DISCOUNT_PCT = 5;
export const PIX_DISCOUNT_DEADLINE = "2026-10-01T03:00:00-03:00"; // 30/09 às 23:59 (BRT)

// Promoção do site inteiro: SITE_PROMO_PCT% sobre o preço de tabela, até o fim de 29/11 (BRT).
// O desconto entra em pricing.ts (vitrine, checkout e bot) e em checkout.functions.ts (o servidor recalcula).
export const SITE_PROMO_PCT = 5;
export const SITE_PROMO_DEADLINE = "2026-11-30T00:00:00-03:00";
export const SITE_PROMO_UNTIL_LABEL = "29/11";

export function sitePromoActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(SITE_PROMO_DEADLINE).getTime();
}

/** Preço de tabela -> preço com a promoção do site (ou o mesmo, se acabou). */
export function promoPrice(cents: number): number {
  return sitePromoActive() ? Math.round(cents * (1 - SITE_PROMO_PCT / 100)) : cents;
}

export function pixDiscountActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(PIX_DISCOUNT_DEADLINE).getTime();
}
