import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { untyped } from "@/lib/db-untyped";
import { isAllowedHost, isPublicHost, rulesOrFallback, type DestinationRule } from "@/lib/destination";
import { classifyScan, parseScanSource, scanCountry, visitorHash } from "@/lib/scan-filter";

// Redirecionamento do QR/NFC. Sempre 302 e no-store: mudar o destino vale na hora, sem cache para invalidar.
// ?s=q (QR) / ?s=n (NFC) só serve para contar a origem da leitura: qualquer outro valor é ignorado e
// o parâmetro NUNCA é repassado ao destino.

function page(title: string, message: string, status: number, code?: string, report = false) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | GCard-PRÓ</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #FFFFFF; color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; box-sizing: border-box; }
  .box { max-width: 28rem; text-align: center; border: 1px solid #E2E8F0; border-radius: 1.5rem; padding: 2.5rem 2rem; box-shadow: 0 4px 20px -5px rgba(0,0,0,0.06); background: #FFFFFF; }
  .badge { display: inline-block; background: #FEF3C7; color: #92400E; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem; }
  h1 { font-size: 1.5rem; margin: 0 0 0.75rem; color: #0F172A; font-weight: 800; }
  p { color: #64748B; line-height: 1.6; margin: 0 0 1.5rem; font-size: 0.95rem; }
  .code { font-family: ui-monospace, monospace; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.02em; background: #F1F5F9; border-radius: 0.75rem; padding: 0.5rem 1rem; display: inline-block; margin: 0 0 1.5rem; }
  .btn { display: inline-block; background: #F59E0B; color: #0F172A; font-weight: 700; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.875rem; font-size: 0.95rem; transition: background 0.2s; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35); }
  .btn:hover { background: #D97706; }
</style>
</head><body><div class="box"><span class="badge">GCard-PRÓ</span><h1>${title}</h1><p>${message}</p>${code ? `<p class="code">${code}</p>` : ""}<a href="/" class="btn">Voltar ao início →</a>${report && code ? `<p style="margin:1.25rem 0 0;font-size:0.8rem"><a href="/denunciar?codigo=${encodeURIComponent(code)}" style="color:#64748B">Denunciar este código</a></p>` : ""}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
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

        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
        const supabaseAdmin = untyped(admin);
        const { data: plate } = await supabaseAdmin
          .from("plates")
          .select("id, status, destination_url, business_id, short_code")
          .eq("token", token)
          .maybeSingle();

        if (!plate) {
          return page(
            "Placa não encontrada",
            "Essa placa ainda não consta no nosso sistema. Fale com a GCard-PRÓ para verificar.",
            404,
          );
        }

        if (plate.status === "bloqueada") {
          return page(
            "Código desativado",
            "Esse código foi desativado e não leva a nenhum destino.",
            410,
            plate.short_code,
            true,
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
            "Essa placa GCard-PRÓ ainda não está apontando para um destino. Se ela é sua, fale com a gente para ativar.",
            200,
            plate.short_code,
            true,
          );
        }

        let target: URL;
        try {
          target = new URL(destination);
        } catch {
          return page("Destino inválido", "O link dessa placa precisa ser corrigido.", 500);
        }
        // Valida também na leitura (não só na gravação): lista única no banco, só https, sem usuário/senha/porta.
        const { data: rows } = await supabaseAdmin.from("allowed_destination_hosts").select("host, include_subdomains");
        const rules = rulesOrFallback(rows as DestinationRule[] | null);
        // Endereço exato liberado por pedido aprovado (tabela pode ainda não existir: aí a lista vem vazia).
        const { data: urlRows } = await supabaseAdmin.from("allowed_destination_urls").select("url");
        const exactOk = ((urlRows ?? []) as { url: string }[]).some((u) => u.url === destination);
        if (target.protocol !== "https:" || target.username || target.password || target.port || !isPublicHost(target.hostname) || (!isAllowedHost(target.hostname, rules) && !exactOk)) {
          return page("Destino não permitido", "Esse código aponta para um endereço que não é aceito.", 400);
        }

        // Registro da leitura (best-effort: se falhar, o cliente é redirecionado do mesmo jeito).
        try {
          const ua = request.headers.get("user-agent") ?? "";
          const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          const cls = classifyScan(request.headers);
          let referrerHost: string | null = null;
          try {
            const ref = request.headers.get("referer");
            referrerHost = ref ? new URL(ref).hostname : null;
          } catch {
            referrerHost = null;
          }
          await supabaseAdmin.rpc("plate_register_scan", {
            _plate_id: plate.id,
            _token: token,
            _device: /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop",
            _country: scanCountry(request.headers),
            _referrer_host: referrerHost,
            _source: parseScanSource(new URL(request.url).searchParams.get("s")),
            _is_bot: cls.isBot,
            _bot_reason: cls.reason,
            _visitor_hash: visitorHash(clientKey(request), ua, day),
          });
        } catch (error) {
          console.error("falha ao registrar leitura", { token, error });
        }

        return new Response(null, {
          status: 302,
          headers: { location: target.toString(), "cache-control": "no-store", "x-robots-tag": "noindex" },
        });
      },
    },
  },
});
