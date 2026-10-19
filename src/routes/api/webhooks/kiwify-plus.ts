import { createFileRoute } from "@tanstack/react-router";
import { dedupeKey, parseKiwifyPlus, validKiwifySignature } from "@/lib/plus-kiwify";

export const Route = createFileRoute("/api/webhooks/kiwify-plus")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const sig = new URL(request.url).searchParams.get("signature");
          if (!validKiwifySignature(raw, sig, process.env["KIWIFY_PLUS_WEBHOOK_TOKEN"])) return new Response(null, { status: 401 });

          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            return new Response(null, { status: 400 });
          }
          const products = (process.env["KIWIFY_PLUS_PRODUCT_IDS"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          const c = parseKiwifyPlus(body, products);
          if (!c) return Response.json({ ok: true, ignored: true });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { untyped } = await import("@/lib/db-untyped");
          const { trackEvent } = await import("@/lib/events.server");
          const db = untyped(supabaseAdmin);

          const key = dedupeKey(c);
          const { data: seen } = await db.from("plus_webhook_events").select("dedupe_key").eq("dedupe_key", key).maybeSingle();
          if (seen) return Response.json({ ok: true, duplicate: true });

          const { data: cur, error: e1 } = await db
            .from("plus_subscriptions").select("id, status").eq("kiwify_subscription_id", c.subscriptionId).maybeSingle();
          if (e1) throw e1;
          const row = {
            email: c.email, plan: c.plan, status: c.status, kiwify_order_id: c.orderId, kiwify_product_id: c.productId,
            current_period_end: c.periodEnd, last_event: c.event,
            canceled_at: c.status === "cancelada" || c.status === "reembolsada" ? new Date().toISOString() : null,
          };
          const w = cur
            ? await db.from("plus_subscriptions").update(row).eq("id", cur.id)
            : await db.from("plus_subscriptions").insert({ ...row, kiwify_subscription_id: c.subscriptionId });
          if (w.error) throw w.error;
          await db.from("plus_webhook_events").insert({ dedupe_key: key, event_type: c.event });

          // Hub: só na mudança de estado (nova assinatura, atraso, cancelamento). Renovação rotineira não gera evento.
          const type =
            !cur && c.status === "ativa" ? "plus_assinado"
            : c.status === "atrasada" && cur?.status !== "atrasada" ? "plus_atrasado"
            : (c.status === "cancelada" || c.status === "reembolsada") && cur?.status !== c.status ? "plus_cancelado"
            : null;
          if (type) await trackEvent({ type, email: c.email, data: { plan: c.plan }, dedupe: `plus:${type}:${c.subscriptionId}:${c.orderId ?? ""}` });
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Erro no webhook Kiwify Plus", error);
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
