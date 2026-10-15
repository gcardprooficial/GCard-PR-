import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { untyped } from "@/lib/db-untyped";

export type FunnelRow = {
  source: string;
  viu_produto: number;
  contas: number;
  confirmados: number;
  checkouts: number;
  pagamentos_iniciados: number;
  pagos: number;
};

export type AccountRow = {
  user_id: string;
  email: string;
  created_at: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  source: string;
  consented: boolean;
  orders_count: number;
  paid_orders: number;
  is_internal: boolean;
  engagement: "quente" | "morno" | "nao_confirmado";
};

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return untyped(supabaseAdmin);
}

export const getFunnelReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ from: dateStr, to: dateStr, includeInternal: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { data: rows, error } = await (await db()).rpc("funnel_report", {
      _from: data.from,
      _to: data.to,
      _include_internal: data.includeInternal,
    });
    if (error) throw new Error("Não consegui montar o funil.");
    return (rows ?? []) as FunnelRow[];
  });

/** Contas sem compra paga (ou todas), já classificadas. Contas internas/teste saem por padrão. */
export const getAccountsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ onlyWithoutPurchase: z.boolean().default(true), includeInternal: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { data: rows, error } = await (await db()).rpc("accounts_report");
    if (error) throw new Error("Não consegui montar a lista de contas.");
    let list = (rows ?? []) as AccountRow[];
    if (!data.includeInternal) list = list.filter((a) => !a.is_internal);
    if (data.onlyWithoutPurchase) list = list.filter((a) => Number(a.paid_orders) === 0);
    return list;
  });

/** Marca ou desmarca um e-mail como interno/teste. */
export const setInternalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email().max(200), internal: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const client = await db();
    const email = data.email.toLowerCase();
    const { error } = data.internal
      ? await client.from("internal_accounts").upsert({ email }, { onConflict: "email" })
      : await client.from("internal_accounts").delete().eq("email", email);
    if (error) throw new Error("Não consegui salvar a marcação.");
    return { ok: true };
  });

/** Célula de CSV segura (aspas escapadas, proteção contra fórmula). */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/**
 * CSV das contas. "marketing" só leva quem aceitou novidades e não se descadastrou (mesma regra do export de pessoas);
 * "operacional" leva todas as listadas, sem coluna de consentimento.
 */
export const exportAccountsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mode: z.enum(["operacional", "marketing"]), onlyWithoutPurchase: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { data: rows, error } = await (await db()).rpc("accounts_report");
    if (error) throw new Error("Não consegui montar a exportação.");
    let list = ((rows ?? []) as AccountRow[]).filter((a) => !a.is_internal);
    if (data.onlyWithoutPurchase) list = list.filter((a) => Number(a.paid_orders) === 0);

    let header: string[];
    let lines: string[][];
    if (data.mode === "marketing") {
      list = list.filter((a) => a.consented);
      header = ["email", "origem", "criada_em"];
      lines = list.map((a) => [a.email, a.source, day(a.created_at)]);
    } else {
      header = ["email", "origem", "criada_em", "email_confirmado", "ultimo_acesso", "engajamento", "pedidos", "pedidos_pagos"];
      lines = list.map((a) => [
        a.email,
        a.source,
        day(a.created_at),
        a.confirmed ? "sim" : "nao",
        day(a.last_sign_in_at),
        a.engagement,
        String(a.orders_count),
        String(a.paid_orders),
      ]);
    }
    const csv = "﻿" + [header.map(cell).join(","), ...lines.map((l) => l.map(cell).join(","))].join("\r\n");
    return { csv, count: lines.length, filename: data.mode === "marketing" ? "contas-consentidas.csv" : "contas-sem-compra.csv" };
  });

/** Lembrete de vencimento do domínio: app_settings.domain_expires_at = {"date":"YYYY-MM-DD"}. */
export const getDomainExpiry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { data } = await (await db()).from("app_settings").select("value").eq("key", "domain_expires_at").maybeSingle();
    const date = (data?.value as { date?: string } | null)?.date ?? null;
    return { date };
  });

export const setDomainExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ date: dateStr }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { error } = await (await db())
      .from("app_settings")
      .upsert({ key: "domain_expires_at", value: { date: data.date } }, { onConflict: "key" });
    if (error) throw new Error("Não consegui salvar a data.");
    return { ok: true };
  });
