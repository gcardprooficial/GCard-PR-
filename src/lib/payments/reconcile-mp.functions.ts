import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const API = "https://api.mercadopago.com";

type MpPay = {
  id: number;
  status: string;
  external_reference: string | null;
  date_approved: string | null;
  money_release_date: string | null;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  payment_type_id?: string;
  fee_details?: { type: string; amount: number }[];
  transaction_details?: { net_received_amount?: number };
  collector_id?: number | null;
  status_detail?: string;
  money_release_status?: string;
  refunds?: { amount?: number; date_created?: string }[];
};

export type MpLine = {
  id: number;
  orderNumber: number | null;
  approvedAt: string | null;
  releaseAt: string | null;
  status: string;
  method: string | null;
  grossCents: number;
  feeCents: number;
  netCents: number;
  refundedCents: number;
  statusDetail: string | null;
  releaseStatus: string | null;
  refunds: { cents: number; at: string | null }[];
};

const cents = (n: number | undefined | null) => Math.round((n ?? 0) * 100);

async function assertTeam(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "staff"]);
  if (!data?.length) throw new Error("Sem permissão para esta ação.");
  return db;
}

async function fetchMonthPayments(month: string): Promise<MpLine[]> {
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!token) throw new Error("Mercado Pago não configurado.");
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(y, m, 0).getDate();
  const begin = `${month}-01T00:00:00.000-03:00`;
  const end = `${month}-${String(last).padStart(2, "0")}T23:59:59.999-03:00`;

  // A busca devolve pagamentos em que você é quem PAGOU também (Claude, Google, fatura...).
  // Só os que você RECEBEU (collector = você) entram aqui.
  let myId: number | null = null;
  try {
    const me = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (me.ok) myId = ((await me.json()) as { id?: number }).id ?? null;
  } catch {
    /* sem filtro de recebedor */
  }

  // Pagamentos aprovados no mês E pagamentos que mudaram no mês (devolução, contestação, retenção de
  // uma venda antiga) -- é daí que costumam vir os "débitos por dívida".
  const byId = new Map<number, MpPay>();
  for (const range of ["date_approved", "date_last_updated"] as const) {
    for (let offset = 0; offset < 500; offset += 100) {
      const url =
        `${API}/v1/payments/search?sort=${range}&criteria=asc&range=${range}` +
        `&begin_date=${encodeURIComponent(begin)}&end_date=${encodeURIComponent(end)}&limit=100&offset=${offset}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`Mercado Pago recusou a consulta [${res.status}]`);
      const json = (await res.json()) as { results?: MpPay[]; paging?: { total?: number } };
      for (const p of json.results ?? []) byId.set(p.id, p);
      if (!(json.results ?? []).length || offset + 100 >= (json.paging?.total ?? 0)) break;
    }
  }
  const raw = [...byId.values()].filter((p) => myId === null || p.collector_id === myId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  // Só UUIDs: uma referência qualquer (Pix na chave, etc.) derrubava a consulta inteira e nenhum pedido era achado.
  const isUuid = (x: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
  const refs = [...new Set(raw.map((p) => p.external_reference).filter((x): x is string => !!x && isUuid(x)))];
  const orderNo = new Map<string, number>();
  if (refs.length) {
    const { data } = await db.from("orders").select("id, order_number").in("id", refs);
    for (const o of (data ?? []) as { id: string; order_number: number }[]) orderNo.set(o.id, o.order_number);
  }

  return raw
    .filter((p) => ["approved", "refunded", "charged_back", "in_mediation"].includes(p.status))
    .map((p) => {
      const fee = (p.fee_details ?? []).reduce((s, f) => s + f.amount, 0);
      return {
        id: p.id,
        orderNumber: p.external_reference ? (orderNo.get(p.external_reference) ?? null) : null,
        approvedAt: p.date_approved,
        releaseAt: p.money_release_date,
        status: p.status,
        method: p.payment_type_id ?? null,
        grossCents: cents(p.transaction_amount),
        feeCents: cents(fee),
        netCents: cents(p.transaction_details?.net_received_amount ?? p.transaction_amount - fee),
        refundedCents: cents(p.transaction_amount_refunded),
        statusDetail: p.status_detail ?? null,
        releaseStatus: p.money_release_status ?? null,
        refunds: (p.refunds ?? []).map((r) => ({ cents: cents(r.amount), at: r.date_created ?? null })),
      };
    });
}

/** Saldo atual na conta do Mercado Pago (se o token tiver permissão; senão null). */
async function fetchBalance(): Promise<{ available: number; unavailable: number } | null> {
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!token) return null;
  try {
    const me = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (!me.ok) return null;
    const { id } = (await me.json()) as { id: number };
    const r = await fetch(`${API}/users/${id}/mercadopago_account/balance`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { available_balance?: number; unavailable_balance?: number };
    return { available: cents(j.available_balance), unavailable: cents(j.unavailable_balance) };
  } catch {
    return null;
  }
}

const monthSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/** Pagamentos reais do mês no Mercado Pago (bruto, taxa, líquido) + o que o Financeiro do site tem de taxas já lançadas. */
export const getMpReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => monthSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const [lines, balance] = await Promise.all([fetchMonthPayments(data.month), fetchBalance()]);
    return { lines, balance };
  });

/** Lança no Financeiro, como saída, a taxa real de cada pagamento do mês (1 por pedido, sem duplicar). */
export const syncMpFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => monthSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await assertTeam(context.userId);
    const lines = (await fetchMonthPayments(data.month)).filter((l) => l.status === "approved" && l.feeCents > 0 && l.approvedAt);
    const { data: existing } = await db.from("finance_entries").select("description").eq("category", "Taxas mercado pago");
    const done = new Set(((existing ?? []) as { description: string | null }[]).map((e) => e.description));
    let created = 0;
    for (const l of lines) {
      const description = `Taxa MP pagamento ${l.id}${l.orderNumber ? ` (pedido #${l.orderNumber})` : ""}`;
      if (done.has(description)) continue;
      const day = new Date(l.approvedAt!).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { error } = await db.from("finance_entries").insert({
        kind: "saida",
        category: "Taxas mercado pago",
        description,
        amount_cents: l.feeCents,
        entry_date: day,
        created_by: context.userId,
      });
      if (!error) created++;
    }
    return { created, checked: lines.length };
  });
