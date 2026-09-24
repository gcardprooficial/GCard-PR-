/**
 * Pedido pendente há mais de 24h (nunca pago) vira "cancelado" sozinho -- some da aba
 * "Aguardando pagamento" e aparece em "Não pagos". Só mexe em quem ainda tá pendente
 * (reconcilePendingOrders já rodou antes no cron e teria pego quem pagou de verdade).
 */
export async function autoCancelStalePending(opts?: { maxAgeHours?: number; limit?: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const olderThan = new Date(Date.now() - (opts?.maxAgeHours ?? 24) * 3_600_000).toISOString();

  const { data: candidates } = await db
    .from("orders")
    .select("id")
    .eq("payment_status", "pendente")
    .lt("created_at", olderThan)
    .limit(opts?.limit ?? 200);

  if (!candidates?.length) return { checked: 0, cancelled: 0 };
  const ids = candidates.map((o: { id: string }) => o.id);
  const { error } = await db.from("orders").update({ payment_status: "cancelado" }).in("id", ids);
  if (error) throw error;
  return { checked: ids.length, cancelled: ids.length };
}

/**
 * Pedido nunca pago há mais de 2 dias some sozinho do painel: exclui o pedido.
 * Nunca mexe em pedido pago, estornado, ou com placas/lote já vinculados -- só
 * limpa lixo de checkout abandonado antes de virar lote/estoque de verdade.
 */
export async function expireStalePendingOrders(opts?: { maxAgeDays?: number; limit?: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const olderThan = new Date(Date.now() - (opts?.maxAgeDays ?? 2) * 86_400_000).toISOString();

  const { data: candidates } = await db
    .from("orders")
    .select("id, order_number, customer_email")
    .in("payment_status", ["pendente", "cancelado"])
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
