import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

/** Gera o link de pagamento da InfinitePay (alternativa ao Mercado Pago). */
export const createInfinitePayCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderNumber: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`ip-link:${clientKey(getRequest())}`, 15, 60_000)) return { ok: false as const, error: "rate_limited" };
    const { createInfinitePayLink, infinitePayHandle, INFINITEPAY } = await import("./infinitepay.server");
    if (!infinitePayHandle()) return { ok: false as const, error: "payment_provider_not_configured" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total_cents, payment_status, customer_email, customer_name")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) return { ok: false as const, error: "order_not_found" };
    if (order.payment_status === "pago") return { ok: false as const, error: "already_paid" };
    try {
      const { loadOrderDetails } = await import("./order-details.server");
      const url = await createInfinitePayLink({
        details: await loadOrderDetails(order.id),
        orderId: order.id,
        orderNumber: order.order_number,
        totalCents: order.total_cents,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        origin: process.env["PUBLIC_APP_URL"] ?? "https://gcardpro.com.br",
      });
      await supabaseAdmin
        .from("orders")
        .update({ payment_provider: INFINITEPAY, external_reference: order.id } as never)
        .eq("id", order.id)
        .eq("payment_status", "pendente");
      return { ok: true as const, url };
    } catch (error) {
      console.error("createInfinitePayCheckout falhou", { orderId: order.id, error });
      return { ok: false as const, error: "provider_error" };
    }
  });

/** Página de retorno: a InfinitePay volta com order_nsu, transaction_nsu e slug; tudo é reconferido na API deles. */
export const verifyInfinitePayReturn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        transactionNsu: z.string().min(8).max(80),
        slug: z.string().min(3).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!rateLimit(`ip-return:${clientKey(getRequest())}`, 20, 60_000)) return { ok: false as const, reason: "rate_limited" as const };
    const { settleInfinitePay } = await import("./infinitepay.server");
    return settleInfinitePay({ orderId: data.orderId, transactionNsu: data.transactionNsu, slug: data.slug });
  });
