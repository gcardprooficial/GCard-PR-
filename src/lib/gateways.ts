/** Meios de pagamento oferecidos no checkout. Padrão = primeiro da lista. */
export type Gateway = "pagarme" | "infinitepay" | "mercadopago";

// Mercado Pago desligado (retenções/recusas). Para religar, mude para true -- o código continua pronto.
export const SHOW_MERCADOPAGO = false;
// Stone/Pagar.me ainda não ativou o checkout na conta ("Checkout is disabled"). Quando ativar, mude para true.
// Enquanto isso dá pra testar abrindo /comprar?pagarme=1 (a opção aparece só pra quem usa esse endereço).
export const SHOW_PAGARME = false;

const ALL: { key: Gateway; title: string; hint: string }[] = [
  { key: "pagarme", title: "Pix ou cartão", hint: "Pagamento seguro pela Stone (Pagar.me)" },
  { key: "infinitepay", title: "InfinitePay", hint: "Pix e cartão" },
  { key: "mercadopago", title: "Mercado Pago", hint: "Pix, cartão e boleto" },
];

export function gatewayOptions(testPagarme = false) {
  return ALL.filter((g) => (g.key === "pagarme" ? SHOW_PAGARME || testPagarme : g.key === "mercadopago" ? SHOW_MERCADOPAGO : true));
}
