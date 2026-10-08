/** Meios de pagamento oferecidos no checkout. Padrão = primeiro da lista. */
export type Gateway = "pagarme" | "infinitepay" | "mercadopago";

// Mercado Pago desligado (retenções/recusas). Para religar, mude para true -- o código continua pronto.
export const SHOW_MERCADOPAGO = false;

export const GATEWAY_OPTIONS: { key: Gateway; title: string; hint: string }[] = [
  { key: "pagarme", title: "Pix ou cartão", hint: "Pagamento seguro pela Stone (Pagar.me)" },
  { key: "infinitepay", title: "InfinitePay", hint: "Pix e cartão (alternativa se o outro não passar)" },
  ...(SHOW_MERCADOPAGO ? [{ key: "mercadopago" as const, title: "Mercado Pago", hint: "Pix, cartão e boleto" }] : []),
];
