import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PIX_DISCOUNT_PCT, pixDiscountActive } from "@/lib/promo";

const schema = z.object({
  orderNumber: z.number().int().positive(),
  pixDiscount: z.boolean().optional(),
});

export const createCheckoutPreference = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { getPaymentProvider } = await import("@/lib/payments");
    const provider = getPaymentProvider();
    if (!provider) {
      return { ok: false as const, error: "payment_provider_not_configured" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, total_cents, subtotal_cents, quantity, payment_status, customer_email, customer_name, customer_document, pix_discount_applied",
      )
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) {
      return { ok: false as const, error: "order_not_found" };
    }

    // Desconto real e idempotente: só aplica se o pedido ainda tá pendente, a promoção
    // ainda vale, e esse pedido nunca recebeu o desconto antes -- sem isso, gerar o link
    // de novo (ex.: link expirou) reduziria o preço 5% a cada tentativa.
    let totalCents = order.total_cents;
    const applyPixDiscount = Boolean(
      data.pixDiscount && pixDiscountActive() && order.payment_status === "pendente" && !order.pix_discount_applied,
    );
    if (applyPixDiscount) {
      totalCents = Math.round(order.total_cents * (1 - PIX_DISCOUNT_PCT / 100));
      await supabaseAdmin
        .from("orders")
        .update({
          total_cents: totalCents,
          subtotal_cents: totalCents,
          pix_discount_applied: true,
        } as never)
        .eq("id", order.id)
        .eq("payment_status", "pendente");
    }

    const orderForCheckout = {
      id: order.id,
      order_number: order.order_number,
      total_cents: totalCents,
      quantity: order.quantity,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      customer_document: order.customer_document ?? null,
    };

    const origin = process.env["PUBLIC_APP_URL"] ?? "https://gcardpro.com.br";

    // Instabilidade passageira na API do Mercado Pago acontece -- tenta mais
    // duas vezes antes de deixar o comprador travado sem link.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const pref = await provider.createPreference({
          order: orderForCheckout as any,
          origin,
          pixOnly: applyPixDiscount,
        });
        // Marca "link gerado": o painel usa isso pra separar quem só não pagou de quem nem recebeu link.
        await supabaseAdmin
          .from("orders")
          .update({ payment_provider: provider.name, external_reference: order.id } as never)
          .eq("id", order.id)
          .eq("payment_status", "pendente");
        return { ok: true as const, url: pref.url, reference: pref.reference };
      } catch (error) {
        lastError = error;
      }
    }

    console.error("createCheckoutPreference: falhou após 3 tentativas", {
      orderId: order.id,
      lastError,
    });
    const { notifyAdminPaymentFailure } = await import("@/lib/email-events.server");
    await notifyAdminPaymentFailure(order);
    return { ok: false as const, error: "provider_error" };
  });
