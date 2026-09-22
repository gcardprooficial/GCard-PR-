import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/melhorenvio/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const origin = process.env["PUBLIC_APP_URL"] ?? "https://www.gcardpro.com.br";
        const redirectTo = (ok: boolean, msg: string) =>
          Response.redirect(`${origin}/painel/integracoes?melhorenvio=${ok ? "ok" : "erro"}&msg=${encodeURIComponent(msg)}`, 302);

        if (!code || !state) return redirectTo(false, "Faltou code ou state na volta do Melhor Envio.");
        try {
          const { exchangeCodeForTokens } = await import("@/lib/shipping/melhorenvio.server");
          await exchangeCodeForTokens(code, state);
          return redirectTo(true, "Conectado!");
        } catch (error) {
          console.error("Melhor Envio callback falhou", error);
          return redirectTo(false, error instanceof Error ? error.message : "Falha desconhecida.");
        }
      },
    },
  },
});
