import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generatePlateToken } from "./tokens";

async function firstProductId(orderId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("order_items")
    .select("product_id")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  return data?.product_id ?? null;
}

async function insertPlates(
  count: number,
  base: { batch_id?: string; order_id?: string; product_id: string | null; business_id: string | null; destination_url: string | null; activated: boolean },
): Promise<number> {
  const now = new Date().toISOString();
  let created = 0;
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabaseAdmin.from("plates").insert({
        token: generatePlateToken(),
        batch_id: base.batch_id ?? null,
        order_id: base.order_id ?? null,
        product_id: base.product_id,
        business_id: base.business_id,
        status: base.activated ? "ativada" : "nao_ativada",
        destination_url: base.destination_url,
        activated_at: base.activated ? now : null,
      });
      if (!error) {
        created++;
        break;
      }
      if (!error.message.includes("plates_token_key")) throw error;
    }
  }
  return created;
}

/**
 * Emit plates for a paid order. Idempotent.
 * - kind "individual": N plates tied to the order, já ativadas apontando para o
 *   negócio informado na compra.
 * - kind "revenda": NÃO gera nada aqui -- lote é montado manualmente pelo
 *   admin a partir do estoque físico (painel de Pedidos, "Gerar lote do
 *   estoque"), pra garantir que todo código emitido corresponde a uma
 *   plaquinha realmente impressa.
 */
export async function emitPlatesForOrder(orderId: string): Promise<{ created: number; total: number }> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, quantity, business_id, kind, payment_status, customer_email")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) throw new Error(`emitPlatesForOrder: pedido ${orderId} não encontrado`);
  if (order.payment_status !== "pago") return { created: 0, total: 0 };

  if (order.kind === "revenda") return { created: 0, total: 0 };

  const productId = await firstProductId(orderId);

  // individual
  const { data: existing } = await supabaseAdmin.from("plates").select("id").eq("order_id", orderId);
  const have = existing?.length ?? 0;
  const missing = order.quantity - have;
  if (missing <= 0) return { created: 0, total: have };

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

  const created = await insertPlates(missing, {
    order_id: orderId,
    product_id: productId,
    business_id: order.business_id,
    destination_url: destinationUrl,
    activated,
  });
  return { created, total: have + created };
}
