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
 * - kind "revenda": um lote (batch) é criado para o pedido, com N códigos em
 *   branco. O revendedor ativa cada um no painel dele.
 */
export async function emitPlatesForOrder(orderId: string): Promise<{ created: number; total: number }> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, quantity, business_id, kind, payment_status, customer_email")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) throw new Error(`emitPlatesForOrder: pedido ${orderId} não encontrado`);
  if (order.payment_status !== "pago") return { created: 0, total: 0 };

  const productId = await firstProductId(orderId);

  if (order.kind === "revenda") {      // Try to find existing batch
      const { data: existingBatch } = await supabaseAdmin
        .from("batches")
        .select("id")
        .eq("owner_order_id", orderId)
        .maybeSingle();
      let batch = existingBatch;
      if (!batch) {
        // Create a new batch with a unique code, retry on conflict
        for (let attempt = 0; attempt < 3; attempt++) {
          const code = `L-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${generatePlateToken(5)}`;
          const { data: nb, error } = await supabaseAdmin
            .from("batches")
            .insert({
              code,
              label: `Pedido #${order.order_number}`,
              product_id: productId,
              quantity: order.quantity,
              owner_email: order.customer_email,
              owner_order_id: orderId,
              status: "produzido",
            })
            .select("id")
            .single();
          if (!error) {
            batch = nb;
            break;
          }
          if (!error.message.includes("batches_code_key")) throw error;
          // else retry
        }
        if (!batch) throw new Error("Failed to generate unique batch code");
      }



    const { data: existing } = await supabaseAdmin.from("plates").select("id").eq("batch_id", batch.id);
    const have = existing?.length ?? 0;
    const missing = order.quantity - have;
    if (missing <= 0) return { created: 0, total: have };

    const created = await insertPlates(missing, {
      batch_id: batch.id,
      product_id: productId,
      business_id: null,
      destination_url: null,
      activated: false,
    });
    return { created, total: have + created };
  }

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
