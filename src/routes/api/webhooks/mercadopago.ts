import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { getPaymentProvider } = await import("@/lib/payments");
          const provider = getPaymentProvider();
          if (!provider) return new Response(null, { status: 503 });

          const verified = await provider.verifyWebhook(request, await request.clone().text());
          if (!verified) {
            console.warn("Unverified Mercado Pago webhook");
            return new Response(null, { status: 400 });
          }

          const payment = await provider.getPayment(verified.paymentId);
          if (!payment) return new Response(null, { status: 502 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabaseAdmin as any;
          let orderId = payment.externalReference ?? null;
          if (orderId) {
            const { data: referenced } = await db
              .from("orders")
              .select("id")
              .eq("id", orderId)
              .maybeSingle();
            if (!referenced) orderId = null;
          }
          if (!orderId) {
            const { data: found } = await db
              .from("orders")
              .select("id")
              .eq("provider_payment_id", payment.providerPaymentId)
              .maybeSingle();
            orderId = found?.id ?? null;
          }
          if (!orderId) return new Response(null, { status: 204 });

          const { data: before } = await db
            .from("orders")
            .select("payment_status")
            .eq("id", orderId)
            .maybeSingle();
          const updates: Record<string, unknown> = {
            payment_status: payment.status,
            payment_provider: provider.name,
            provider_payment_id: payment.providerPaymentId,
            payment_method: payment.method ?? null,
            external_reference: payment.externalReference ?? null,
          };
          if (payment.status === "pago") updates.paid_at = new Date().toISOString();
          const { error } = await db.from("orders").update(updates).eq("id", orderId);
          if (error) throw error;

          if (payment.status === "pago") {
            const { emitPlatesForOrder } = await import("@/lib/plate/emit.server");
            await emitPlatesForOrder(orderId);
            if (before?.payment_status !== "pago") {
              const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
              await dispatchOrderEmailEvent(orderId, "pagamento_confirmado");
            }
          }
          return new Response(null, { status: 204 });
        } catch (error) {
          console.error("Error handling Mercado Pago webhook", error);
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
