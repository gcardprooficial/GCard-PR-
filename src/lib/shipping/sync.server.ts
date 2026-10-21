import { nextFulfillment, stageFromStatus } from "./tracking-map";

type OrderRow = {
  id: string;
  me_order_id: string;
  tracking_code: string | null;
  fulfillment_status: string;
  shipped_at: string | null;
};

/**
 * Atualiza os pedidos que têm etiqueta no Melhor Envio: rastreio, enviado e entregue.
 * Só AVANÇA o pedido (nunca rebaixa) e só dispara e-mail "enviado"/"entregue" uma vez (idempotente).
 * Falha de uma consulta nunca derruba as outras nem o cron.
 */
export async function syncShippingStatuses(limit = 100) {
  const out = { checked: 0, enviados: 0, entregues: 0, rastreios: 0, erro: null as string | null };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data: rows } = await db
    .from("orders")
    .select("id, me_order_id, tracking_code, fulfillment_status, shipped_at")
    .not("me_order_id", "is", null)
    .not("fulfillment_status", "in", "(entregue,cancelado)")
    .gte("created_at", since)
    .limit(limit);
  const orders = (rows ?? []) as OrderRow[];
  if (orders.length === 0) return out;

  const { trackShipments } = await import("./melhorenvio.server");
  const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
  const byId = new Map(orders.map((o) => [o.me_order_id, o]));

  for (let i = 0; i < orders.length; i += 40) {
    const chunk = orders.slice(i, i + 40);
    const r = await trackShipments(chunk.map((o) => o.me_order_id));
    if (!r.ok) {
      out.erro = r.error;
      console.error("sync rastreio: consulta falhou", r.error);
      continue;
    }
    for (const t of r.items) {
      const o = byId.get(t.id);
      if (!o) continue;
      out.checked++;
      try {
        const stage = stageFromStatus(t.status);
        const next = nextFulfillment(o.fulfillment_status, stage);
        const patch: Record<string, unknown> = { shipping_status: t.status, tracking_synced_at: new Date().toISOString() };
        if (t.tracking && t.tracking !== o.tracking_code) {
          patch["tracking_code"] = t.tracking;
          out.rastreios++;
        }
        if (next) patch["fulfillment_status"] = next;
        if ((stage === "enviado" || stage === "entregue") && !o.shipped_at) patch["shipped_at"] = t.postedAt ? new Date(t.postedAt.replace(" ", "T") + "-03:00").toISOString() : new Date().toISOString();
        if (stage === "entregue") patch["delivered_at"] = t.deliveredAt ? new Date(t.deliveredAt.replace(" ", "T") + "-03:00").toISOString() : new Date().toISOString();
        const { error } = await db.from("orders").update(patch).eq("id", o.id);
        if (error) throw error;
        // E-mails do cliente: uma vez só (a chave de idempotência do pedido cuida de repetição).
        if (stage === "enviado" || stage === "entregue") await dispatchOrderEmailEvent(o.id, "pedido_enviado");
        if (stage === "entregue") await dispatchOrderEmailEvent(o.id, "pedido_entregue");
        if (next === "enviado") out.enviados++;
        if (next === "entregue") out.entregues++;
      } catch (error) {
        console.error("sync rastreio: falha num pedido", { order: o.id, error });
      }
    }
  }
  return out;
}
