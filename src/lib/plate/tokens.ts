// Tokens públicos e códigos de ativação do módulo Placas.
//
// Lotes de revenda: os tokens/códigos são gerados NO BANCO
// (generate_plate_batch, com retry anti-colisão contra a constraint
// unique) — não aqui. Este módulo cobre:
//  - montar a URL pública a partir do token
//  - gerar UM token/código pro caminho INDIVIDUAL (Fase 2), onde só existe
//    1 unidade por pedido e a checagem de unicidade é feita na hora do
//    insert (com retry na rota).
//
// Alfabeto sem 0/O/1/I/L: código de ativação é digitado por gente.

const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomFromAlphabet(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return out;
}

/** Token público de 20 chars — vai no QR e no NFC. */
export function newPublicToken(): string {
  return randomFromAlphabet(20);
}

/** Código de ativação de 8 chars — usado pelo revendedor pra ativar 1 unidade. */
export function newActivationCode(): string {
  return randomFromAlphabet(8);
}

/** URL pública que o QR/NFC carrega. `origin` = a origin do site. */
export function platePublicUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/r/${token}`;
}

/** Normaliza o que a pessoa digitou no campo de código de ativação. */
export function normalizeActivationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
