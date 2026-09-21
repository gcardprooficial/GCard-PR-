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

          const { applyPaymentToOrder } = await import("@/lib/payments/settle.server");
          await applyPaymentToOrder(orderId, payment, provider.name);
          return new Response(null, { status: 204 });
        } catch (error) {
          console.error("Error handling Mercado Pago webhook", error);
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
