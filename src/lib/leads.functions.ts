import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const schema = z.object({
  businessName: z.string().trim().min(2).max(160),
  placeId: z.string().trim().max(400).optional().nullable(),
  whatsapp: z.string().trim().max(20).optional().nullable(),
});

/** Lead da ferramenta grátis (gerador de link): dono quer contato pra oferecer cartão/placa físicos. */
export const submitToolLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`tool-lead:${clientKey(getRequest())}`, 10, 300_000)) {
      return { ok: false as const, error: "Muitas tentativas seguidas. Aguarde um pouco." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Tipos gerados do Supabase não conhecem a tabela nova ainda.
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await db.from("tool_leads").insert({
      business_name: data.businessName,
      place_id: data.placeId || null,
      whatsapp: data.whatsapp || null,
    });
    if (error) {
      console.error("Falha ao salvar lead da ferramenta", error);
      return { ok: false as const, error: "Não consegui salvar agora. Chame no WhatsApp direto." };
    }
    const { notifyAdminNewLead } = await import("@/lib/email-events.server");
    await notifyAdminNewLead({ businessName: data.businessName, whatsapp: data.whatsapp || null });
    return { ok: true as const };
  });
