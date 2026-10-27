// Promoção temporária: 5% de desconto pagando via Pix. Prazo real vive só aqui --
// mudou a data, muda aqui uma vez só (banner do site e checkout leem a mesma constante).
export const PIX_DISCOUNT_PCT = 5;
export const PIX_DISCOUNT_DEADLINE = "2026-11-30T00:00:00-03:00"; // fim de 29/11 (BRT)
export const PIX_DISCOUNT_UNTIL_LABEL = "29/11";

/** O desconto do Pix vale só para produto com arte (Google, Instagram, Pix, WhatsApp). Acrílico liso e tag NFC ficam de fora. */
export function pixEligible(product: { is_blank?: boolean | null; is_supply?: boolean | null } | null | undefined): boolean {
  return Boolean(product) && !product!.is_blank && !product!.is_supply;
}

/** Desconto em centavos: PIX_DISCOUNT_PCT% sobre a parte do total que vem de produto com arte (share = 0..1). */
export function pixDiscountCents(totalCents: number, eligibleShare: number): number {
  return Math.round(totalCents * eligibleShare * (PIX_DISCOUNT_PCT / 100));
}

export function pixDiscountActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(PIX_DISCOUNT_DEADLINE).getTime();
}
