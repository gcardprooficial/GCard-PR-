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

export const getMelhorEnvioConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const { getConnectUrl } = await import("./melhorenvio.server");
    return { url: await getConnectUrl() };
  });

export const getMelhorEnvioStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const { getConnectionStatus } = await import("./melhorenvio.server");
    return getConnectionStatus();
  });

export const testMelhorEnvioConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const { testConnection } = await import("./melhorenvio.server");
    return testConnection();
  });

const quoteSchema = z.object({ orderId: z.string().uuid() });

export const getOrderFreightQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quoteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: order } = await db
      .from("orders")
      .select("ship_zip, quantity, order_items(quantity, products(has_qr, is_blank))")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order?.ship_zip) return { ok: false as const, error: "Pedido sem CEP de entrega." };

    // Cartão de bolso (PVC) é a única coisa sem QR e sem ser acrílico puro; todo o resto
    // (placa 10x10, acrílico sem arte) usa o perfil de embalagem do acrílico.
    const items = (order.order_items ?? []) as { products?: { has_qr?: boolean; is_blank?: boolean } }[];
    const isPvc = items.length > 0 && items.every((i) => i.products?.has_qr === false && !i.products?.is_blank);
    const profile: "pvc" | "acrilico" = isPvc ? "pvc" : "acrilico";

    const { calculateFreight } = await import("./melhorenvio.server");
    return calculateFreight({ destinationCep: order.ship_zip, profile, quantity: order.quantity });
  });

const buySchema = z.object({ orderId: z.string().uuid(), quoteId: z.number() });

export const buyOrderShippingLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => buySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: order } = await db
      .from("orders")
      .select(
        "customer_name, customer_email, customer_phone, customer_document, quantity, ship_zip, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state, order_items(quantity, products(has_qr, is_blank))",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order?.ship_zip) return { ok: false as const, error: "Pedido sem endereço de entrega." };

    const items = (order.order_items ?? []) as { products?: { has_qr?: boolean; is_blank?: boolean } }[];
    const isPvc = items.length > 0 && items.every((i) => i.products?.has_qr === false && !i.products?.is_blank);
    const profile: "pvc" | "acrilico" = isPvc ? "pvc" : "acrilico";

    const { buyShippingLabel } = await import("./melhorenvio.server");
    const result = await buyShippingLabel({
      quoteId: data.quoteId,
      profile,
      quantity: order.quantity,
      destination: {
        name: order.customer_name,
        document: order.customer_document,
        phone: order.customer_phone,
        email: order.customer_email,
        street: order.ship_street,
        number: order.ship_number,
        complement: order.ship_complement,
        district: order.ship_district,
        city: order.ship_city,
        stateAbbr: order.ship_state,
        postalCode: order.ship_zip,
      },
    });
    if (!result.ok) return result;

    const { error } = await db
      .from("orders")
      .update({
        tracking_code: result.trackingCode,
        tracking_carrier: result.carrier,
        fulfillment_status: "enviado",
        shipped_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);
    if (error) throw error;

    return result;
  });
