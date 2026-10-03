import { normalizeCouponCode } from "@/lib/referral";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export type ActiveAffiliate = {
  id: string;
  name: string;
  code: string;
  email: string | null;
  document: string | null;
  discount_pct: number;
  commission_pct: number;
};

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Parceiro ativo dono do cupom, ou null. */
export async function findActiveAffiliate(
  rawCode: string | null | undefined,
): Promise<ActiveAffiliate | null> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;
  const db = await adminDb();
  const { data } = await db
    .from("affiliates")
    .select("id, name, code, email, document, discount_pct, commission_pct")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  return (data as ActiveAffiliate | null) ?? null;
}

/**
 * Resolve o cupom do pedido. O próprio parceiro não pode usar o link dele
 * (ganharia desconto + comissão na mesma compra).
 */
export async function resolveOrderCoupon(
  rawCode: string | null | undefined,
  customer: { email: string; document: string },
  grossCents: number,
) {
  if (!rawCode) return null;
  const affiliate = await findActiveAffiliate(rawCode);
  if (!affiliate) throw new Error("Cupom inválido ou expirado. Remova o cupom e tente de novo.");
  const sameEmail =
    affiliate.email && affiliate.email.trim().toLowerCase() === customer.email.trim().toLowerCase();
  const sameDoc =
    digits(affiliate.document).length >= 11 &&
    digits(affiliate.document) === digits(customer.document);
  if (sameEmail || sameDoc)
    throw new Error("O cupom de parceiro não vale para compras do próprio parceiro.");
  const discountCents = Math.round((grossCents * affiliate.discount_pct) / 100);
  return { affiliate, discountCents, totalCents: grossCents - discountCents };
}

/** Gera a comissão do pedido pago (idempotente: 1 por pedido, índice único). */
export async function recordAffiliateCommission(orderId: string) {
  const db = await adminDb();
  const { data: order } = await db
    .from("orders")
    .select("id, payment_status, total_cents, affiliate_id, affiliate_commission_pct")
    .eq("id", orderId)
    .maybeSingle();
  if (
    !order ||
    order.payment_status !== "pago" ||
    !order.affiliate_id ||
    !order.affiliate_commission_pct
  ) {
    return { created: false };
  }
  // Base = valor efetivamente pago (já com cupom e qualquer outro desconto).
  const { error } = await db.from("affiliate_commissions").insert({
    affiliate_id: order.affiliate_id,
    order_id: orderId,
    base_cents: order.total_cents,
    amount_cents: Math.round((order.total_cents * order.affiliate_commission_pct) / 100),
  });
  if (error && error.code !== "23505") throw error;
  return { created: !error };
}

// Estorno/cancelamento: trigger orders_cancel_affiliate_commission (migration afiliados_cupom).
