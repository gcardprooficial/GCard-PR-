import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { unitPriceForQuantity } from "@/lib/pricing";
import { rateLimit } from "@/lib/rateLimit";

const GOOGLE_HOSTS = ["search.google.com", "www.google.com", "google.com", "maps.google.com", "g.page"];

/** Normalizes a pasted Google link into a review URL + place id when possible. */
export function parseGoogleReviewLink(raw: string): { reviewUrl: string; placeId: string | null } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!GOOGLE_HOSTS.includes(url.hostname)) return null;

  const placeId = url.searchParams.get("placeid") ?? url.searchParams.get("place_id");
  if (placeId) {
    return {
      reviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`,
      placeId,
    };
  }
  return { reviewUrl: url.toString(), placeId: null };
}

const businessSchema = z.object({
  name: z.string().trim().min(2).max(160),
  placeId: z.string().trim().min(4).max(400).optional().nullable(),
  link: z.string().trim().max(2000).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
});

/** Resolve o link final de avaliação a partir do Place ID ou de um link colado. */
function resolveReviewUrl(business: z.infer<typeof businessSchema>) {
  if (business.placeId) {
    return {
      reviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(business.placeId)}`,
      placeId: business.placeId,
    };
  }
  if (business.link) return parseGoogleReviewLink(business.link);
  return null;
}

export const validateBusinessLink = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => businessSchema.parse(input))
  .handler(async ({ data }) => {
    const parsed = resolveReviewUrl(data);
    if (!parsed) {
      return {
        ok: false as const,
        error:
          "Não conseguimos identificar esse negócio no Google. Busque pelo nome ou cole o link de avaliação.",
      };
    }
    return { ok: true as const, reviewUrl: parsed.reviewUrl, placeId: parsed.placeId };
  });

const orderSchema = z.object({
  business: businessSchema.nullable().optional(),
  planSlug: z.string().trim().min(2).max(60),
  productSlug: z.string().trim().min(2).max(60),
  quantity: z.number().int().min(1).max(500),
  teamSize: z.string().trim().max(40).optional().nullable(),
  customer: z.object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(1).max(60),
    document: z.string().trim().min(11).max(20),
    phone: z.string().trim().min(10).max(20),
    email: z.string().trim().email().max(160),
  }),
  address: z.object({
    zip: z.string().trim().min(8).max(12),
    street: z.string().trim().min(3).max(160),
    number: z.string().trim().min(1).max(20),
    complement: z.string().trim().max(80).optional().nullable(),
    district: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(40),
  }),
});

export const createPendingOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`order:${data.customer.email.toLowerCase()}`, 5, 300_000)) {
      throw new Error("Muitos pedidos seguidos com este e-mail. Aguarde alguns minutos.");
    }

    const parsedLink = data.business ? resolveReviewUrl(data.business) : null;
    if (data.business && !parsedLink) {
      throw new Error("Não conseguimos identificar o negócio no Google.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: plan }, { data: product }] = await Promise.all([
      supabaseAdmin
        .from("plans")
        .select("id, name, slug, unit_price_cents, min_quantity, max_quantity, is_active, is_resale")
        .eq("slug", data.planSlug)
        .maybeSingle(),
      supabaseAdmin
        .from("products")
        .select("id, name, slug, price_delta_cents, status")
        .eq("slug", data.productSlug)
        .maybeSingle(),
    ]);

    if (!plan || !plan.is_active) throw new Error("Plano indisponível.");
    if (!product || product.status !== "ativo") throw new Error("Produto indisponível.");
    if (data.quantity < plan.min_quantity) throw new Error("Quantidade abaixo do mínimo do plano.");
    if (plan.max_quantity && data.quantity > plan.max_quantity) {
      throw new Error("Quantidade acima do máximo do plano.");
    }

    const { data: tiers } = await supabaseAdmin
      .from("plan_price_tiers")
      .select("min_quantity, unit_price_cents, label")
      .eq("plan_id", plan.id);

    // Price is always recomputed here — never trusted from the browser.
    const tierPrice = unitPriceForQuantity(tiers ?? [], data.quantity, plan.unit_price_cents);
    const unitPrice = tierPrice + product.price_delta_cents;
    const subtotal = unitPrice * data.quantity;

    let businessId: string | null = null;
    if (data.business && parsedLink) {
      const { data: business, error: businessError } = await supabaseAdmin
        .from("businesses")
        .insert({
          name: data.business.name,
          review_url: parsedLink.reviewUrl,
          google_place_id: parsedLink.placeId,
          address: data.business.address ?? null,
        })
        .select("id")
        .single();
      if (businessError) throw businessError;
      businessId = business.id;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        kind: plan.is_resale ? "revenda" : "individual",
        customer_name: `${data.customer.firstName} ${data.customer.lastName}`.trim(),
        customer_email: data.customer.email,
        customer_phone: data.customer.phone,
        customer_document: data.customer.document,
        ship_zip: data.address.zip,
        ship_street: data.address.street,
        ship_number: data.address.number,
        ship_complement: data.address.complement ?? null,
        ship_district: data.address.district,
        ship_city: data.address.city,
        ship_state: data.address.state,
        business_id: businessId,
        plan_id: plan.id,
        quantity: data.quantity,
        subtotal_cents: subtotal,
        shipping_cents: 0,
        total_cents: subtotal,
      })
      .select("id, order_number")
      .single();
    if (orderError) throw orderError;

    const { error: itemError } = await supabaseAdmin.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_name: `${product.name} — ${plan.name}`,
      quantity: data.quantity,
      unit_price_cents: unitPrice,
      total_cents: subtotal,
    });
    if (itemError) throw itemError;

    return {
      orderNumber: order.order_number,
      totalCents: subtotal,
      unitPriceCents: unitPrice,
      quantity: data.quantity,
    };
  });
