import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

/** Gera o link de pagamento da Pagar.me (Stone): Pix + cartão. */
export const createPagarmeCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderNumber: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`pg-link:${clientKey(getRequest())}`, 15, 60_000)) return { ok: false as const, error: "too_many_attempts" };
    const { createPagarmeLink, pagarmeConfigured, PAGARME } = await import("./pagarme.server");
    if (!pagarmeConfigured()) return { ok: false as const, error: "payment_provider_not_configured" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total_cents, payment_status, customer_email, customer_name, customer_document")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) return { ok: false as const, error: "order_not_found" };
    if (order.payment_status === "pago") return { ok: false as const, error: "already_paid" };
    try {
      const { url } = await createPagarmeLink({
        orderId: order.id,
        orderNumber: order.order_number,
        totalCents: order.total_cents,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerDocument: order.customer_document ?? null,
        origin: process.env["PUBLIC_APP_URL"] ?? "https://gcardpro.com.br",
      });
      await supabaseAdmin
        .from("orders")
        .update({ payment_provider: PAGARME, external_reference: order.id } as never)
        .eq("id", order.id)
        .eq("payment_status", "pendente");
      return { ok: true as const, url };
    } catch (error) {
      console.error("createPagarmeCheckout falhou", { orderId: order.id, error });
      return { ok: false as const, error: "provider_error" };
    }
  });

/** Página de retorno: o cliente volta com ?gw=pagarme&ref=<id do pedido>. O status real vem da API da Pagar.me. */
export const verifyPagarmeReturn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`pg-return:${clientKey(getRequest())}`, 20, 60_000)) return { ok: false as const, reason: "rate_limited" as const };
    const { findPagarmeOrdersByCode, settlePagarmeOrder } = await import("./pagarme.server");
    const orders = await findPagarmeOrdersByCode(data.orderId);
    const best = orders.find((o) => o.status === "paid") ?? orders[0];
    if (!best) return { ok: true as const, status: "pendente" as const, orderNumber: null as number | null };
    return settlePagarmeOrder(best, data.orderId);
  });
