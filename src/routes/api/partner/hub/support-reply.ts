import { createFileRoute } from "@tanstack/react-router";
import { parseHubReplyBody, validHubReplySignature } from "@/lib/hub-reply-auth";

// O Hub responde uma conversa do chat do site. Pedido assinado, só do Hub: grava a mensagem como "staff" na conversa.
// O gatilho do banco já registra o evento suporte_resposta no outbox do Hub.
export const Route = createFileRoute("/api/partner/hub/support-reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const ok = validHubReplySignature(
          raw,
          request.headers.get("x-hub-timestamp"),
          request.headers.get("x-hub-signature"),
          process.env["HUB_INGEST_SECRET"],
          Math.floor(Date.now() / 1000),
        );
        if (!ok) return new Response(null, { status: 401 });
        const body = parseHubReplyBody(raw);
        if (!body) return Response.json({ error: "Corpo inválido" }, { status: 400 });

        const { rateLimitShared } = await import("@/lib/rateLimit");
        if (!(await rateLimitShared("hub-support-reply", 30, 60_000)))
          return new Response(null, { status: 429 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const { data: conv } = await db
          .from("chat_conversations")
          .select("id")
          .eq("id", body.conversa)
          .maybeSingle();
        if (!conv) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });

        const { error } = await db.from("chat_messages").insert({
          conversation_id: body.conversa,
          sender_type: "staff",
          sender_name: "Equipe GCard",
          body: body.texto,
        });
        if (error) {
          console.error("[hub/support-reply] falha ao gravar", error.code);
          return Response.json({ error: "Não foi possível enviar." }, { status: 500 });
        }
        await db
          .from("chat_conversations")
          .update({ last_message_at: new Date().toISOString(), status: "aberta" })
          .eq("id", body.conversa);
        return Response.json({ ok: true });
      },
    },
  },
});
