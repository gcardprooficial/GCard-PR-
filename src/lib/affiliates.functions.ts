import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

/** Checkout: confere o cupom guardado/digitado e devolve só o que a tela precisa mostrar. */
export const checkCoupon = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().trim().max(40) }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`coupon:${clientKey(getRequest())}`, 20, 60_000)) {
      return { ok: false as const, error: "Muitas tentativas. Aguarde um minuto." };
    }
    const { findActiveAffiliate } = await import("./affiliates.server");
    const affiliate = await findActiveAffiliate(data.code);
    if (!affiliate) return { ok: false as const, error: "Cupom inválido ou expirado." };
    return {
      ok: true as const,
      code: affiliate.code,
      discountPct: affiliate.discount_pct,
      partnerFirstName: affiliate.name.trim().split(/\s+/)[0] ?? "",
    };
  });

/** Painel do parceiro (link privado). Só agregados e valores -- nenhum dado do cliente. */
export const getAffiliateDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!rateLimit(`aff-dash:${clientKey(getRequest())}`, 30, 60_000)) {
      return { ok: false as const, error: "rate_limited" as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: affiliate } = await db
      .from("affiliates")
      .select("id, name, code, discount_pct, commission_pct, clicks, is_active")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!affiliate) return { ok: false as const, error: "not_found" as const };

    const { data: rows } = await db
      .from("affiliate_commissions")
      .select("base_cents, amount_cents, status, paid_at, created_at")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const sales = (rows ?? []) as {
      base_cents: number;
      amount_cents: number;
      status: "pendente" | "paga" | "cancelada";
      paid_at: string | null;
      created_at: string;
    }[];
    const sum = (s: string) =>
      sales.filter((r) => r.status === s).reduce((t, r) => t + r.amount_cents, 0);

    return {
      ok: true as const,
      name: affiliate.name as string,
      code: affiliate.code as string,
      isActive: affiliate.is_active as boolean,
      discountPct: affiliate.discount_pct as number,
      commissionPct: affiliate.commission_pct as number,
      clicks: affiliate.clicks as number,
      salesCount: sales.filter((r) => r.status !== "cancelada").length,
      pendingCents: sum("pendente"),
      paidCents: sum("paga"),
      sales: sales.slice(0, 50),
    };
  });
