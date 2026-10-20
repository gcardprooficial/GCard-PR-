import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rateLimit";

export type PublicReport = {
  name: string;
  shortCode: string;
  days: number;
  from: string;
  to: string;
  series: { day: string; leituras: number; nfc: number; qr: number }[];
};

/**
 * Relatório do cliente (link privado). Só agregados por dia de UM código: sem destino, sem token do código, sem pessoa.
 * Vale só com o dono em dia no Plus e com o link não revogado.
 */
export const getPublicReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!rateLimit(`report:${clientKey(getRequest())}`, 30, 60_000)) return { ok: false as const, error: "rate_limited" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: link } = await db.from("plate_report_links").select("plate_id, revoked_at").eq("token", data.token).maybeSingle();
    if (!link || link.revoked_at) return { ok: false as const, error: "not_found" as const };
    const { data: plate } = await db.from("plates").select("id, short_code, business_name, batch_id").eq("id", link.plate_id).maybeSingle();
    if (!plate?.batch_id) return { ok: false as const, error: "not_found" as const };

    // Dono com Plus em dia (sem isso o link fica indisponível; nada se perde, volta quando reativar).
    const { data: batch } = await db.from("batches").select("owner_email").eq("id", plate.batch_id).maybeSingle();
    const mail = (batch?.owner_email as string | null)?.toLowerCase();
    if (!mail) return { ok: false as const, error: "unavailable" as const };
    const { data: sub } = await db.from("plus_subscriptions").select("id").eq("email", mail).eq("status", "ativa").limit(1);
    if (!sub || sub.length === 0) return { ok: false as const, error: "unavailable" as const };

    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const from = day(data.days - 1);
    const to = day(0);
    const { data: rows } = await db
      .from("plate_scan_daily")
      .select("day, leituras, nfc, qr")
      .eq("plate_id", plate.id)
      .gte("day", from)
      .lte("day", to);
    const byDay = new Map<string, { leituras: number; nfc: number; qr: number }>();
    for (const r of (rows ?? []) as { day: string; leituras: number; nfc: number; qr: number }[]) {
      byDay.set(r.day, { leituras: Number(r.leituras), nfc: Number(r.nfc), qr: Number(r.qr) });
    }
    const series: PublicReport["series"] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const d = day(i);
      series.push({ day: d, ...(byDay.get(d) ?? { leituras: 0, nfc: 0, qr: 0 }) });
    }
    const report: PublicReport = { name: plate.business_name || plate.short_code, shortCode: plate.short_code, days: data.days, from, to, series };
    return { ok: true as const, report };
  });
