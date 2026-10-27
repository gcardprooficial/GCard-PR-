import { pixDiscountActive, pixDiscountCents, pixEligible } from "@/lib/promo";

/**
 * 5% de desconto no Pix, só nos produtos com arte (ver promo.ts). Idempotente: só aplica se o pedido ainda está pendente, a promoção vale
 * e ele nunca recebeu o desconto -- gerar o Pix de novo (QR expirado) não reduz o preço a cada tentativa.
 * Devolve o total que vale agora.
 */
export async function applyPixDiscount(orderId: string): Promise<number | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, total_cents, payment_status, pix_discount_applied, order_items(quantity, unit_price_cents, products(is_blank, is_supply))" as never)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  const row = order as unknown as {
    total_cents: number;
    payment_status: string;
    pix_discount_applied: boolean | null;
    order_items: { quantity: number; unit_price_cents: number; products: { is_blank: boolean | null; is_supply: boolean | null } | null }[];
  };
  if (!pixDiscountActive() || row.payment_status !== "pendente" || row.pix_discount_applied) return row.total_cents;
  // Só a parte do pedido que é produto com arte ganha o desconto (acrílico liso e tag NFC não).
  const gross = row.order_items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);
  const eligible = row.order_items.filter((i) => pixEligible(i.products)).reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);
  if (gross <= 0 || eligible <= 0) return row.total_cents;
  const totalCents = row.total_cents - pixDiscountCents(row.total_cents, eligible / gross);
  await supabaseAdmin
    .from("orders")
    .update({ total_cents: totalCents, subtotal_cents: totalCents, pix_discount_applied: true } as never)
    .eq("id", orderId)
    .eq("payment_status", "pendente");
  return totalCents;
}

/** O pedido já recebeu o desconto do Pix? (então só pode ser pago por Pix). */
export async function hasPixDiscount(orderId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("orders").select("pix_discount_applied" as never).eq("id", orderId).maybeSingle();
  return Boolean((data as unknown as { pix_discount_applied?: boolean | null } | null)?.pix_discount_applied);
}
