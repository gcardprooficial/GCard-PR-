import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tudo que prova uma venda numa disputa/análise do Mercado Pago, num lugar só (só equipe). */
export const getOrderDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
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

    const { data: order } = await db
      .from("orders")
      .select("*, businesses(name, review_url), order_items(product_name, quantity, total_cents)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado.");

    const { data: emails } = await db
      .from("email_events")
      .select("event_type, recipient, status, sent_at, created_at")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: true });

    return { order, emails: emails ?? [], generatedAt: new Date().toISOString() };
  });
