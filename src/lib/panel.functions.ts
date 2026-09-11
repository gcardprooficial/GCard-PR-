import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertTeam(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "staff"]);
  if (error) throw error;
  if (!data?.length) throw new Error("Sem permissão para esta ação.");
}

const orderIdSchema = z.object({
  orderId: z.string().uuid(),
});

/** Marca pedido como pago (manual, sem Mercado Pago) e emite placas/lote. */
export const confirmOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { emitPlatesForOrder } = await import("@/lib/plate/emit.server");

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!order) throw new Error("Pedido não encontrado.");

    if (order.payment_status !== "pago") {
      const { error: updError } = await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "pago",
          payment_provider: "manual",
          payment_method: "manual",
          paid_at: new Date().toISOString(),
        })
        .eq("id", data.orderId);
      if (updError) throw updError;
    }

    const emitted = await emitPlatesForOrder(data.orderId);
    return { ok: true as const, ...emitted };
  });
