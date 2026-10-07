import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Row = {
  order_number: number;
  paid_at: string;
  payment_status: string;
  payment_provider: string | null;
  payment_method: string | null;
  provider_payment_id: string | null;
  total_cents: number;
  coupon_code: string | null;
  coupon_discount_cents: number | null;
  customer_name: string;
  customer_document: string | null;
  customer_email: string;
};

/** Vendas pagas do mês (fuso de Brasília) por pedido, pra entregar ao contador. Só equipe. */
export const getMonthlySales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: roles } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "staff"]);
    if (!roles?.length) throw new Error("Sem permissão para esta ação.");

    const [y, m] = data.month.split("-").map(Number) as [number, number];
    // Brasília = UTC-3 (sem horário de verão): o mês local começa às 03:00 UTC.
    const start = new Date(Date.UTC(y, m - 1, 1, 3)).toISOString();
    const end = new Date(Date.UTC(y, m, 1, 3)).toISOString();

    const { data: rows, error } = await db
      .from("orders")
      .select(
        "order_number, paid_at, payment_status, payment_provider, payment_method, provider_payment_id, total_cents, coupon_code, coupon_discount_cents, customer_name, customer_document, customer_email",
      )
      .in("payment_status", ["pago", "estornado"])
      .gte("paid_at", start)
      .lt("paid_at", end)
      .order("paid_at", { ascending: true })
      .limit(5000);
    if (error) throw error;
    return { rows: (rows ?? []) as Row[] };
  });
