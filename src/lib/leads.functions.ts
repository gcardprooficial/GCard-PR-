import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { untyped } from "@/lib/db-untyped";

const GOOGLE_REVIEW_HOSTS = ["search.google.com", "www.google.com", "google.com", "maps.google.com", "g.page"];

const leadSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  placeId: z.string().trim().max(400).optional().nullable(),
  whatsapp: z.string().trim().max(20).optional().nullable(),
});

/**
 * Lead do gerador grátis (agora só para quem tem conta): fica ligado à conta (user_id + e-mail) e guarda a origem
 * da primeira visita. O dono quer contato para oferecer cartão/placa físicos.
 */
export const submitToolLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leadSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!rateLimit(`tool-lead:${clientKey(getRequest())}`, 10, 300_000)) {
      return { ok: false as const, error: "Muitas tentativas seguidas. Aguarde um pouco." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { firstTouchFromRequest } = await import("@/lib/events.server");
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const { error } = await untyped(supabaseAdmin).from("tool_leads").insert({
      business_name: data.businessName,
      place_id: data.placeId || null,
      whatsapp: data.whatsapp || null,
      source: "gerador",
      user_id: context.userId,
      email: user.user?.email?.toLowerCase() ?? null,
      first_touch: firstTouchFromRequest(),
    });
    if (error) {
      console.error("Falha ao salvar lead da ferramenta", error);
      return { ok: false as const, error: "Não consegui salvar agora. Chame no WhatsApp direto." };
    }
    const { notifyAdminNewLead } = await import("@/lib/email-events.server");
    await notifyAdminNewLead({ businessName: data.businessName, whatsapp: data.whatsapp || null });
    return { ok: true as const };
  });

const emailSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  placeId: z.string().trim().max(400).optional().nullable(),
  reviewUrl: z.string().trim().url().max(500),
  /** Aceite de novidades (com o texto versionado exibido). Sem aceite, o e-mail leva só o link. */
  consent: z.boolean(),
});

/** "Receber esse link por e-mail": manda para o e-mail da conta; salva o lead com origem gerador e o aceite. */
export const emailReviewLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => emailSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!rateLimit(`tool-email:${context.userId}`, 5, 600_000)) {
      return { ok: false as const, error: "Muitos envios seguidos. Aguarde alguns minutos." };
    }
    let host = "";
    try {
      const u = new URL(data.reviewUrl);
      host = u.protocol === "https:" ? u.hostname : "";
    } catch {
      host = "";
    }
    if (!GOOGLE_REVIEW_HOSTS.includes(host)) return { ok: false as const, error: "Link inválido." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = user.user?.email?.toLowerCase();
    if (!email) return { ok: false as const, error: "Não encontramos o e-mail da sua conta." };

    const { upsertCustomerConsent, sendReviewLinkEmail } = await import("@/lib/email-events.server");
    const { firstTouchFromRequest } = await import("@/lib/events.server");
    const fullName = (user.user?.user_metadata?.["full_name"] as string | undefined) ?? "";
    await upsertCustomerConsent({ email, name: fullName, consent: data.consent, source: "gerador", userId: context.userId });
    const { error } = await untyped(supabaseAdmin).from("tool_leads").insert({
      business_name: data.businessName,
      place_id: data.placeId || null,
      source: "gerador",
      user_id: context.userId,
      email,
      email_consent_at: data.consent ? new Date().toISOString() : null,
      first_touch: firstTouchFromRequest(),
    });
    if (error) console.error("Falha ao salvar lead (e-mail do gerador)", error);
    try {
      await sendReviewLinkEmail({ to: email, businessName: data.businessName, reviewUrl: data.reviewUrl, withTips: data.consent });
    } catch (e) {
      console.error("Falha ao enviar e-mail do gerador", e);
      return { ok: false as const, error: "Não consegui enviar o e-mail agora. Copie o link pela tela." };
    }
    return { ok: true as const };
  });
