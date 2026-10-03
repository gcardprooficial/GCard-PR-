import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { unitPriceForQuantity } from "@/lib/pricing";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const GOOGLE_HOSTS = [
  "search.google.com",
  "www.google.com",
  "google.com",
  "maps.google.com",
  "g.page",
];

/** Normalizes a pasted Google link into a review URL + place id when possible. */
export function parseGoogleReviewLink(
  raw: string,
): { reviewUrl: string; placeId: string | null } | null {
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

const returningCustomerSchema = z.object({
  email: z.string().trim().email().max(160),
  document: z.string().trim().max(20),
});

/** Já comprou (pago) antes com esse e-mail ou CPF/CNPJ? Se sim, o tutorial de QR/NFC
 * no checkout não precisa aparecer de novo. */
export const checkReturningCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => returningCustomerSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const docDigits = data.document.replace(/\D/g, "");
    const byEmail = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_status", "pago")
      .ilike("customer_email", data.email.trim())
      .limit(1);
    if ((byEmail.data?.length ?? 0) > 0) return { returning: true };
    if (!docDigits) return { returning: false };
    // customer_document é salvo do jeito que a pessoa digitou (com ou sem pontuação) --
    // tenta os dois formatos mais comuns pra não perder um cliente antigo real.
    const formatted =
      docDigits.length === 11
        ? docDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
        : docDigits.length === 14
          ? docDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
          : null;
    const byDoc = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_status", "pago")
      .in("customer_document", formatted ? [docDigits, formatted] : [docDigits])
      .limit(1);
    return { returning: (byDoc.data?.length ?? 0) > 0 };
  });

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
  /** Cor escolhida (só acrílico puro tem). Vai no nome do item pra produção saber o que separar. */
  colorSlug: z.string().trim().max(40).optional().nullable(),
  quantity: z.number().int().min(1).max(500),
  teamSize: z.string().trim().max(40).optional().nullable(),
  marketingConsent: z.boolean().default(false),
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

