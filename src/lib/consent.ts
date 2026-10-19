// Texto de consentimento de marketing, versionado. A mesma versão está na tabela consent_texts (o banco guarda
// o texto exibido de cada versão). Para mudar o texto: nova versão aqui E nova linha em consent_texts (migração).
export const CONSENT_TEXT_VERSION = "2026-10-v1";

// Segundo aceite (Marusso): caixa separada, nunca marcada, nunca obrigatória. Texto exato; para mudar, nova versão.
export const MARUSSO_CONSENT_VERSION = "marusso-2026-10-v1";
export const MARUSSO_CONSENT_TEXT =
  "Quero receber novidades e ofertas da Marusso Produções (TOQY, GCard-PRÓ, cursos e outros produtos) por e-mail. Posso sair quando quiser.";

export const CONSENT_TEXT =
  "Quero receber novidades e ofertas dos produtos da Marusso Produções (GCard-PRÓ e TOQY) por e-mail. Posso cancelar quando quiser.";
