"use client";

import type { PlateProductType } from "./types";

// Busca o catálogo via /api/plate/products (service role no servidor).
// Cache no navegador entre montagens.
let cache: Promise<PlateProductType[]> | null = null;

export function fetchPlateProducts(): Promise<PlateProductType[]> {
  if (cache) return cache;
  cache = fetch("/api/plate/products")
    .then((r) => (r.ok ? r.json() : { products: [] }))
    .then((d: { products?: PlateProductType[] }) => d.products ?? [])
    .catch(() => []);
  return cache;
}

export const PLATE_FORMAT_LABEL: Record<PlateProductType["format"], string> = {
  business_card: "Cartão de visita",
  square_10: "Plaquinha quadrada 10x10",
  l_stand_10x15: "Plaquinha 10x15 em L",
  other: "Outro",
};
