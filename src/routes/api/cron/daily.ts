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
          // Primeiro reconcilia (quem pagou e o webhook perdeu), depois lembra só quem segue pendente.
          const reconcile = await reconcilePendingOrders({ limit: 100 });
          const reminders = await sendPaymentReminders();
          return Response.json({ ok: true, reconcile, reminders });
        } catch (error) {
          console.error("Cron diário falhou", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
