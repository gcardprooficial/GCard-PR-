import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

function validSecret(given: string | null) {
  const secret = process.env["PAGARME_WEBHOOK_SECRET"];
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/webhooks/pagarme")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // O aviso não é confiado: a chave secreta vai na URL e o pedido é sempre reconsultado na API.
          if (!validSecret(new URL(request.url).searchParams.get("secret"))) return new Response(null, { status: 401 });
          const body = (await request.json()) as { type?: string; data?: { id?: string; order?: { id?: string } } };
          if (!body.type?.startsWith("order.") && !body.type?.startsWith("charge.")) return Response.json({ ok: true });

          const { fetchPagarmeOrder, settlePagarmeOrder } = await import("@/lib/payments/pagarme.server");
          // order.* traz o pedido em data; charge.* traz a cobrança e o pedido dentro dela.
          const pgOrderId = body.type.startsWith("order.") ? body.data?.id : body.data?.order?.id;
          if (!pgOrderId) {
            console.warn("Pagar.me webhook sem id de pedido", body.type);
            return Response.json({ ok: true });
          }
          const order = await fetchPagarmeOrder(pgOrderId);
          if (!order) return new Response(null, { status: 502 });
          const r = await settlePagarmeOrder(order);
          if (!r.ok && r.reason === "no_reference") {
            console.error("Pagar.me webhook: não consegui ligar ao pedido", { type: body.type, pgOrderId });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Erro no webhook Pagar.me", error);
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
