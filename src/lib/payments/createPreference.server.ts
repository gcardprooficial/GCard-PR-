import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  orderNumber: z.number().int().positive(),
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
      .select("id, order_number, total_cents, quantity, customer_email, customer_name")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) {
      return { ok: false as const, error: "order_not_found" };
    }

    const orderForCheckout = {
      id: order.id,
      order_number: order.order_number,
      total_cents: order.total_cents,
      quantity: order.quantity,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
    };

    const origin = process.env["PUBLIC_APP_URL"] ?? "https://gcardpro.com.br";
    const pref = await provider.createPreference({ order: orderForCheckout as any, origin });
    return { ok: true as const, url: pref.url, reference: pref.reference };
  });
