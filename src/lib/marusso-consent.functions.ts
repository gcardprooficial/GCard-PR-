import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { untyped } from "@/lib/db-untyped";
import { rateLimitShared } from "@/lib/rateLimit";
import { CONSENT_TEXT_VERSION, MARUSSO_CONSENT_VERSION } from "@/lib/consent";

const emailOf = (claims: unknown) => String((claims as { email?: string }).email ?? "").trim().toLowerCase();

/** O aceite Marusso da conta: vale o último registro desta versão para o e-mail (sem registro = desligado). */
export const getMarussoConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = emailOf(context.claims);
    if (!email) return { subscribed: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await untyped(supabaseAdmin)
      .from("consent_records")
      .select("accepted")
      .eq("email", email)
      .eq("text_version", MARUSSO_CONSENT_VERSION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscribed: data?.accepted === true };
  });

/**
 * Interruptor nas Configurações da conta.
 * Ligar: aceite Marusso (origem "configuracoes").
 * Desligar: descadastro TOTAL: revoga o aceite Marusso e o aceite de novidades do GCard/TOQY (2026-10-v1) e marca o
 * contato como descadastrado. Cada revogação vira um consentimento_revogado no hub (origem "configuracoes").
 */
export const setMarussoConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ on: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const email = emailOf(context.claims);
    if (!email) return { ok: false as const, error: "Sua conta não tem e-mail." };
    if (!(await rateLimitShared(`marusso-cfg:${context.userId}`, 20, 3_600_000))) {
      return { ok: false as const, error: "Muitas alterações seguidas. Aguarde um pouco." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = untyped(supabaseAdmin);
    const row = (version: string, accepted: boolean) => ({
      email,
      user_id: context.userId,
      accepted,
      text_version: version,
      source: "configuracoes",
    });
    if (data.on) {
      const { error } = await db.from("consent_records").insert(row(MARUSSO_CONSENT_VERSION, true));
      if (error) return { ok: false as const, error: "Não consegui salvar agora. Tente de novo." };
      return { ok: true as const, subscribed: true };
    }
    const { error } = await db
      .from("consent_records")
      .insert([row(MARUSSO_CONSENT_VERSION, false), row(CONSENT_TEXT_VERSION, false)]);
    if (error) return { ok: false as const, error: "Não consegui salvar agora. Tente de novo." };
    // Descadastro total também no contato de marketing do GCard (se existir).
    await db.from("marketing_contacts").update({ marketing_unsubscribed_at: new Date().toISOString() }).eq("email", email);
    return { ok: true as const, subscribed: false };
  });
