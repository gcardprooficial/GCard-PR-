/**
 * Pedido pendente há mais de 3 dias (nunca pago) some sozinho do painel: exclui o pedido.
 * Nunca mexe em pedido pago, cancelado à parte, ou com placas/lote já vinculados -- só
 * limpa lixo de checkout abandonado antes de virar lote/estoque de verdade.
 */
export async function expireStalePendingOrders(opts?: { maxAgeDays?: number; limit?: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const olderThan = new Date(Date.now() - (opts?.maxAgeDays ?? 3) * 86_400_000).toISOString();

  const { data: candidates } = await db
    .from("orders")
    .select("id, order_number, customer_email")
    .eq("payment_status", "pendente")
    .lt("created_at", olderThan)
    .order("created_at", { ascending: true })
    .limit(opts?.limit ?? 100);

  let deleted = 0;
  for (const order of candidates ?? []) {
    // Placa já vinculada (raro em pendente, mas possível via loja própria) trava a exclusão --
    // aí é caso pra humano decidir, não pra automação apagar.
    const { count } = await db
      .from("plates")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    if ((count ?? 0) > 0) continue;

    const { error } = await db.from("orders").delete().eq("id", order.id);
    if (error) {
      console.error("Falha ao expirar pedido pendente", { orderId: order.id, error });
      continue;
    }
    deleted++;
    console.log("Pedido pendente expirado (3+ dias sem pagamento)", {
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
    });
  }
  return { checked: candidates?.length ?? 0, deleted };
}
