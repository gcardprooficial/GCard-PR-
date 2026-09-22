/** Dados da empresa responsável pelo site (aparecem em rodapé, termos, e-mails e dados estruturados). */
export const COMPANY = {
  brand: "GCard-PRÓ",
  legalName: "Marusso Produções",
  cnpj: "68.194.199/0001-70",
  street: "Romeu Ferigatti",
  city: "Indaiatuba",
  state: "SP",
} as const;

/** "Marusso Produções · CNPJ 68.194.199/0001-70" */
export const COMPANY_ID_LINE = `${COMPANY.legalName} · CNPJ ${COMPANY.cnpj}`;

/** "Romeu Ferigatti, Indaiatuba/SP" */
export const COMPANY_ADDRESS = `${COMPANY.street}, ${COMPANY.city}/${COMPANY.state}`;

/** Chave Pix (CNPJ, só dígitos) para o pagamento alternativo quando o Mercado Pago falha pro cliente. */
export const PIX_KEY = COMPANY.cnpj.replace(/\D/g, "");
