// Regras do bipador de placas ao montar um lote: nunca passa da quantidade do pedido e só monta com a quantidade exata.

/** Códigos de placa dentro de um texto: token em hex (32) e código curto GCARD-00001 (sem repetir). */
export function parseScanned(text: string) {
  const hex = new Set((text.match(/[0-9a-f]{32}/gi) ?? []).map((t) => t.toLowerCase()));
  const shorts = new Set((text.match(/GCARD-\d{5}/gi) ?? []).map((t) => t.toUpperCase()));
  return { hex, shorts };
}

/** Quantas placas diferentes já estão no texto. */
export function countScanned(text: string): number {
  const { hex, shorts } = parseScanned(text);
  return hex.size + shorts.size;
}

/**
 * ok: entrou. complete: entrou e fechou a quantidade do pedido. dup: já estava. over: o pedido já está completo, não cabe mais nenhuma.
 * invalid: não é um código de placa.
 */
export type ScanStatus = "ok" | "complete" | "dup" | "over" | "invalid";

/** Soma um código lido ao texto do lote, respeitando a quantidade do pedido (trava na última, não aceita a seguinte). */
export function addScannedCode(text: string, code: string, quantity: number): { text: string; status: ScanStatus } {
  const parsed = parseScanned(code);
  if (parsed.hex.size + parsed.shorts.size === 0) return { text, status: "invalid" };
  const current = parseScanned(text);
  const already = [...parsed.hex].some((c) => current.hex.has(c)) || [...parsed.shorts].some((c) => current.shorts.has(c));
  if (already) return { text, status: "dup" };
  const total = current.hex.size + current.shorts.size;
  if (total >= quantity) return { text, status: "over" };
  return { text: text.trim() ? `${text.trim()}\n${code}` : code, status: total + 1 >= quantity ? "complete" : "ok" };
}

/** O que falta (negativo) ou sobra (positivo) para fechar a quantidade do pedido. 0 = pode montar o lote. */
export function scanGap(text: string, quantity: number): number {
  return countScanned(text) - quantity;
}

/** Texto curto para o botão e a legenda de "Montar lote". */
export function scanGapLabel(text: string, quantity: number): string {
  const gap = scanGap(text, quantity);
  if (gap === 0) return "Completo: pode montar o lote";
  if (gap < 0) return `Faltam ${-gap} para montar o lote`;
  return `Sobram ${gap}: tire ${gap === 1 ? "1 código" : `${gap} códigos`} da lista`;
}
