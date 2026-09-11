import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { getPaymentProvider } = await import("@/lib/payments");
          const provider = getPaymentProvider();
          if (!provider) {
            console.error("Mercado Pago provider not configured");
            return new Response(null, { status: 503 });
          }

          const verified = await provider.verifyWebhook(request);
          if (!verified) {
            console.warn("Unverified mercadopago webhook");
            return new Response(null, { status: 400 });
          }

          const payment = await provider.getPayment(verified.paymentId);
          if (!payment) {
            console.error("Could not fetch Mercado Pago payment", verified.paymentId);
            return new Response(null, { status: 500 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { emitPlatesForOrder } = await import("@/lib/plate/emit.server");

          // Try to resolve order by externalReference (recommended) or by provider id
          let orderId: string | null = payment.externalReference ?? null;
          if (!orderId) {
            const { data: found } = await supabaseAdmin
              .from("orders")
              .select("id")
              .eq("provider_payment_id", payment.providerPaymentId)
              .maybeSingle();
            orderId = found?.id ?? null;
          }

          if (!orderId) {
            console.warn("Webhook: payment received but no matching order found", payment);
            // still respond 200 to acknowledge webhook
            return new Response(null, { status: 200 });
          }

          const updates: Record<string, unknown> = {
            payment_status: payment.status,
            payment_provider: provider.name,
            provider_payment_id: payment.providerPaymentId,
            provider_payment_method: payment.method ?? null,
            external_reference: payment.externalReference ?? null,
          };
          if (payment.status === "pago") updates.paid_at = new Date().toISOString();

          const { error: updErr } = await supabaseAdmin.from("orders").update(updates).eq("id", orderId);
          if (updErr) {
            console.error("Failed to update order from webhook", updErr);
            return new Response(null, { status: 500 });
          }

          if (payment.status === "pago") {
            try {
              await emitPlatesForOrder(orderId);
            } catch (emitErr) {
              console.error("emitPlatesForOrder failed after webhook", emitErr);
            }
          }

          return new Response(null, { status: 204 });
        } catch (err) {
          console.error("Error handling mercadopago webhook", err);
          return new Response(null, { status: 500 });
        }
      },
      // No GET handler — webhook notifications should POST. If needed, add GET handling later.
    },
  },
});
