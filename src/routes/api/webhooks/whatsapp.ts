/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";

type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
};

export const Route = createFileRoute("/api/webhooks/whatsapp")({
  server: {
    handlers: {
      // Meta chama isso uma vez ao cadastrar o webhook.
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
        const { verifySignature, markRead } = await import("@/lib/whatsapp/graph.server");
        if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
          console.warn("WhatsApp webhook com assinatura inválida");
          return new Response(null, { status: 401 });
        }

        try {
          const payload = JSON.parse(raw) as {
            entry?: { changes?: { value?: { messages?: WaMessage[]; contacts?: { wa_id: string; profile?: { name?: string } }[] } }[] }[];
          };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any;
          const { processInbound } = await import("@/lib/whatsapp/bot.server");

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
                const buttonId = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? null;
                const kind = text ? "text" : msg.type === "audio" ? "audio" : msg.type === "image" ? "image" : "other";
                const now = new Date().toISOString();

                let { data: conv } = await db
                  .from("wa_conversations")
                  .select("*")
                  .eq("wa_id", msg.from)
                  .maybeSingle();
                if (!conv) {
                  const ins = await db
                    .from("wa_conversations")
                    .insert({ wa_id: msg.from, name: names.get(msg.from) ?? null })
                    .select("*")
                    .single();
                  conv = ins.data;
                }
                if (!conv) continue;

                // Dedupe: a Meta reenvia o mesmo webhook se demorar a responder.
                const { error: dup } = await db.from("wa_messages").insert({
                  conversation_id: conv.id,
                  direction: "in",
                  sender: "cliente",
                  kind,
                  body: text,
                  wa_message_id: msg.id,
                });
                if (dup) continue;

                await db
                  .from("wa_conversations")
                  .update({
                    name: conv.name ?? names.get(msg.from) ?? null,
                    unread_count: (conv.unread_count ?? 0) + 1,
                    last_text: text ?? (kind === "audio" ? "🎤 áudio" : kind === "image" ? "📷 imagem" : "mensagem"),
                    last_message_at: now,
                    last_inbound_at: now,
                  })
                  .eq("id", conv.id);

                void markRead(msg.id);
                try {
                  await processInbound(conv, kind, text, buttonId);
                } catch (error) {
                  console.error("WhatsApp bot falhou", { conversation: conv.id, error });
                }
              }
            }
          }
        } catch (error) {
          console.error("Erro no webhook do WhatsApp", error);
        }
        // Sempre 200: erro nosso não deve fazer a Meta reenviar em loop.
        return new Response(null, { status: 200 });
      },
    },
  },
});
