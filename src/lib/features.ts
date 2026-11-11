// Chave por conta da casca nova (v2). Nada no banco: duas variáveis de ambiente.
//   FEATURE_SHELL_V2=true            liga para todas as contas
//   FEATURE_SHELL_V2_EMAILS=a@x,b@y  liga só para esses e-mails (teste antes de liberar)
// Desligada por padrão: sem nenhuma das duas, todo mundo continua na tela atual.
// Só serve no servidor; a tela pergunta ao servidor e não lê estas variáveis.
export function isShellV2On(email: string | null | undefined): boolean {
  if (process.env["FEATURE_SHELL_V2"] === "true") return true;
  const list = (process.env["FEATURE_SHELL_V2_EMAILS"] ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && list.includes((email as string).trim().toLowerCase());
}
