import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const ALLOWED_HOSTS = ["search.google.com", "www.google.com", "google.com", "maps.google.com", "g.page"];

function page(title: string, message: string, status: number) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1b1a17;color:#f4f1ea;font-family:system-ui,sans-serif;padding:24px}
div{max-width:26rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .6rem}p{color:#c8c2b4;line-height:1.5;margin:0}</style>
</head><body><div><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/r/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = params.token.trim();
        if (!/^[A-Za-z0-9_-]{4,64}$/.test(token)) {
          return page("Código inválido", "Confira o código impresso na sua placa GCard-PRÓ.", 400);
        }

        if (!rateLimit(`r:${clientKey(request)}`, 60, 60_000)) {
          return page("Muitas tentativas", "Aguarde um momento e tente de novo.", 429);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: plate } = await supabaseAdmin
          .from("plates")
          .select("id, status, destination_url, business_id, scan_count")
          .eq("token", token)
          .maybeSingle();

        if (!plate) {
          return page(
            "Placa não encontrada",
            "Essa placa ainda não consta no nosso sistema. Fale com a GCard-PRÓ para verificar.",
            404,
          );
        }

        let destination = plate.destination_url;
        if (!destination && plate.business_id) {
          const { data: business } = await supabaseAdmin
            .from("businesses")
            .select("review_url")
            .eq("id", plate.business_id)
            .maybeSingle();
          destination = business?.review_url ?? null;
        }

        if (plate.status !== "ativada" || !destination) {
          return page(
            "Placa ainda não ativada",
            "Essa placa GCard-PRÓ ainda não está apontando para um negócio. Se ela é sua, fale com a gente para ativar.",
            200,
          );
        }

        let target: URL;
        try {
          target = new URL(destination);
        } catch {
          return page("Destino inválido", "O link de avaliação dessa placa precisa ser corrigido.", 500);
        }
        if (target.protocol !== "https:" || !ALLOWED_HOSTS.includes(target.hostname)) {
          return page("Destino não permitido", "Essa placa só pode apontar para o Google.", 400);
        }

        const ua = request.headers.get("user-agent") ?? "";
        const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
        const referrer = request.headers.get("referer");
        let referrerHost: string | null = null;
        try {
          referrerHost = referrer ? new URL(referrer).hostname : null;
        } catch {
          referrerHost = null;
        }

        await supabaseAdmin.from("plate_scan_events").insert({
          plate_id: plate.id,
          token,
          device,
          country: request.headers.get("cf-ipcountry"),
          referrer_host: referrerHost,
        });

        // ponytail: read-modify-write, races under concurrent scans of one plate.
        // Fine at this volume; move to a DB trigger / rpc increment if it matters.
        await supabaseAdmin
          .from("plates")
          .update({ scan_count: (plate.scan_count ?? 0) + 1, last_scan_at: new Date().toISOString() })
          .eq("id", plate.id);

        return new Response(null, {
          status: 302,
          headers: { location: target.toString(), "cache-control": "no-store" },
        });
      },
    },
  },
});
