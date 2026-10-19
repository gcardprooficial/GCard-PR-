import { isDown, reportPeriod, sumByPlate, weekKey, type DailyRow } from "@/lib/plus-reports";

type Plate = { id: string; short_code: string; business_name: string | null; destination_url: string | null };

async function reachable(url: string): Promise<{ status?: number; error?: boolean }> {
  try {
    // Sem seguir redirecionamento: só queremos saber se o endereço responde. Tempo curto; corpo não é lido.
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "user-agent": "GCardPRO-Monitor/1.0" } });
    void res.body?.cancel();
    return { status: res.status };
  } catch {
    return { error: true };
  }
}

/** Relatório mensal (dia 1) e alerta de destino fora do ar (diário) para assinantes Plus em dia. Falha aqui nunca derruba o cron. */
export async function runPlusJobs(now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPlusEmail } = await import("@/lib/email-events.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const out = { subscribers: 0, reports: 0, alerts: 0, checked: 0 };

  const { data: enabled } = await db.rpc("plus_enabled");
  if (enabled !== true) return out;

  const { data: subs } = await db.from("plus_subscriptions").select("email").eq("status", "ativa").limit(500);
  const emails = [...new Set(((subs ?? []) as { email: string }[]).map((s) => s.email))];
  out.subscribers = emails.length;
  const period = reportPeriod(now);
  const week = weekKey(now);
  let budget = 300; // verificações de destino por execução

  const seen = async (key: string) =>
    Boolean((await db.from("plus_webhook_events").select("dedupe_key").eq("dedupe_key", key).maybeSingle()).data);
  const mark = (key: string, type: string) => db.from("plus_webhook_events").insert({ dedupe_key: key, event_type: type });

  for (const email of emails) {
    try {
      const { data: batches } = await db.from("batches").select("id").eq("owner_email", email);
      const bids = ((batches ?? []) as { id: string }[]).map((b) => b.id);
      if (bids.length === 0) continue;
      const { data: pl } = await db
        .from("plates")
        .select("id, short_code, business_name, destination_url")
        .in("batch_id", bids)
        .eq("status", "ativada");
      const plates = (pl ?? []) as Plate[];
      if (plates.length === 0) continue;
      const label = (p: Plate) => `${p.short_code}${p.business_name ? ` (${p.business_name})` : ""}`;

      // 1) Relatório do mês anterior (uma vez por assinante e mês)
      if (period && !(await seen(`report:${period.period}:${email}`))) {
        const { data: rows } = await db
          .from("plate_scan_daily")
          .select("plate_id, nfc, qr, leituras")
          .in("plate_id", plates.map((p) => p.id))
          .gte("day", period.from)
          .lte("day", period.to);
        const sums = sumByPlate((rows ?? []) as DailyRow[], plates.map((p) => p.id));
        const total = [...sums.values()].reduce((s, c) => s + c.total, 0);
        const lines = plates
          .map((p) => ({ p, c: sums.get(p.id)! }))
          .sort((a, b) => b.c.total - a.c.total)
          .map(({ p, c }) => `<tr><td style="padding:3px 12px 3px 0;">${esc(label(p))}</td><td style="padding:3px 8px;">NFC ${c.nfc}</td><td style="padding:3px 8px;">QR ${c.qr}</td><td style="padding:3px 0;"><strong>${c.total}</strong></td></tr>`)
          .join("");
        await sendPlusEmail({
          to: email,
          subject: `Seu relatório GCard Plus de ${period.period.slice(5)}/${period.period.slice(0, 4)}`,
          title: "Seu mês no GCard Plus",
          bodyHtml:
            `<p>No mês passado, seus códigos somaram <strong>${total}</strong> leituras (só pessoas, sem robôs).</p>` +
            `<table style="border-collapse:collapse;font-size:14px;">${lines}</table>` +
            `<p style="font-size:13px;color:#555;">Placas antigas não separam NFC de QR: entram só no total.</p>`,
        });
        await mark(`report:${period.period}:${email}`, "plus_report");
        out.reports++;
      }

      // 2) Destino fora do ar (1 alerta por código por semana)
      const down: Plate[] = [];
      for (const p of plates) {
        if (!p.destination_url || budget <= 0) continue;
        if (await seen(`down:${p.id}:${week}`)) continue;
        budget--;
        out.checked++;
        if (isDown(await reachable(p.destination_url))) down.push(p);
      }
      if (down.length > 0) {
        await sendPlusEmail({
          to: email,
          subject: "Um destino do seu GCard Plus parece fora do ar",
          title: "Destino fora do ar",
          bodyHtml:
            `<p>Estes códigos apontam para um endereço que não respondeu hoje:</p><ul>${down.map((p) => `<li>${esc(label(p))}</li>`).join("")}</ul>` +
            `<p>Se o site voltou, ignore. Se não, entre no painel e troque o destino: a sua placa ou QR continua funcionando.</p>`,
        });
        for (const p of down) await mark(`down:${p.id}:${week}`, "plus_down");
        out.alerts += down.length;
      }
    } catch (error) {
      console.error("Plus: falha num assinante", error); // sem e-mail no log
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
