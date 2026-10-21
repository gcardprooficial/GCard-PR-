import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { untyped } from "@/lib/db-untyped";
import { clientKey, rateLimit } from "@/lib/rateLimit";

const TOKEN = z.string().regex(/^[a-f0-9]{32}$/);
const TTL_MS = 3 * 3_600_000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return untyped(supabaseAdmin);
}

/** PC (equipe): abre uma sessão de bipador e devolve o segredo que vai no QR para o celular. */
export const createScanSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const db = await admin();
    await db.from("scan_sessions").delete().lt("expires_at", new Date(Date.now() - 86_400_000).toISOString()); // faxina
    const token = randomBytes(16).toString("hex");
    const { error } = await db.from("scan_sessions").insert({ token, created_by: context.userId, expires_at: new Date(Date.now() + TTL_MS).toISOString() });
    if (error) throw new Error("Não consegui abrir a sessão agora.");
    return { token };
  });

/** PC (equipe): códigos novos que o celular mandou (e se o celular está conectado). */
export const pollScanSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: TOKEN, afterId: z.number().int().min(0) }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const db = await admin();
    const { data: s } = await db.from("scan_sessions").select("expires_at, phone_seen_at").eq("token", data.token).maybeSingle();
    if (!s || new Date(s.expires_at).getTime() < Date.now()) return { ok: false as const };
    const { data: rows } = await db
      .from("scan_session_codes")
      .select("id, code")
      .eq("token", data.token)
      .gt("id", data.afterId)
      .order("id", { ascending: true })
      .limit(50);
    const connected = !!s.phone_seen_at && Date.now() - new Date(s.phone_seen_at).getTime() < 25_000;
    return { ok: true as const, connected, codes: (rows ?? []) as { id: number; code: string }[] };
  });

/** Celular (sem login, só com o segredo do QR): confirma que está conectado e que a sessão vale. */
export const pingScanSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: TOKEN }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`scan-ping:${clientKey(getRequest())}`, 60, 60_000)) return { ok: false as const, reason: "rate_limited" as const };
    const db = await admin();
    const { data: s } = await db.from("scan_sessions").select("expires_at").eq("token", data.token).maybeSingle();
    if (!s || new Date(s.expires_at).getTime() < Date.now()) return { ok: false as const, reason: "expired" as const };
    await db.from("scan_sessions").update({ phone_seen_at: new Date().toISOString() }).eq("token", data.token);
    return { ok: true as const };
  });

/** Celular: manda um código lido para o PC. Só texto curto; o PC valida tudo contra o banco. */
export const sendScanCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: TOKEN, code: z.string().trim().min(2).max(120) }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`scan-send:${data.token}`, 120, 60_000) || !rateLimit(`scan-send-ip:${clientKey(getRequest())}`, 240, 60_000)) {
      return { ok: false as const, reason: "rate_limited" as const };
    }
    const db = await admin();
    const { data: s } = await db.from("scan_sessions").select("expires_at").eq("token", data.token).maybeSingle();
    if (!s || new Date(s.expires_at).getTime() < Date.now()) return { ok: false as const, reason: "expired" as const };
    // o mesmo código lido em sequência (câmera parada no QR) não vira vários
    const { data: last } = await db
      .from("scan_session_codes")
      .select("code, created_at")
      .eq("token", data.token)
      .order("id", { ascending: false })
      .limit(1);
    const l = (last ?? [])[0] as { code: string; created_at: string } | undefined;
    if (l && l.code === data.code && Date.now() - new Date(l.created_at).getTime() < 3000) return { ok: true as const, duplicate: true as const };
    const { error } = await db.from("scan_session_codes").insert({ token: data.token, code: data.code });
    if (error) return { ok: false as const, reason: "error" as const };
    await db.from("scan_sessions").update({ phone_seen_at: new Date().toISOString() }).eq("token", data.token);
    return { ok: true as const };
  });
