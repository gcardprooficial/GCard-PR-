import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

/** Marca o pedido como Pagar.me e devolve a página do Pix (o QR é gerado/recuperado lá). */
export const createPagarmeCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderNumber: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`pg-link:${clientKey(getRequest())}`, 15, 60_000)) return { ok: false as const, error: "too_many_attempts" };
    const { pagarmeConfigured, PAGARME } = await import("./pagarme.server");
    if (!pagarmeConfigured()) return { ok: false as const, error: "payment_provider_not_configured" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("id, payment_status").eq("order_number", data.orderNumber).maybeSingle();
    if (!order) return { ok: false as const, error: "order_not_found" };
    if (order.payment_status === "pago") return { ok: false as const, error: "already_paid" };
    await supabaseAdmin
      .from("orders")
      .update({ payment_provider: PAGARME, external_reference: order.id } as never)
      .eq("id", order.id)
      .eq("payment_status", "pendente");
    return { ok: true as const, url: `/pagamento/pix?ref=${order.id}` };
  });

/** Cartão: link de pagamento hospedado da Stone (só cartão). Devolve a URL pra redirecionar. */
export const createPagarmeCardCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderNumber: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`pg-card:${clientKey(getRequest())}`, 15, 60_000)) return { ok: false as const, error: "too_many_attempts" };
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
      console.error("createPagarmeCardCheckout falhou", { orderId: order.id, error });
      return { ok: false as const, error: "provider_error" };
    }
  });

/** Pix do pedido: reaproveita o QR pendente (ainda válido) ou cria um novo. */
export const getPagarmePix = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`pg-pix:${clientKey(getRequest())}`, 20, 60_000)) return { ok: false as const, error: "too_many_attempts" };
    const { createPagarmePix, findPagarmeOrdersByCode, pagarmeConfigured } = await import("./pagarme.server");
    if (!pagarmeConfigured()) return { ok: false as const, error: "payment_provider_not_configured" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total_cents, payment_status, customer_email, customer_name, customer_document, customer_phone, ship_zip, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state, order_items(product_name, quantity, unit_price_cents)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return { ok: false as const, error: "order_not_found" };
    if (order.payment_status === "pago") return { ok: false as const, error: "already_paid" };
    try {
      const now = Date.now();
      const live = (await findPagarmeOrdersByCode(order.id)).find((o) => {
        const t = o.charges?.[0]?.last_transaction;
        return o.status === "pending" && t?.qr_code && (!t.expires_at || new Date(t.expires_at).getTime() > now + 60_000);
      });
      const pg =
        live ??
        (await createPagarmePix({
          orderId: order.id,
          orderNumber: order.order_number,
          totalCents: order.total_cents,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerDocument: order.customer_document ?? null,
          customerPhone: order.customer_phone ?? null,
          items: ((order.order_items ?? []) as { product_name: string; quantity: number; unit_price_cents: number }[]).map((i) => ({
            name: i.product_name,
            quantity: i.quantity,
            unitCents: i.unit_price_cents,
          })),
          ship: {
            zip: order.ship_zip ?? null,
            street: order.ship_street ?? null,
            number: order.ship_number ?? null,
            complement: order.ship_complement ?? null,
            district: order.ship_district ?? null,
            city: order.ship_city ?? null,
            state: order.ship_state ?? null,
          },
        }));
      const t = pg.charges?.[0]?.last_transaction;
      if (!t?.qr_code) return { ok: false as const, error: "provider_error" };
      return {
        ok: true as const,
        orderNumber: order.order_number as number,
        totalCents: order.total_cents as number,
        qrCode: t.qr_code,
        qrUrl: t.qr_code_url ?? null,
        expiresAt: t.expires_at ?? null,
      };
    } catch (error) {
      console.error("getPagarmePix falhou", { orderId: order.id, error });
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
