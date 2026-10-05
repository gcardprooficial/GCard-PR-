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
        "customer_name, customer_email, customer_phone, customer_document, quantity, total_cents, ship_zip, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state, order_items(quantity, products(has_qr, is_blank))",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order?.ship_zip) return { ok: false as const, error: "Pedido sem endereço de entrega." };

    const items = (order.order_items ?? []) as { products?: { has_qr?: boolean; is_blank?: boolean } }[];
    const isPvc = items.length > 0 && items.every((i) => i.products?.has_qr === false && !i.products?.is_blank);
    const profile: "pvc" | "acrilico" = isPvc ? "pvc" : "acrilico";

    const { buyShippingLabel } = await import("./melhorenvio.server");
    // Valor declarado pra alfândega/seguro -- preço real médio por unidade do pedido.
    const unitaryValue = order.quantity > 0 ? order.total_cents / order.quantity / 100 : 0.01;
    const result = await buyShippingLabel({
      quoteId: data.quoteId,
      profile,
      quantity: order.quantity,
      unitaryValue,
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

// CEP central de cada capital: base de comparação por estado (interior costuma custar mais).
const UF_CEPS: Record<string, string> = {
  AC: "69900000", AL: "57010000", AP: "68900000", AM: "69005010", BA: "40020000", CE: "60025000", DF: "70040010",
  ES: "29010000", GO: "74003010", MA: "65010000", MT: "78005000", MS: "79002000", MG: "30130000", PA: "66010000",
  PB: "58010000", PR: "80010000", PE: "50010000", PI: "64000000", RJ: "20010000", RN: "59010000", RS: "90010000",
  RO: "76801000", RR: "69301000", SC: "88010000", SP: "01001000", SE: "49010000", TO: "77001000",
};

/** Só consulta preço (não gasta saldo): melhor Jadlog e melhor Correios por estado, pra 1 kit de placa e de cartão. */
export const getFreightByState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const { calculateFreight } = await import("./melhorenvio.server");
    type Cell = { jadlog: number | null; correios: number | null } | { error: string };
    const cheapest = (quotes: { company: string; priceCents: number }[], re: RegExp) => {
      const m = quotes.filter((q) => re.test(q.company)).map((q) => q.priceCents);
      return m.length ? Math.min(...m) : null;
    };
    const rows: { uf: string; acrilico: Cell; pvc: Cell }[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Sequencial + retry: em paralelo o Melhor Envio devolve 429 e vários estados vinham com erro.
    const one = async (uf: string, profile: "acrilico" | "pvc"): Promise<Cell> => {
      let last = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await calculateFreight({ destinationCep: UF_CEPS[uf]!, profile, quantity: 1, padForCorreios: true });
        if (r.ok) return { jadlog: cheapest(r.quotes, /jadlog/i), correios: cheapest(r.quotes, /correios/i) };
        last = r.error;
        await sleep(1200 * (attempt + 1));
      }
      return { error: last.slice(0, 140) };
    };
    for (const uf of Object.keys(UF_CEPS)) {
      rows.push({ uf, acrilico: await one(uf, "acrilico"), pvc: await one(uf, "pvc") });
      await sleep(300);
    }
    return { rows };
  });
