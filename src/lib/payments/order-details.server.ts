/** Detalhes do pedido que todo gateway recebe (nome do produto, qtd, valor, endereço): reduz recusa por análise de risco e ajuda em disputa. */
export type OrderDetails = {
  phone: string | null;
  document: string | null;
  items: { name: string; quantity: number; unitCents: number }[];
  ship: { zip: string | null; street: string | null; number: string | null; complement: string | null; district: string | null; city: string | null; state: string | null };
};

export async function loadOrderDetails(orderId: string): Promise<OrderDetails> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: o } = await supabaseAdmin
    .from("orders")
    .select(
      "customer_phone, customer_document, ship_zip, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state, order_items(product_name, quantity, unit_price_cents)",
    )
    .eq("id", orderId)
    .maybeSingle();
  return {
    phone: o?.customer_phone ?? null,
    document: o?.customer_document ?? null,
    items: ((o?.order_items ?? []) as { product_name: string; quantity: number; unit_price_cents: number }[]).map((i) => ({
      name: i.product_name,
      quantity: i.quantity,
      unitCents: i.unit_price_cents,
    })),
    ship: {
      zip: o?.ship_zip ?? null,
      street: o?.ship_street ?? null,
      number: o?.ship_number ?? null,
      complement: o?.ship_complement ?? null,
      district: o?.ship_district ?? null,
      city: o?.ship_city ?? null,
      state: o?.ship_state ?? null,
    },
  };
}

/** Itens reais quando a soma bate com o total cobrado (cupom/desconto Pix fazem diferir); senão item único com a descrição. */
export function chargeItems(items: OrderDetails["items"], totalCents: number, orderNumber: number) {
  const sum = items.reduce((t, i) => t + i.unitCents * i.quantity, 0);
  if (items.length > 0 && sum === totalCents) return items.map((i) => ({ name: i.name.slice(0, 200), quantity: i.quantity, unitCents: i.unitCents }));
  const desc = `Pedido GCard-PRO #${orderNumber}` + (items.length ? `: ${items.map((i) => `${i.quantity}x ${i.name}`).join("; ")}` : "");
  return [{ name: desc.slice(0, 200), quantity: 1, unitCents: totalCents }];
}

/** Telefone BR só com dígitos (sem 55), ou null se inválido. */
export function brPhone(raw: string | null) {
  let p = (raw ?? "").replace(/\D/g, "");
  if (p.startsWith("55") && p.length > 11) p = p.slice(2);
  return p.length === 10 || p.length === 11 ? p : null;
}
