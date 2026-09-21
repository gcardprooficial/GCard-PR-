import type { PaymentResult } from "./provider";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

function brazilDay(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Lança a venda no Financeiro (1 entrada por pedido pago). Idempotente. */
export async function recordSaleEntry(orderId: string) {
  const db = await adminDb();
  const { data: order } = await db
    .from("orders")
    .select("id, order_number, total_cents, payment_status, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.payment_status !== "pago") return { created: false };

  const { data: existing } = await db
    .from("finance_entries")
    .select("id")
    .eq("order_id", orderId)
    .eq("kind", "entrada")
    .maybeSingle();
  if (existing) return { created: false };

  const { error } = await db.from("finance_entries").insert({
    kind: "entrada",
    category: "Vendas",
    description: `Pedido #${order.order_number}`,
    amount_cents: order.total_cents,
    entry_date: brazilDay(order.paid_at ? new Date(order.paid_at) : new Date()),
    order_id: orderId,
  });
  // 23505 = outra chamada (webhook x retorno x cron) lançou primeiro; o índice único garante 1 só.
  if (error && error.code !== "23505") throw error;
  return { created: !error };
}

/**
 * Único ponto que grava o resultado de um pagamento no pedido. Webhook, página de
 * retorno e reconciliação passam por aqui, então o comportamento é idêntico.
 */
export async function applyPaymentToOrder(
  orderId: string,
  payment: PaymentResult,
  providerName: string,
) {
  const db = await adminDb();
  const { data: before } = await db
    .from("orders")
    .select("payment_status, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!before) return { found: false as const };

  const wasPaid = before.payment_status === "pago";
  // Evento atrasado ou duplicado não pode rebaixar um pedido já pago (só estorno).
  if (wasPaid && payment.status !== "pago" && payment.status !== "estornado") {
    return { found: true as const, status: "pago" as const, changed: false };
  }

  const updates: Record<string, unknown> = {
    payment_status: payment.status,
    payment_provider: providerName,
    provider_payment_id: payment.providerPaymentId,
    payment_method: payment.method ?? null,
    external_reference: payment.externalReference ?? orderId,
  };
  if (payment.status === "pago" && !before.paid_at) updates["paid_at"] = new Date().toISOString();
  const { error } = await db.from("orders").update(updates).eq("id", orderId);
  if (error) throw error;

  if (payment.status === "pago") {
    await recordSaleEntry(orderId);
    const { emitPlatesForOrder } = await import("@/lib/plate/emit.server");
    await emitPlatesForOrder(orderId);
    if (!wasPaid) {
      try {
        const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
        await dispatchOrderEmailEvent(orderId, "pagamento_confirmado");
      } catch (emailError) {
        console.error("Falha no e-mail de pagamento confirmado", { orderId, emailError });
      }
    }
  }

  return {
    found: true as const,
    status: payment.status,
    changed: before.payment_status !== payment.status,
  };
}

/**
 * Rede de segurança pra quando o webhook não chega: pergunta ao Mercado Pago o que
 * aconteceu com cada pedido em aberto e aplica. Roda no cron e ao abrir o painel.
 */
export async function reconcilePendingOrders(opts?: { maxAgeDays?: number; limit?: number }) {
  const { getPaymentProvider } = await import("./index");
  const provider = getPaymentProvider();
  if (!provider) return { checked: 0, settled: 0, skipped: "provider_not_configured" as const };

  const db = await adminDb();
  const since = new Date(Date.now() - (opts?.maxAgeDays ?? 14) * 86_400_000).toISOString();
  const { data: orders } = await db
    .from("orders")
    .select("id")
    .in("payment_status", ["pendente", "recusado"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 60);

  let settled = 0;
  for (const order of orders ?? []) {
    try {
      const payments = await provider.findPaymentsByReference(order.id);
      const best = payments.find((p) => p.status === "pago") ?? payments[0];
      if (!best) continue;
      const result = await applyPaymentToOrder(order.id, best, provider.name);
      if (result.found && result.status === "pago") settled++;
    } catch (error) {
      console.error("Reconciliação falhou para um pedido", { orderId: order.id, error });
    }
  }
  return { checked: orders?.length ?? 0, settled };
}
