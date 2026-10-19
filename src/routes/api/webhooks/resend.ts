import { createFileRoute } from "@tanstack/react-router";
import { isDeliveryProblem, parseResendEvent, validSvixSignature, type DeliveryStatus } from "@/lib/email-delivery";

export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const ok = validSvixSignature(
            raw,
            {
              id: request.headers.get("svix-id"),
              timestamp: request.headers.get("svix-timestamp"),
              signature: request.headers.get("svix-signature"),
            },
            process.env["RESEND_WEBHOOK_SECRET"],
          );
          if (!ok) return new Response(null, { status: 401 });

          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            return new Response(null, { status: 400 });
          }
          const c = parseResendEvent(body);
          if (!c) return Response.json({ ok: true, ignored: true });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabaseAdmin as any;
          const { data: ev } = await db
            .from("email_events")
            .select("id, order_id, event_type, delivery_status")
            .eq("provider_message_id", c.messageId)
            .maybeSingle();
          // Não é e-mail de pedido (ex.: aviso ao admin, e-mail de marketing): nada a fazer.
          if (!ev) return Response.json({ ok: true, unknown: true });
          const prev = ev.delivery_status as DeliveryStatus | null;
          // Problema não é sobrescrito por "entregue"/"atrasado" fora de ordem.
          if (prev && isDeliveryProblem(prev) && !isDeliveryProblem(c.status)) return Response.json({ ok: true, kept: true });
          if (prev === c.status) return Response.json({ ok: true, duplicate: true });

          await db
            .from("email_events")
            .update({ delivery_status: c.status, delivery_detail: c.detail, delivery_at: new Date().toISOString() })
            .eq("id", ev.id);

          if (isDeliveryProblem(c.status)) {
            const { data: o } = await db
              .from("orders")
              .select("order_number, customer_name, customer_email, customer_phone")
              .eq("id", ev.order_id)
              .maybeSingle();
            if (o) {
              const { notifyAdminEmailProblem } = await import("@/lib/email-events.server");
              await notifyAdminEmailProblem({ ...o, event_type: ev.event_type, status: c.status, detail: c.detail });
            }
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Erro no webhook Resend", error);
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
