import { createFileRoute } from "@tanstack/react-router";

// Chamada a cada minuto (pg_cron + pg_net) com `Authorization: Bearer $CRON_SECRET`, como /api/cron/daily.
// Sem o segredo configurado, a rota fica fechada. Com HUB_OUTBOX_ENABLED desligado (padrão), não envia nada.
function authorized(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const enabled = () => ["true", "on", "1"].includes((process.env["HUB_OUTBOX_ENABLED"] ?? "").toLowerCase());

export const Route = createFileRoute("/api/cron/hub-outbox")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("unauthorized", { status: 401 });
        if (!enabled()) return Response.json({ ok: true, enabled: false });
        const url = process.env["HUB_INGEST_URL"];
        const secret = process.env["HUB_INGEST_SECRET"];
        if (!url || !url.startsWith("https://") || !secret || secret.length < 32) {
          return Response.json({ ok: false, reason: "hub_nao_configurado" });
        }
        try {
          const { runOutbox, supabaseOutboxStore } = await import("@/lib/hub-outbox.server");
          const summary = await runOutbox(await supabaseOutboxStore(), { url, secret });
          return Response.json({ ok: true, enabled: true, ...summary });
        } catch {
          console.error("hub_outbox: rodada falhou");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
