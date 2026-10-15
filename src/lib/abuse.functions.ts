import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimitShared, clientKey } from "@/lib/rateLimit";
import { untyped } from "@/lib/db-untyped";

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^GCARD-\d{4,8}$/, "Código inválido"),
  reason: z.enum(["golpe", "conteudo_ilegal", "outro"]),
  details: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(120).optional(),
});

/** Denúncia de abuso de um código (golpe, conteúdo ilegal). Sem login; limite por IP; a equipe analisa e pode desativar. */
export const reportAbuse = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (!(await rateLimitShared(`abuse:${clientKey(getRequest())}`, 5, 600_000))) {
      return { ok: false as const, error: "Muitas denúncias seguidas. Aguarde alguns minutos." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = untyped(supabaseAdmin);
    const { data: plate } = await db.from("plates").select("id").eq("short_code", data.code).maybeSingle();
    if (!plate) return { ok: false as const, error: "Não encontramos esse código." };
    const { error } = await db.from("abuse_reports").insert({
      plate_id: plate.id,
      short_code: data.code,
      reason: data.reason,
      details: data.details || null,
      contact: data.contact || null,
    });
    if (error) {
      console.error("falha ao salvar denúncia", error);
      return { ok: false as const, error: "Não conseguimos registrar agora. Tente de novo em instantes." };
    }
    return { ok: true as const };
  });