/** Resolve produto+preço de UMA linha do pedido -- nunca confia no preço vindo do navegador.
 * Compartilhado entre pedido de 1 item e carrinho de vários, pra não duplicar a conta. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOrderLine(
  supabaseAdmin: any,
  input: { planSlug: string; productSlug: string; colorSlug?: string | null | undefined; quantity: number },
) {
  const [{ data: plan }, { data: product }] = await Promise.all([
    supabaseAdmin
      .from("plans")
      .select("id, name, slug, unit_price_cents, min_quantity, max_quantity, is_active, is_resale")
      .eq("slug", input.planSlug)
      .maybeSingle(),
    supabaseAdmin
      .from("products")
      .select(
        "id, name, slug, price_delta_cents, resale_delta_cents, status, is_blank, min_quantity, color_variants, nfc_addon_price_cents",
      )
      .eq("slug", input.productSlug)
      .maybeSingle(),
  ]);

  if (!plan || !plan.is_active) throw new Error("Plano indisponível.");
  if (!product || product.status !== "ativo") throw new Error(`Produto "${input.productSlug}" indisponível no momento.`);
  const prod = product as typeof product & {
    is_blank?: boolean;
    min_quantity?: number;
    color_variants?: { slug: string; name: string; delta_cents: number }[] | null;
  };
  if (prod.min_quantity && input.quantity < prod.min_quantity) {
    throw new Error(`${product.name} é vendido em kit de ${prod.min_quantity} unidades ou mais.`);
  }
  if (input.quantity < plan.min_quantity) throw new Error("Quantidade abaixo do mínimo do plano.");
  if (plan.max_quantity && input.quantity > plan.max_quantity) {
    throw new Error("Quantidade acima do máximo do plano.");
  }

  const [{ data: tiers }, { data: productTiers }] = await Promise.all([
    supabaseAdmin
      .from("plan_price_tiers")
      .select("min_quantity, unit_price_cents, label")
      .eq("plan_id", plan.id),
    plan.is_resale || prod.is_blank
      ? supabaseAdmin.from("product_price_tiers").select("min_quantity, unit_price_cents, label").eq("product_id", product.id)
      : Promise.resolve({ data: null }),
  ]);

  const colorVariant = input.colorSlug
    ? (prod.color_variants ?? []).find((c: { slug: string }) => c.slug === input.colorSlug)
    : null;
  if (input.colorSlug && !colorVariant) throw new Error("Cor indisponível para este produto.");
  const colorDelta = colorVariant?.delta_cents ?? 0;

  let unitPrice: number;
  if ((plan.is_resale || prod.is_blank) && productTiers && productTiers.length > 0) {
    unitPrice = unitPriceForQuantity(productTiers, input.quantity, productTiers[0].unit_price_cents) + colorDelta;
  } else {
    const tierPrice = unitPriceForQuantity(tiers ?? [], input.quantity, plan.unit_price_cents);
    const delta = plan.is_resale ? product.resale_delta_cents : product.price_delta_cents;
    unitPrice = tierPrice + delta + colorDelta;
  }

  return {
    plan,
    product,
    productName: colorVariant ? `${product.name} — ${colorVariant.name}` : `${product.name} — ${plan.name}`,
    unitPrice,
    subtotal: unitPrice * input.quantity,
  };
}

export const createPendingOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`order:${data.customer.email.toLowerCase()}`, 5, 300_000)) {
      throw new Error("Muitos pedidos seguidos com este e-mail. Aguarde alguns minutos.");
    }
    const ip = clientKey(getRequest());
    if (!rateLimit(`order-ip:${ip}`, 10, 300_000)) {
      throw new Error("Muitos pedidos seguidos. Aguarde alguns minutos.");
    }

    const parsedLink = data.business ? resolveReviewUrl(data.business) : null;
    if (data.business && !parsedLink) {
      throw new Error("Não conseguimos identificar o negócio no Google.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { plan, product, productName, unitPrice, subtotal } = await resolveOrderLine(supabaseAdmin, {
      planSlug: data.planSlug,
      productSlug: data.productSlug,
      colorSlug: data.colorSlug,
      quantity: data.quantity,
    });

    let businessId: string | null = null;
    if (data.business && parsedLink) {
      try {
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
      } catch (error) {
        // O cadastro do negócio é auxiliar. Não bloqueie o pedido/pagamento se
        // houver uma constraint ou divergência de migração nessa tabela.
        console.error("createPendingOrder: falha ao salvar negócio", { error });
      }
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
        marketing_consent_at: data.marketingConsent ? new Date().toISOString() : null,
      } as never)
      .select("id, order_number")
      .single();
    if (orderError) throw orderError;

    const { error: itemError } = await supabaseAdmin.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_name: productName,
      quantity: data.quantity,
      unit_price_cents: unitPrice,
      total_cents: subtotal,
    });
    if (itemError) throw itemError;

    // Consentimento e e-mail são efeitos secundários. Uma falha neles não pode
    // desfazer nem mascarar um pedido já gravado.
    try {
      const { upsertCustomerConsent } = await import("@/lib/email-events.server");
      await upsertCustomerConsent({
        email: data.customer.email,
        name: `${data.customer.firstName} ${data.customer.lastName}`.trim(),
        consent: data.marketingConsent,
      });
    } catch (error) {
      console.error("createPendingOrder: falha ao salvar consentimento", {
        orderId: order.id,
        error,
      });
    }

    try {
      const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
      await dispatchOrderEmailEvent(order.id, "pedido_recebido");
    } catch (error) {
      console.error("createPendingOrder: falha ao registrar e-mail do pedido", {
        orderId: order.id,
        error,
      });
    }

    return {
      orderNumber: order.order_number,
      totalCents: subtotal,
      unitPriceCents: unitPrice,
      quantity: data.quantity,
    };
  });

const cartOrderSchema = z.object({
  business: businessSchema.nullable().optional(),
  planSlug: z.string().trim().min(2).max(60),
  items: z
    .array(
      z.object({
        productSlug: z.string().trim().min(2).max(60),
        colorSlug: z.string().trim().max(40).optional().nullable(),
        quantity: z.number().int().min(1).max(500),
        nfcAddonQty: z.number().int().min(0).max(500).optional(),
      }),
    )
    .min(1)
    .max(20),
  marketingConsent: z.boolean().default(false),
  /** Cupom do parceiro (link /c/{code}). Só o código -- % e valores vêm do banco. */
  couponCode: z.string().trim().max(40).optional().nullable(),
  customer: orderSchema.shape.customer,
  address: orderSchema.shape.address,
});

/** Carrinho: vários produtos no mesmo pedido, sempre do mesmo plano (lojista OU revenda --
 * decisão de negócio: não mistura os dois, cada um tem regra de preço/lote própria). */
