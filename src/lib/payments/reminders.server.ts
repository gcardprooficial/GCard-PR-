/**
 * Pedido criado mas não pago há mais de 2h: gera um link novo do Mercado Pago e manda
 * por e-mail (1 lembrete por pedido -- o idempotency do e-mail garante).
 */
export async function sendPaymentReminders(opts?: { minAgeHours?: number; maxAgeDays?: number; limit?: number }) {
  const { getPaymentProvider } = await import("./index");
  const provider = getPaymentProvider();
  if (!provider) return { candidates: 0, sent: 0, skipped: "provider_not_configured" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const now = Date.now();
  const olderThan = new Date(now - (opts?.minAgeHours ?? 2) * 3_600_000).toISOString();
  const newerThan = new Date(now - (opts?.maxAgeDays ?? 7) * 86_400_000).toISOString();

  const { data: orders } = await db
    .from("orders")
    .select("id, order_number, total_cents, quantity, customer_email, customer_name")
    .eq("payment_status", "pendente")
    .neq("fulfillment_status", "cancelado")
    .lt("created_at", olderThan)
    .gt("created_at", newerThan)
    .order("created_at", { ascending: true })
    .limit((opts?.limit ?? 30) * 2);

  const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
  const origin = process.env["PUBLIC_APP_URL"] ?? "https://www.gcardpro.com.br";

  let sent = 0;
  let candidates = 0;
  for (const order of orders ?? []) {
    if (candidates >= (opts?.limit ?? 30)) break;
    const { data: already } = await db
      .from("email_events")
      .select("id")
      .eq("order_id", order.id)
      .eq("event_type", "pagamento_pendente")
      .neq("status", "failed")
      .maybeSingle();
    if (already) continue;
    candidates++;
    try {
      const pref = await provider.createPreference({ order, origin });
      const result = await dispatchOrderEmailEvent(order.id, "pagamento_pendente", {
        paymentUrl: pref.url,
      });
      if ("sent" in result && result.sent) sent++;
    } catch (error) {
      console.error("Lembrete de pagamento falhou", { orderId: order.id, error });
    }
  }
  return { candidates, sent };
}
