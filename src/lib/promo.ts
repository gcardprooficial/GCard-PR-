// Promoção temporária: 5% de desconto pagando via Pix. Prazo real vive só aqui --
// mudou a data, muda aqui uma vez só (banner do site e checkout leem a mesma constante).
export const PIX_DISCOUNT_PCT = 5;
export const PIX_DISCOUNT_DEADLINE = "2026-10-01T03:00:00-03:00"; // 30/09 às 23:59 (BRT)

export function pixDiscountActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(PIX_DISCOUNT_DEADLINE).getTime();
}
