// Promoção temporária: 5% de desconto pagando via Pix. Prazo real vive só aqui --
// mudou a data, muda aqui uma vez só (banner do site e checkout leem a mesma constante).
export const PIX_DISCOUNT_PCT = 5;
export const PIX_DISCOUNT_DEADLINE = "2026-10-01T03:00:00-03:00"; // 30/09 às 23:59 (BRT)

// Promoção do site inteiro até o fim de 29/11 (BRT). O preço gravado no banco é o preço PROMOCIONAL (o que se cobra hoje).
// O "de" riscado é o preço que passa a valer depois da promoção: postPromoPrice(banco) = banco / (1 - 5%), ou seja,
// o preço de hoje É 5% abaixo dele. Assim o "de" é real (o site cobra esse valor a partir de 30/11), nunca inventado.
// Entra em pricing.ts (vitrine, checkout e bot) e em checkout.functions.ts (o servidor recalcula).
export const SITE_PROMO_PCT = 5;
export const SITE_PROMO_DEADLINE = "2026-11-30T00:00:00-03:00";
export const SITE_PROMO_UNTIL_LABEL = "29/11";

export function sitePromoActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(SITE_PROMO_DEADLINE).getTime();
}

/** Preço que vale depois da promoção (o "de" riscado enquanto ela dura). */
export function postPromoPrice(cents: number): number {
  return Math.round(cents / (1 - SITE_PROMO_PCT / 100));
}

/** Preço cobrado agora: o do banco durante a promoção; o preço cheio depois de 29/11. */
export function promoPrice(cents: number): number {
  return sitePromoActive() ? cents : postPromoPrice(cents);
}

export function pixDiscountActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(PIX_DISCOUNT_DEADLINE).getTime();
}
