import { queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/lib/catalog.functions";
import { resolveTiersForProduct } from "@/lib/pricing";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";
import produtoPlaquinha10x10 from "@/assets/placa 10x10 avaliacao google.png";
import produtoPlaquinhaL from "@/assets/placa 10x15 avaliacao google.png";
import acrilico10x10Cristal from "@/assets/acrilico-10x10-cristal.jpg";
import acrilicoLCristal from "@/assets/acrilico-l-cristal.jpg";

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  initialData: { products: [], plans: [] },
  initialDataUpdatedAt: 0,
  staleTime: 60_000,
  refetchOnMount: "always",
});

export const PRODUCT_IMAGES: Record<string, string> = {
  "cartao-bolso": produtoCartao,
  "plaquinha-10x10": produtoPlaquinha10x10,
  "plaquinha-10x15-l": produtoPlaquinhaL,
  "acrilico-10x10-sem-arte": acrilico10x10Cristal,
  "acrilico-15x10-l-sem-arte": acrilicoLCristal,
};

/** Fotos de balcão (public/mockups), usadas no carrossel e na galeria dos produtos. */
export const MOCKUPS = Array.from({ length: 8 }, (_, i) => `/mockups/balcao-0${i + 1}.jpg`);

export const FALLBACK_PRODUCTS = [
  {
    id: "fallback-cartao",
    slug: "cartao-bolso",
    name: "Cartão de bolso GCard-PRÓ",
    format: "Cartão NFC 8,5 x 5,4 cm",
    tagline: "NFC pronto para avaliações no Google",
    status: "ativo",
    has_nfc: true,
    has_qr: false,
    is_blank: false,
    price_delta_cents: 0,
    resale_delta_cents: 0,
    resale_tiers: [],
  },
  {
    id: "fallback-plaquinha",
    slug: "plaquinha-10x10",
    name: "Plaquinha GCard-PRÓ 10x10",
    format: "Acrílico 10 x 10 cm",
    tagline: null,
    status: "ativo",
    has_nfc: true,
    has_qr: true,
    is_blank: false,
    price_delta_cents: 2000,
    resale_delta_cents: 2000,
    resale_tiers: [],
  },
  {
    id: "fallback-acrilico-sem-arte",
    slug: "acrilico-10x10-sem-arte",
    name: "Acrílico 10x10 sem arte",
    format: "Acrílico 2mm 10 x 10 cm",
    tagline: null,
    status: "ativo",
    has_nfc: false,
    has_qr: false,
    is_blank: true,
    price_delta_cents: 0,
    resale_delta_cents: 0,
    // Última tabela real conhecida (migração 20260916160000) — só usada se o catálogo não carregar.
    resale_tiers: [
      { min_quantity: 10, unit_price_cents: 1050, label: "10 a 19 unidades" },
      { min_quantity: 20, unit_price_cents: 920, label: "20 a 49 unidades" },
      { min_quantity: 50, unit_price_cents: 850, label: "50 unidades ou mais" },
    ],
  },
] as const;

type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/** Planos "Lojista" e "Revenda" com o fallback de quando o catálogo ainda não carregou. */
export function plansFrom(data: Catalog) {
  const lojistaCatalog = data.plans.find((p) => p.slug === "lojista");
  const lojista = lojistaCatalog
    ? { ...lojistaCatalog, name: "Cartão Individual" }
    : {
        name: "Cartão Individual",
        audience: "Para usar no seu próprio balcão",
        unit_price_cents: 5990,
        tiers: [
          { min_quantity: 1, unit_price_cents: 5990, label: "1 a 4 unidades" },
          { min_quantity: 5, unit_price_cents: 4990, label: "5 unidades" },
        ],
      };
  const revendaCatalog = data.plans.find((p) => p.slug === "renda-extra");
  const revenda = revendaCatalog
    ? { ...revendaCatalog, name: "Kit para Revenda" }
    : {
        name: "Pack Renda Extra",
        audience: "Comprar em quantidade e revender",
        unit_price_cents: 3790,
        tiers: [
          { min_quantity: 10, unit_price_cents: 3790, label: "10 a 24 unidades" },
          { min_quantity: 25, unit_price_cents: 2790, label: "25 a 99 unidades" },
          { min_quantity: 100, unit_price_cents: 1990, label: "100 unidades ou mais" },
        ],
      };
  return { lojista, revenda };
}

/** Todo produto não oculto (ativo ou "em breve"); cai no fallback se o catálogo veio vazio. */
export function productsFrom(data: Catalog) {
  const visible = data.products.filter((p) => p.status !== "oculto");
  return visible.length > 0 ? visible : FALLBACK_PRODUCTS;
}

/** Preço de revenda POR PRODUTO: cada um tem a sua tabela real (plano + delta, ou faixa própria). */
export function resaleLines(
  revenda: ReturnType<typeof plansFrom>["revenda"],
  products: ReturnType<typeof productsFrom>,
) {
  return [
    { slug: "cartao-bolso", label: "Cartão de bolso", note: "PVC, só NFC" },
    { slug: "plaquinha-10x10", label: "Placa 10×10", note: "Acrílico, QR Code + NFC" },
    { slug: "acrilico-10x10-sem-arte", label: "Acrílico sem arte 10×10", note: "Só o material, sem QR/NFC" },
  ]
    .map((line) => {
      const product = products.find((p) => p.slug === line.slug);
      if (!product || product.status === "oculto") return null;
      const tiers = resolveTiersForProduct(revenda, product as never, true);
      return { ...line, tiers, comingSoon: product.status === "em_breve" };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null && l.tiers.length > 0);
}
