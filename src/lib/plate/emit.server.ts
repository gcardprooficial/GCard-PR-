import { randomUUID } from "node:crypto";
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

/** Acrílico liso do pedido: quantos códigos de QR o cliente pediu e o produto da primeira linha. */
async function blankAcrylic(orderId: string): Promise<{ qty: number; productId: string | null }> {
  const { data } = await supabaseAdmin
    .from("order_items")
    .select("quantity, product_id, product_name, products(is_blank)")
    .eq("order_id", orderId);
  const items = (data ?? []) as unknown as { quantity: number; product_id: string | null; product_name: string; products: { is_blank: boolean } | null }[];
  const lines = items.filter((r) => r.product_id && r.products?.is_blank);
  // O cliente escolhe se quer o QR: só os itens "Código QR para ativar" geram código. Sem eles, acrílico liso não emite nada.
  const wanted = items.filter((r) => r.product_name.startsWith("Código QR para ativar")).reduce((n, r) => n + r.quantity, 0);
  return { qty: lines.length > 0 ? wanted : 0, productId: lines[0]?.product_id ?? null };
}

/** Cria N placas de uma vez (blocos de 100). Se um token repetir (raríssimo), cai para uma a uma. */
async function insertPlatesBulk(
  count: number,
  base: { batch_id: string | null; order_id: string; product_id: string | null },
): Promise<number> {
  let created = 0;
  for (let left = count; left > 0; left -= 100) {
    const n = Math.min(100, left);
    const rows = Array.from({ length: n }, () => ({
      token: generatePlateToken(),
      batch_id: base.batch_id,
      order_id: base.order_id,
      product_id: base.product_id,
      business_id: null,
      status: "nao_ativada" as const,
      destination_url: null,
    }));
    const { error } = await supabaseAdmin.from("plates").insert(rows as never);
    if (!error) {
      created += n;
      continue;
    }
    if (!error.message.includes("plates_token_key")) throw error;
    created += await insertPlates(n, { ...(base.batch_id ? { batch_id: base.batch_id } : {}), order_id: base.order_id, product_id: base.product_id, business_id: null, destination_url: null, activated: false });
  }
  return created;
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
 * Todo pedido de loja própria ganha um lote (dono = e-mail da compra). É isso que faz
 * o comprador ver as próprias placas em /ativar e trocar o link quando quiser.
 */
async function ensureOrderBatch(
  order: { id: string; order_number: number; quantity: number; customer_email: string },
  productId: string | null,
): Promise<string | null> {
  if (!productId) return null;
  const { data: existing } = await supabaseAdmin
    .from("batches")
    .select("id")
    .eq("owner_order_id", order.id)
    .maybeSingle();
  if (existing) return existing.id;

  for (let attempt = 0; attempt < 5; attempt++) {
    const day = new Date().toISOString().slice(2, 10).replaceAll("-", "");
    const suffix = (randomUUID() + randomUUID()).replaceAll("-", "").slice(0, 16).toUpperCase();
    const { data, error } = await supabaseAdmin
      .from("batches")
      .insert({
        code: `L-${day}-${suffix}`,
        label: `Pedido #${order.order_number}`,
        product_id: productId,
        quantity: order.quantity,
        owner_email: order.customer_email.trim().toLowerCase(),
        unit_cost_cents: 0,
        status: "vendido",
        owner_order_id: order.id,
      } as never)
      .select("id")
      .single();
    if (!error) return data.id;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Não foi possível gerar código único de lote.");
}

/**
 * Emit plates for a paid order. Idempotent.
 * - kind "individual": N plates tied to the order, já ativadas apontando para o
 *   negócio informado na compra.
 * - acrílico liso (is_blank): 1 código de QR por unidade, sem destino (ver acima).
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

  // Acrílico liso: o cliente personaliza a arte em casa. Cada unidade ganha um código de QR (sem negócio e sem
  // destino): ele baixa o QR em /ativar e cola o destino quando quiser. O chip NFC vai vazio; o link do NFC é o
  // do mesmo código (botão "Copiar URL NFC" em /ativar). Vale para loja própria e para revenda.
  const blank = await blankAcrylic(orderId);
  if (blank.qty > 0) {
    const { data: have } = await supabaseAdmin.from("plates").select("id").eq("order_id", orderId);
    const haveCount = have?.length ?? 0;
    const missingBlank = blank.qty - haveCount;
    if (missingBlank <= 0) return { created: 0, total: haveCount };
    const batchId = await ensureOrderBatch(
      { id: order.id, order_number: order.order_number, quantity: blank.qty, customer_email: order.customer_email },
      blank.productId,
    );
    // Sempre códigos NOVOS: nunca usa o estoque que você gera e imprime (as placas impressas ficam com os códigos delas).
    const createdBlank = await insertPlatesBulk(missingBlank, { batch_id: batchId, order_id: orderId, product_id: blank.productId });
    return { created: createdBlank, total: haveCount + createdBlank };
  }

  if (order.kind === "revenda") return { created: 0, total: 0 };

  const productId = await firstProductId(orderId);

  // Sem código pra emitir: acrílico puro (sem QR/NFC) e cartão de PVC (só NFC, sem QR).
  // O cartão é controlado por estoque simples no painel, não por placa/lote.
  if (productId) {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("is_blank, has_qr")
      .eq("id", productId)
      .maybeSingle();
    const p = product as { is_blank?: boolean; has_qr?: boolean } | null;
    if (p?.is_blank || p?.has_qr === false) return { created: 0, total: 0 };
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

  const batchId = await ensureOrderBatch(
    {
      id: order.id,
      order_number: order.order_number,
      quantity: order.quantity,
      customer_email: order.customer_email,
    },
    productId,
  );

  const created = await insertPlates(missing, {
    ...(batchId ? { batch_id: batchId } : {}),
    order_id: orderId,
    product_id: productId,
    business_id: order.business_id,
    destination_url: destinationUrl,
    activated,
  });
  return { created, total: have + created };
}
