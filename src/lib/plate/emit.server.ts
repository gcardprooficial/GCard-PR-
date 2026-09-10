import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generatePlateToken } from "./tokens";

/**
 * Emit the physical plates for a paid order. Idempotent by order_id: calling it
 * again (repeated webhook) never creates duplicates.
 */
export async function emitPlatesForOrder(orderId: string): Promise<{ created: number; total: number }> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, quantity, business_id, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) throw new Error(`emitPlatesForOrder: pedido ${orderId} não encontrado`);
  if (order.payment_status !== "pago") return { created: 0, total: 0 };

  const { data: existing } = await supabaseAdmin
    .from("plates")
    .select("id")
    .eq("order_id", orderId);
  const have = existing?.length ?? 0;
  const missing = order.quantity - have;
  if (missing <= 0) return { created: 0, total: have };

  const { data: item } = await supabaseAdmin
    .from("order_items")
    .select("product_id")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();

  let destinationUrl: string | null = null;
  if (order.business_id) {
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("review_url")
      .eq("id", order.business_id)
      .maybeSingle();
    destinationUrl = business?.review_url ?? null;
  }

  const activated = Boolean(order.business_id && destinationUrl);
  const now = new Date().toISOString();

  let created = 0;
  for (let i = 0; i < missing; i++) {
    // Retry a couple of times on the (extremely unlikely) token collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabaseAdmin.from("plates").insert({
        token: generatePlateToken(),
        order_id: orderId,
        product_id: item?.product_id ?? null,
        business_id: order.business_id,
        status: activated ? "ativada" : "nao_ativada",
        destination_url: destinationUrl,
        activated_at: activated ? now : null,
      });
      if (!error) {
        created++;
        break;
      }
      if (!error.message.includes("plates_token_key")) throw error;
    }
  }

  return { created, total: have + created };
}
