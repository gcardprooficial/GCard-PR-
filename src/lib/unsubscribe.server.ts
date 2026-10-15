import { untyped } from "@/lib/db-untyped";

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUnsubscribeToken = (t: string | null | undefined): t is string => Boolean(t && TOKEN_RE.test(t));

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/** E-mail (mascarado) dono do token, sem alterar nada. */
export async function describeUnsubscribe(token: string): Promise<{ email: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await untyped(supabaseAdmin).from("marketing_contacts").select("email").eq("unsubscribe_token", token).maybeSingle();
  return data ? { email: maskEmail(data.email as string) } : null;
}

/** Descadastra de verdade (só chamado por POST: clique no botão da página /sair ou "one-click" do provedor de e-mail). */
export async function applyUnsubscribe(token: string): Promise<{ ok: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = untyped(supabaseAdmin);
  const { data: contact } = await db.from("marketing_contacts").select("email").eq("unsubscribe_token", token).maybeSingle();
  if (!contact) return { ok: false };
  const { error } = await db
    .from("marketing_contacts")
    .update({ marketing_unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token);
  if (error) return { ok: false };
  const { CONSENT_TEXT_VERSION } = await import("@/lib/consent");
  await db.from("consent_records").insert({
    email: String(contact.email).toLowerCase(),
    accepted: false,
    text_version: CONSENT_TEXT_VERSION,
    source: "sair",
  });
  return { ok: true };
}
