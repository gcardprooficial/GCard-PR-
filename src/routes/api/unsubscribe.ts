import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, clientKey } from "@/lib/rateLimit";

// Descadastro. GET NUNCA descadastra: leitores de e-mail e antivírus abrem links sozinhos, e isso tiraria a
// pessoa da lista sem ela pedir. O GET só leva para a página de confirmação (/sair). O POST (botão da página ou
// "one-click" do provedor de e-mail, RFC 8058) é quem descadastra. Links antigos de e-mails já enviados continuam valendo.
export const Route = createFileRoute("/api/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        const target = token ? `/sair?token=${encodeURIComponent(token)}` : "/sair";
        return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
      },
      POST: async ({ request }) => {
        if (!rateLimit(`unsub-post:${clientKey(request)}`, 20, 600_000)) return new Response("Muitas tentativas.", { status: 429 });
        const { applyUnsubscribe, isUnsubscribeToken } = await import("@/lib/unsubscribe.server");
        const token = new URL(request.url).searchParams.get("token");
        if (!isUnsubscribeToken(token)) return new Response("Link de descadastro inválido.", { status: 400 });
        const result = await applyUnsubscribe(token);
        return new Response(result.ok ? "Descadastro concluído." : "Não foi possível concluir o descadastro.", {
          status: result.ok ? 200 : 404,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
