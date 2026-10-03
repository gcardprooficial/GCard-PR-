// Cupom de parceiro (afiliado) guardado no navegador. Só identifica QUEM indicou --
// o desconto e a comissão são sempre recalculados no servidor a partir do banco.

export const COUPON_RE = /^[a-z0-9_-]{3,30}$/;
const KEY = "gcard_ref";
const TTL_MS = 30 * 86_400_000; // atribuição de 30 dias, último link clicado vence

export function normalizeCouponCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toLowerCase();
  return COUPON_RE.test(code) ? code : null;
}

/** Lê ?cupom= / ?ref= da URL atual e guarda. Chamado uma vez no layout raiz. */
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = normalizeCouponCode(params.get("cupom") ?? params.get("ref"));
  if (code) storeReferral(code);
  return code;
}

export function storeReferral(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* modo anônimo / storage bloqueado: cupom ainda pode ser digitado no checkout */
  }
}

export function getStoredReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { code?: string; at?: number };
    if (!v.code || !v.at || Date.now() - v.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return normalizeCouponCode(v.code);
  } catch {
    return null;
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
