import { createFileRoute } from "@tanstack/react-router";

type ZapiPayload = {
  type?: string;
  phone?: string;
  messageId?: string;
  fromMe?: boolean;
  fromApi?: boolean;
  isGroup?: boolean;
  isNewsletter?: boolean;
  isStatusReply?: boolean;
  broadcast?: boolean;
  senderName?: string;
  chatName?: string;
  text?: { message?: string };
  audio?: unknown;
  image?: unknown;
  sticker?: unknown;
  reaction?: unknown;
  buttonsResponseMessage?: { buttonId?: string; message?: string };
  listResponseMessage?: { message?: string; selectedRowId?: string };
};

/**
 * Webhook da Z-API ("Ao receber"). Configure na instância:
 *   https://www.gcardpro.com.br/api/webhooks/zapi?secret=<ZAPI_WEBHOOK_SECRET>
 * e ligue também "Notificar as enviadas por mim" pra o bot silenciar quando você responder pelo celular.
 */
export const Route = createFileRoute("/api/webhooks/zapi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyWebhookSecret } = await import("@/lib/whatsapp/zapi.server");
        if (!verifyWebhookSecret(new URL(request.url).searchParams.get("secret"))) {
          return new Response(null, { status: 401 });
        }

        try {
          const p = (await request.json()) as ZapiPayload;

          // Só mensagens recebidas de conversa individual (ignora status, grupos, canais, transmissões, ligações etc.).
          if (p.type && p.type !== "ReceivedCallback") return new Response(null, { status: 200 });
          if (p.isGroup || p.isNewsletter || p.isStatusReply || p.broadcast) return new Response(null, { status: 200 });
          if (!p.phone || !p.messageId) return new Response(null, { status: 200 });
          if (p.fromMe && p.fromApi) return new Response(null, { status: 200 }); // enviada pelo nosso sistema
          if (p.reaction) return new Response(null, { status: 200 }); // reação (👍) a uma mensagem: não é conversa

          const text =
            p.text?.message ?? p.buttonsResponseMessage?.message ?? p.listResponseMessage?.message ?? null;
          const kind = text ? "text" : p.audio ? "audio" : p.image ? "image" : p.sticker ? "sticker" : "other";

          const { ingestInbound } = await import("@/lib/whatsapp/ingest.server");
          await ingestInbound({
            waId: p.phone.replace(/\D/g, ""),
            name: p.fromMe ? null : (p.senderName ?? p.chatName ?? null),
            messageId: p.messageId,
            text,
            kind,
            buttonId: p.buttonsResponseMessage?.buttonId ?? p.listResponseMessage?.selectedRowId ?? null,
            fromMe: Boolean(p.fromMe),
          });
        } catch (error) {
          console.error("Erro no webhook da Z-API", error);
        }
        return new Response(null, { status: 200 });
      },
    },
  },
});
