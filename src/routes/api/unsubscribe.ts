import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const email = url.searchParams.get("email");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;
        const query = db
          .from("marketing_contacts")
          .update({ marketing_unsubscribed_at: new Date().toISOString() });
        const result = token
          ? await query.eq("unsubscribe_token", token)
          : email
            ? await query.eq("email", email.toLowerCase())
            : null;
        if (!result)
          return new Response("Link de descadastro inválido.", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        if (result.error)
          return new Response("Não foi possível concluir o descadastro.", { status: 500 });
        return new Response(
          "Descadastro concluído. Você não receberá mais atualizações estratégicas.",
          { headers: { "Content-Type": "text/plain; charset=utf-8" } },
        );
      },
    },
  },
});
