import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/infinitepay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { validWebhookSecret, settleInfinitePay } = await import("@/lib/payments/infinitepay.server");
          if (!validWebhookSecret(new URL(request.url).searchParams.get("secret"))) {
            return new Response(null, { status: 401 });
          }
          const body = (await request.json()) as { order_nsu?: string; transaction_nsu?: string; invoice_slug?: string };
          if (!body.order_nsu || !body.transaction_nsu || !body.invoice_slug) return new Response(null, { status: 400 });
          const r = await settleInfinitePay({ orderId: body.order_nsu, transactionNsu: body.transaction_nsu, slug: body.invoice_slug });
          // 400 faz a InfinitePay tentar de novo; só vale pra falha de conferência, não pra pedido desconhecido.
          if (!r.ok && r.reason === "check_failed") return Response.json({ success: false }, { status: 400 });
          return Response.json({ success: true });
        } catch (error) {
          console.error("Erro no webhook InfinitePay", error);
          return new Response(null, { status: 400 });
        }
      },
    },
  },
});
