/** Horário de funcionamento e regra de produção: um lugar só, usado no site, nos e-mails e no assistente. */
export const BUSINESS_HOURS = "segunda a sexta, das 9h às 17h";

export const PRODUCTION_SHORT = `Produção e envio: ${BUSINESS_HOURS}. Não trabalhamos aos sábados, domingos e feriados.`;

export const PRODUCTION_LONG =
  `Atenção: a produção e o despacho acontecem apenas de ${BUSINESS_HOURS}. ` +
  `Não trabalhamos aos sábados, domingos e feriados. ` +
  `Pedidos feitos ou pagos no fim de semana entram na fila na segunda-feira, ` +
  `e o código de rastreio só é enviado depois do despacho, em dia útil.`;
