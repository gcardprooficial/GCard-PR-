import { createFileRoute } from "@tanstack/react-router";

// Vercel Cron chama com `Authorization: Bearer $CRON_SECRET`. Sem o segredo configurado,
// a rota fica fechada -- nunca aberta.
function authorized(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export const Route = createFileRoute("/api/cron/daily")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("unauthorized", { status: 401 });
        try {
          const { reconcilePendingOrders } = await import("@/lib/payments/settle.server");
          const { sendPaymentReminders } = await import("@/lib/payments/reminders.server");
          const { autoCancelStalePending, expireStalePendingOrders } = await import(
            "@/lib/payments/expire.server"
          );
          // Ordem importa: reconcilia (quem pagou e o webhook perdeu) antes de lembrar,
          // cancelar (24h sem pagar) ou expirar (2 dias sem pagar) -- senão um pedido que
          // já foi pago pode ser cancelado/apagado por engano.
          const reconcile = await reconcilePendingOrders({ limit: 100 });
          const reminders = await sendPaymentReminders();
          const autoCancelled = await autoCancelStalePending();
          const expired = await expireStalePendingOrders();

          // Etiquetas de contato do WhatsApp (compraram, pararam no pagamento…). Não pode derrubar o cron.
          let whatsappContacts: number | null = null;
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await (supabaseAdmin as any).rpc("wa_sync_contacts");
            whatsappContacts = typeof data === "number" ? data : null;
          } catch (error) {
            console.error("Cron: falha ao sincronizar contatos do WhatsApp", error);
          }
          return Response.json({ ok: true, reconcile, reminders, autoCancelled, expired, whatsappContacts });
        } catch (error) {
          console.error("Cron diário falhou", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
