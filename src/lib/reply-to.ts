/**
 * Campo reply_to dos envios por Resend. Lê RESEND_REPLY_TO do ambiente e só inclui o campo quando a variável existe
 * e não está vazia; sem valor, o envio sai exatamente como antes. Nenhum endereço fica no código.
 */
export function replyToField(env: Record<string, string | undefined> = process.env): { reply_to?: string } {
  const value = env["RESEND_REPLY_TO"]?.trim();
  return value ? { reply_to: value } : {};
}
