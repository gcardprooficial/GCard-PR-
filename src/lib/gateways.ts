/** Meios de pagamento oferecidos no checkout. Padrão = primeiro da lista. */
export type Gateway = "pagarme" | "pagarmecard" | "infinitepay" | "mercadopago";

// Mercado Pago desligado (retenções/recusas). Para religar, mude para true -- o código continua pronto.
export const SHOW_MERCADOPAGO = false;
// Stone/Pagar.me: Pix transparente (/pagamento/pix) + cartão por link de pagamento. Checkout hospedado está descontinuado.
export const SHOW_PAGARME = true;

const ALL: { key: Gateway; title: string; hint: string }[] = [
  { key: "pagarme", title: "Pix", hint: "QR Code e copia-e-cola, confirma na hora" },
  { key: "pagarmecard", title: "Cartão de crédito", hint: "À vista, pagamento seguro pela Stone" },
  { key: "infinitepay", title: "InfinitePay", hint: "Pix e cartão" },
  { key: "mercadopago", title: "Mercado Pago", hint: "Pix, cartão e boleto" },
];

export function gatewayOptions(testPagarme = false) {
  return ALL.filter((g) => (g.key === "pagarme" || g.key === "pagarmecard" ? SHOW_PAGARME || testPagarme : g.key === "mercadopago" ? SHOW_MERCADOPAGO : true));
}
