import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PriceTier } from "@/lib/pricing";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  format: string | null;
  status: string;
  price_delta_cents: number;
  has_qr: boolean;
  has_nfc: boolean;
};

export type CatalogPlan = {
  id: string;
  slug: string;
  name: string;
  audience: string;
  description: string | null;
  unit_price_cents: number;
  min_quantity: number;
  max_quantity: number | null;
  is_resale: boolean;
  tiers: PriceTier[];
  packages: {
    id: string;
    label: string;
    quantity: number;
    badge: string | null;
    note: string | null;
  }[];
};

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();

  const [products, plans, packages, tiers] = await Promise.all([
    supabase
      .from("products")
      .select("id, slug, name, tagline, description, format, status, price_delta_cents, has_qr, has_nfc")
      .order("sort_order"),
    supabase
      .from("plans")
      .select(
        "id, slug, name, audience, description, unit_price_cents, min_quantity, max_quantity, is_resale",
      )
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("plan_packages")
      .select("id, plan_id, label, quantity, badge, note")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("plan_price_tiers")
      .select("plan_id, min_quantity, unit_price_cents, label")
      .order("min_quantity"),
  ]);

  const planList: CatalogPlan[] = (plans.data ?? []).map((plan) => ({
    ...plan,
    tiers: (tiers.data ?? [])
      .filter((tier) => tier.plan_id === plan.id)
      .map(({ plan_id: _p, ...tier }) => tier),
    packages: (packages.data ?? [])
      .filter((pkg) => pkg.plan_id === plan.id)
      .map(({ plan_id: _planId, ...pkg }) => pkg),
  }));

  return {
    products: (products.data ?? []) as CatalogProduct[],
    plans: planList,
  };
});
