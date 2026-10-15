import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit } from "@/lib/rateLimit";
import { untyped } from "@/lib/db-untyped";

/**
 * Autoriza e registra o download do QR de UM código. Só o dono do código (ou a equipe) passa: a leitura
 * usa o cliente do próprio usuário, então a RLS da tabela plates decide. Devolve a URL que vai dentro do QR
 * (/r/<token>?s=q: o destino final nunca entra no QR, então continua editável).
 */
export const registerQrDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plateId: z.string().uuid(), format: z.enum(["svg", "pdf", "png"]), mirrored: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!rateLimit(`qr-dl:${context.userId}`, 30, 600_000)) {
      return { ok: false as const, error: "Muitos downloads seguidos. Aguarde alguns minutos." };
    }
    const { data: plate } = await untyped(context.supabase)
      .from("plates")
      .select("id, token, short_code, status")
      .eq("id", data.plateId)
      .maybeSingle();
    if (!plate) return { ok: false as const, error: "Código não encontrado na sua conta." };
    if (plate.status === "bloqueada") return { ok: false as const, error: "Esse código está desativado." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await untyped(supabaseAdmin).rpc("track_event", {
      _type: "qr_baixado",
      _person_id: context.userId,
      _email: null,
      _order_id: null,
      _plate_id: plate.id,
      _first_touch: null,
      _data: { short_code: plate.short_code, format: data.format, mirrored: data.mirrored },
      _dedupe: null,
    });

    const origin = (process.env["PUBLIC_APP_URL"] ?? "https://gcardpro.com.br").replace(/\/$/, "");
    return { ok: true as const, shortCode: plate.short_code as string, url: `${origin}/r/${plate.token}?s=q` };
  });
