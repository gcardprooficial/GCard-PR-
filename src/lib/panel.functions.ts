import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertTeam(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "staff"]);
  if (error) throw error;
  if (!data?.length) throw new Error("Sem permissão para esta ação.");
}

const orderIdSchema = z.object({
  orderId: z.string().uuid(),
});

/** Marca pedido como pago (manual, sem Mercado Pago) e emite placas/lote. */
export const confirmOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { emitPlatesForOrder } = await import("@/lib/plate/emit.server");

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!order) throw new Error("Pedido não encontrado.");

    if (order.payment_status !== "pago") {
      const { error: updError } = await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "pago",
          payment_provider: "manual",
          payment_method: "manual",
          paid_at: new Date().toISOString(),
        })
        .eq("id", data.orderId);
      if (updError) throw updError;
    }

    const { recordSaleEntry } = await import("@/lib/payments/settle.server");
    await recordSaleEntry(data.orderId);
    const emitted = await emitPlatesForOrder(data.orderId);
    return { ok: true as const, ...emitted };
  });

const orderEmailSchema = z.object({
  orderId: z.string().uuid(),
  event: z.enum(["pagamento_confirmado", "lote_criado", "em_producao", "pedido_entregue"]),
});

/** Dispara um e-mail de status do pedido pro cliente (idempotente -- não duplica se já foi enviado). */
export const sendOrderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    // "Pago" marcado à mão no painel também precisa cair no Financeiro.
    if (data.event === "pagamento_confirmado") {
      const { recordSaleEntry } = await import("@/lib/payments/settle.server");
      await recordSaleEntry(data.orderId);
    }
    const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
    return dispatchOrderEmailEvent(data.orderId, data.event);
  });

/** Pergunta ao Mercado Pago o que aconteceu com os pedidos em aberto (webhook que não chegou). */
export const reconcileOrdersNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const { reconcilePendingOrders } = await import("@/lib/payments/settle.server");
    return reconcilePendingOrders({ limit: 40 });
  });

/** Gera uma nova preferência e envia o link do Mercado Pago por e-mail. */
export const sendPaymentLinkEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { getPaymentProvider } = await import("@/lib/payments");
    const provider = getPaymentProvider();
    if (!provider) throw new Error("Mercado Pago não está configurado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total_cents, quantity, customer_email, customer_name")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado.");

    const origin = process.env["PUBLIC_APP_URL"] ?? "https://gcardpro.com.br";
    const preference = await provider.createPreference({ order: order as any, origin });
    const { sendPaymentLinkEmail: sendEmail } = await import("@/lib/email-events.server");
    const result = await sendEmail(order, preference.url);
    if (!result.sent) throw new Error("RESEND_API_KEY não está configurada para enviar e-mails.");
    return { ok: true as const };
  });

const trackingSchema = z.object({
  orderId: z.string().uuid(),
  trackingCode: z.string().trim().max(120).nullable(),
});

export const saveOrderTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => trackingSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: order, error: fetchError } = await db
      .from("orders")
      .select("tracking_code")
      .eq("id", data.orderId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!order) throw new Error("Pedido não encontrado.");
    const trackingCode = data.trackingCode || null;
    const { error } = await db
      .from("orders")
      .update({
        tracking_code: trackingCode,
        ...(trackingCode
          ? { fulfillment_status: "enviado", shipped_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", data.orderId);
    if (error) throw error;
    if (trackingCode && order.tracking_code !== trackingCode) {
      const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
      await dispatchOrderEmailEvent(data.orderId, "pedido_enviado");
    }
    return { ok: true as const };
  });
