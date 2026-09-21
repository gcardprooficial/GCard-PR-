import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const schema = z.object({ paymentId: z.string().trim().regex(/^\d{5,20}$/) });

/**
 * Chamada pela página de retorno do Mercado Pago. Nunca confia no que o navegador
 * diz: só usa o payment_id pra perguntar ao próprio MP e aplicar o resultado real.
 */
export const verifyReturnedPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`pay-return:${clientKey(getRequest())}`, 20, 60_000)) {
      return { ok: false as const, reason: "rate_limited" as const };
    }
    const { getPaymentProvider } = await import("@/lib/payments");
    const provider = getPaymentProvider();
    if (!provider) return { ok: false as const, reason: "provider_not_configured" as const };

    const payment = await provider.getPayment(data.paymentId);
    if (!payment?.externalReference) return { ok: false as const, reason: "not_found" as const };

    const { applyPaymentToOrder } = await import("@/lib/payments/settle.server");
    const result = await applyPaymentToOrder(payment.externalReference, payment, provider.name);
    if (!result.found) return { ok: false as const, reason: "order_not_found" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("order_number")
      .eq("id", payment.externalReference)
      .maybeSingle();
    return {
      ok: true as const,
      status: result.status,
      orderNumber: order?.order_number ?? null,
    };
  });
