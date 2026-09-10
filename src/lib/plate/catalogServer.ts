import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabaseServer";
import type { PlateProductType } from "./types";

// Catálogo de produtos pra render no servidor (landing / wizard).
export async function getPlateProductsServer(): Promise<PlateProductType[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("plate_product_types")
    .select("id, name, slug, description, format, technology, unit_price, active, coming_soon, stock_quantity, images")
    .eq("active", true)
    .order("coming_soon", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    description: (r.description as string) ?? null,
    format: r.format as PlateProductType["format"],
    technology: r.technology as PlateProductType["technology"],
    unitPrice: Number(r.unit_price) || 0,
    active: Boolean(r.active),
    comingSoon: Boolean(r.coming_soon),
    stockQuantity: (r.stock_quantity as number) ?? null,
    images: Array.isArray(r.images) ? (r.images as string[]) : [],
  }));
}
