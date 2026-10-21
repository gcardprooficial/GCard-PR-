import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { nextFulfillment, parseSuperFreteEvent } from "@/lib/shipping/tracking-map";

function validSecret(given: string | null) {
  const secret = process.env["SUPERFRETE_WEBHOOK_SECRET"];
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// A SuperFrete avisa "postado"/"entregue" com o código de rastreio. O segredo vai na URL (o cabeçalho de assinatura deles não é
// documentado) e o pedido é achado pelo código de rastreio já gravado nele. Sem pedido com esse código, não faz nada.
export const Route = createFileRoute("/api/webhooks/superfrete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!validSecret(new URL(request.url).searchParams.get("secret"))) return new Response(null, { status: 401 });
          const body = await request.json().catch(() => null);
          const ev = parseSuperFreteEvent(body);
          if (!ev) return Response.json({ ok: true, ignored: true });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabaseAdmin as any;
          const { data: order } = await db
            .from("orders")
            .select("id, fulfillment_status, shipped_at")
            .ilike("tracking_code", ev.tracking)
            .maybeSingle();
          if (!order) return Response.json({ ok: true, unknown: true });

          const next = nextFulfillment(order.fulfillment_status, ev.stage);
          const patch: Record<string, unknown> = {
            shipping_status: ev.stage === "entregue" ? "delivered" : "posted",
            tracking_synced_at: new Date().toISOString(),
          };
          if (next) patch["fulfillment_status"] = next;
          if (!order.shipped_at) patch["shipped_at"] = ev.postedAt ?? new Date().toISOString();
          if (ev.stage === "entregue") patch["delivered_at"] = new Date().toISOString();
          await db.from("orders").update(patch).eq("id", order.id);

          const { dispatchOrderEmailEvent } = await import("@/lib/email-events.server");
          await dispatchOrderEmailEvent(order.id, "pedido_enviado");
          if (ev.stage === "entregue") await dispatchOrderEmailEvent(order.id, "pedido_entregue");
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Erro no webhook SuperFrete", error);
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