export const createCartOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => cartOrderSchema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`order:${data.customer.email.toLowerCase()}`, 5, 300_000)) {
      throw new Error("Muitos pedidos seguidos com este e-mail. Aguarde alguns minutos.");
    }
    const ip = clientKey(getRequest());
    if (!rateLimit(`order-ip:${ip}`, 10, 300_000)) {
      throw new Error("Muitos pedidos seguidos. Aguarde alguns minutos.");
    }

    const parsedLink = data.business ? resolveReviewUrl(data.business) : null;
    if (data.business && !parsedLink) {
      throw new Error("Não conseguimos identificar o negócio no Google.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cada linha é recalculada e validada do zero -- preço nunca vem do navegador.
    const lines = await Promise.all(
      data.items.map((item) =>
        resolveOrderLine(supabaseAdmin, {
          planSlug: data.planSlug,
          productSlug: item.productSlug,
          colorSlug: item.colorSlug,
          quantity: item.quantity,
        }).then((resolved) => ({ ...resolved, quantity: item.quantity, nfcAddonQty: item.nfcAddonQty ?? 0 })),
      ),
    );

    // Chip NFC avulso só é permitido no acrílico liso (is_blank) -- nunca confia na quantidade do navegador.
    for (const line of lines) {
      if (line.nfcAddonQty > 0 && !(line.product as { is_blank?: boolean }).is_blank) {
        throw new Error(`Chip NFC avulso não disponível para "${line.product.name}".`);
      }
    }
    const addonUnitCents = (product: { nfc_addon_price_cents?: number | null }) =>
      product.nfc_addon_price_cents ?? 0;
    const addonTotalCents = lines.reduce((s, l) => s + l.nfcAddonQty * addonUnitCents(l.product), 0);

    const isResale = lines[0]!.plan.is_resale;
    const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0);
    const grossCents = lines.reduce((s, l) => s + l.subtotal, 0) + addonTotalCents;
    const { resolveOrderCoupon } = await import("@/lib/affiliates.server");
    const coupon = await resolveOrderCoupon(data.couponCode, data.customer, grossCents);
    const totalCents = coupon?.totalCents ?? grossCents;

    let businessId: string | null = null;
    if (data.business && parsedLink) {
      try {
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
      } catch (error) {
        console.error("createCartOrder: falha ao salvar negócio", { error });
      }
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        kind: isResale ? "revenda" : "individual",
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
        plan_id: lines[0]!.plan.id,
        quantity: totalQuantity,
        subtotal_cents: grossCents,
        shipping_cents: 0,
        total_cents: totalCents,
        affiliate_id: coupon?.affiliate.id ?? null,
        coupon_code: coupon?.affiliate.code ?? null,
        coupon_discount_cents: coupon?.discountCents ?? 0,
        affiliate_commission_pct: coupon?.affiliate.commission_pct ?? null,
        marketing_consent_at: data.marketingConsent ? new Date().toISOString() : null,
      } as never)
      .select("id, order_number")
      .single();
    if (orderError) throw orderError;

    const addonItems = lines
      .filter((l) => l.nfcAddonQty > 0)
      .map((l) => ({
        order_id: order.id,
        product_id: null,
        product_name: "Chip NFC avulso (tag)",
        quantity: l.nfcAddonQty,
        unit_price_cents: addonUnitCents(l.product),
        total_cents: l.nfcAddonQty * addonUnitCents(l.product),
      }));

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert([
      ...lines.map((line) => ({
        order_id: order.id,
        product_id: line.product.id,
        product_name: line.productName,
        quantity: line.quantity,
        unit_price_cents: line.unitPrice,
        total_cents: line.subtotal,
      })),
      ...addonItems,
    ]);
    if (itemsError) throw itemsError;

    try {
      const { upsertCustomerConsent } = await import("@/lib/email-events.server");
      await upsertCustomerConsent({
        email: data.customer.email,
        name: `${data.customer.firstName} ${data.customer.lastName}`.trim(),
        consent: data.marketingConsent,
      });
    } catch (error) {
      console.error("createCartOrder: falha ao salvar consentimento", { orderId: order.id, error });
    }

    try {
      const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
      await dispatchOrderEmailEvent(order.id, "pedido_recebido");
    } catch (error) {
      console.error("createCartOrder: falha ao registrar e-mail do pedido", { orderId: order.id, error });
    }

    if (addonTotalCents > 0) {
      const totalAddonQty = lines.reduce((s, l) => s + l.nfcAddonQty, 0);
      try {
        await supabaseAdmin.from("component_stock_entries").insert({
          name: "Chip NFC avulso",
          quantity: -totalAddonQty,
          note: `Venda no checkout - pedido #${order.order_number}`,
        } as never);
      } catch (error) {
        console.error("createCartOrder: falha ao dar baixa no estoque de chip NFC", { orderId: order.id, error });
      }
    }

    return {
      orderNumber: order.order_number,
      totalCents,
      couponCode: coupon?.affiliate.code ?? null,
      couponDiscountCents: coupon?.discountCents ?? 0,
    };
  });
