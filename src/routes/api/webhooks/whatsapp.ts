import { createFileRoute } from "@tanstack/react-router";

type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
};

/** Webhook da API oficial da Meta (alternativa à Z-API). */
export const Route = createFileRoute("/api/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (
          expected &&
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === expected
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response(null, { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifySignature } = await import("@/lib/whatsapp/graph.server");
        if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
          console.warn("WhatsApp webhook com assinatura inválida");
          return new Response(null, { status: 401 });
        }

        try {
          const payload = JSON.parse(raw) as {
            entry?: {
              changes?: {
                value?: { messages?: WaMessage[]; contacts?: { wa_id: string; profile?: { name?: string } }[] };
              }[];
            }[];
          };
          const { ingestInbound } = await import("@/lib/whatsapp/ingest.server");

          for (const entry of payload.entry ?? []) {
            for (const change of entry.changes ?? []) {
              const value = change.value;
              const names = new Map((value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
              for (const msg of value?.messages ?? []) {
                const text =
                  msg.text?.body ??
                  msg.button?.text ??
                  msg.interactive?.button_reply?.title ??
                  msg.interactive?.list_reply?.title ??
                  null;
                await ingestInbound({
                  waId: msg.from,
                  name: names.get(msg.from) ?? null,
                  messageId: msg.id,
                  text,
                  kind: text ? "text" : msg.type === "audio" ? "audio" : msg.type === "image" ? "image" : "other",
                  buttonId: msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? null,
                  fromMe: false,
                });
              }
            }
          }
        } catch (error) {
          console.error("Erro no webhook do WhatsApp (Meta)", error);
        }
        // Sempre 200: erro nosso não deve fazer a Meta reenviar em loop.
        return new Response(null, { status: 200 });
      },
    },
  },
});
