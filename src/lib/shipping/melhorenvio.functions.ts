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
  AC: "69900076", AL: "57010000", AP: "68900073", AM: "69005010", BA: "40343470", CE: "60025000", DF: "70040010",
  ES: "29010001", GO: "74003010", MA: "65010000", MT: "78005000", MS: "79002000", MG: "30130000", PA: "66010000",
  PB: "58010000", PR: "80010000", PE: "50010000", PI: "64000590", RJ: "20010000", RN: "59010000", RS: "90010000",
  RO: "76801000", RR: "69301000", SC: "88010000", SP: "01001000", SE: "49010000", TO: "77006014",
};

export const FREIGHT_UFS = Object.keys(UF_CEPS);

/** Só consulta preço (não gasta saldo): melhor Jadlog e melhor Correios de UM estado, pra 1 kit de placa e de cartão. A tela chama um estado por vez (uma chamada só pra todos estoura o tempo da função). */
export const getFreightForState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ uf: z.string().length(2) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const cep = UF_CEPS[data.uf];
    if (!cep) throw new Error("UF inválida.");
    const { calculateFreight } = await import("./melhorenvio.server");
    type Cell = { jadlog: number | null; correios: number | null } | { error: string };
    const cheapest = (quotes: { company: string; priceCents: number }[], re: RegExp) => {
      const m = quotes.filter((q) => re.test(q.company)).map((q) => q.priceCents);
      return m.length ? Math.min(...m) : null;
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const one = async (profile: "acrilico" | "pvc"): Promise<Cell> => {
      let last = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await calculateFreight({ destinationCep: cep, profile, quantity: 1, padForCorreios: true });
        if (r.ok) return { jadlog: cheapest(r.quotes, /jadlog/i), correios: cheapest(r.quotes, /correios/i) };
        last = r.error;
        await sleep(1500);
      }
      return { error: last.slice(0, 140) };
    };
    return { uf: data.uf, acrilico: await one("acrilico"), pvc: await one("pvc") };
  });

/** Mesma comparação na SuperFrete: preço mais barato (qualquer serviço) de 1 kit de placa e de 1 de cartão. Só consulta. */
export const getSuperFreteForState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ uf: z.string().length(2) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const cep = UF_CEPS[data.uf];
    if (!cep) throw new Error("UF inválida.");
    const { calculateSuperFrete, superFreteConfigured } = await import("./superfrete.server");
    type SfCell = { cents: number | null; service: string | null } | { error: string };
    if (!superFreteConfigured()) {
      const error = "falta SUPERFRETE_TOKEN";
      return { uf: data.uf, acrilico: { error } as SfCell, pvc: { error } as SfCell };
    }
    // Mesmas medidas de 1 kit usadas no Melhor Envio (e o mínimo de 16x11x2 cm dos Correios).
    const profiles = {
      acrilico: { heightCm: 4, widthCm: 11, lengthCm: 16, weightKg: 0.5 },
      pvc: { heightCm: 2, widthCm: 11, lengthCm: 16, weightKg: 0.3 },
    };
    const one = async (p: keyof typeof profiles): Promise<SfCell> => {
      const r = await calculateSuperFrete({ destinationCep: cep, ...profiles[p] });
      if (!r.ok) return { error: r.error.slice(0, 140) };
      const q = r.quotes[0];
      return { cents: q?.priceCents ?? null, service: q?.name ?? null };
    };
    return { uf: data.uf, acrilico: await one("acrilico"), pvc: await one("pvc") };
  });
