// Sugestão de correção para erro de digitação no domínio do e-mail ("Você quis dizer gmail.com?").
// Só sugere, nunca bloqueia: a pessoa decide.

const COMMON_DOMAINS = [
  "gmail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br", "yahoo.com", "yahoo.com.br",
  "icloud.com", "live.com", "msn.com", "uol.com.br", "bol.com.br", "terra.com.br", "globo.com", "proton.me", "protonmail.com",
];

const KNOWN_TYPOS: Record<string, string> = {
  "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.como": "gmail.com",
  "gmail.com.com": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmaill.com": "gmail.com",
  "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.vom": "gmail.com", "gmail.cim": "gmail.com",
  "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com",
  "hotmil.com": "hotmail.com", "iclou.com": "icloud.com", "icloud.con": "icloud.com", "iclod.com": "icloud.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.con": "yahoo.com", "outlok.com": "outlook.com",
  "outllok.com": "outlook.com", "outlook.con": "outlook.com",
};

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** E-mail corrigido, ou null se o domínio parece certo (ou desconhecido demais para sugerir). */
export function suggestEmailDomain(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().slice(at + 1).toLowerCase();
  if (!domain.includes(".") || COMMON_DOMAINS.includes(domain)) return null;
  const known = KNOWN_TYPOS[domain];
  if (known) return `${local}@${known}`;
  const limit = domain.length >= 8 ? 2 : 1;
  let best: { d: string; dist: number } | null = null;
  for (const d of COMMON_DOMAINS) {
    const dist = distance(domain, d);
    if (dist <= limit && (!best || dist < best.dist)) best = { d, dist };
  }
  return best ? `${local}@${best.d}` : null;
}
