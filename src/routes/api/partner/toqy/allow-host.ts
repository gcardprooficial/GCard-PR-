import { createFileRoute } from "@tanstack/react-router";
import { parseAllowHostBody, validToqySignature } from "@/lib/partner-toqy";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Ponte Toqy -> GCard: o Toqy libera (ou retira) o domínio próprio de um bio site de revendedor Agência
 * como destino de placas. Pedido assinado (HMAC-SHA256 de "<timestamp>.<corpo>"); só mexe em linhas
 * com source = 'toqy' (nunca nas liberações manuais) e nunca aceita "*".
 */
export const Route = createFileRoute("/api/partner/toqy/allow-host")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const ok = validToqySignature(
          raw,
          request.headers.get("x-toqy-timestamp"),
          request.headers.get("x-toqy-signature"),
          process.env["TOQY_PARTNER_SECRET"],
          Math.floor(Date.now() / 1000),
        );
        if (!ok) return new Response(null, { status: 401 });
        // 60 pedidos por minuto, no total (a rota é só do Toqy).
        if (!rateLimit("toqy-allow-host", 60, 60_000)) return new Response(null, { status: 429 });

        const body = parseAllowHostBody(raw);
        if (!body) return new Response(null, { status: 400 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { untyped } = await import("@/lib/db-untyped");
          const db = untyped(supabaseAdmin);
          let result = "aplicado";
          if (body.action === "add") {
            // Não rebaixa uma liberação manual que já existe com o mesmo host.
            const { data: cur } = await db.from("allowed_destination_hosts").select("host, source").eq("host", body.host).maybeSingle();
            if (cur && cur.source !== "toqy") {
              result = "ja_liberado_manualmente";
            } else {
              const { error } = await db
                .from("allowed_destination_hosts")
                .upsert({ host: body.host, include_subdomains: false, note: "Domínio de bio site Toqy", source: "toqy", owner_email: body.ownerEmail }, { onConflict: "host" });
              if (error) throw error;
            }
          } else {
            const { error } = await db.from("allowed_destination_hosts").delete().eq("host", body.host).eq("source", "toqy");
            if (error) throw error;
          }
          await db.from("toqy_partner_audit").insert({ host: body.host, action: body.action, result });
          return Response.json({ ok: true, result });
        } catch (error) {
          console.error("Erro na rota allow-host do Toqy", error);
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
