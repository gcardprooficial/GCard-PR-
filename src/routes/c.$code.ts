import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { normalizeCouponCode } from "@/lib/referral";

// Link de divulgação do parceiro: gcardpro.com.br/c/{code}. Conta o clique e manda pra
// home com ?cupom= -- o layout raiz guarda o código e o checkout aplica sozinho.
// Destino é sempre caminho interno fixo: nunca vira open redirect.
export const Route = createFileRoute("/c/$code")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const code = normalizeCouponCode(params.code);
        if (!code) return redirect("/");
        let valid = true;
        if (rateLimit(`c:${clientKey(request)}`, 30, 60_000)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await (supabaseAdmin as any).rpc("affiliate_track_click", {
              p_code: code,
            });
            valid = data !== false;
          } catch (error) {
            console.error("affiliate_track_click falhou", { code, error });
          }
        }
        return redirect(valid ? `/?cupom=${encodeURIComponent(code)}` : "/");
      },
    },
  },
});

function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}
