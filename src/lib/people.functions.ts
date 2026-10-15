import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { untyped } from "@/lib/db-untyped";

type Person = {
  email: string;
  name: string | null;
  phone: string | null;
  first_source: string | null;
  first_seen: string | null;
  orders_count: number;
  paid_orders: number;
  paid_total_cents: number;
  last_paid_at: string | null;
  plates_activated: number;
  has_account: boolean;
  email_confirmed: boolean;
  marketing_consent_at: string | null;
  marketing_unsubscribed_at: string | null;
};

/** Célula de CSV segura: aspas escapadas e proteção contra fórmula (=, +, -, @) ao abrir no Excel/Planilhas. */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/**
 * Exportação por pessoa (e-mail). Só equipe. Duas versões:
 *  - operacional: tudo que a operação precisa, SEM campos de marketing e sem CPF/CNPJ;
 *  - marketing: só quem aceitou novidades e não se descadastrou (e-mail, nome, origem, data do aceite).
 */
export const exportPeopleCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mode: z.enum(["operacional", "marketing"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await untyped(supabaseAdmin).rpc("people_summary");
    if (error) throw new Error("Não consegui montar a exportação.");
    const people = (rows ?? []) as Person[];

    let header: string[];
    let lines: string[][];
    if (data.mode === "marketing") {
      const consented = people.filter((p) => p.marketing_consent_at && !p.marketing_unsubscribed_at);
      header = ["email", "nome", "origem", "aceite_em"];
      lines = consented.map((p) => [p.email, p.name ?? "", p.first_source ?? "", day(p.marketing_consent_at)]);
    } else {
      header = ["email", "nome", "celular", "origem", "primeiro_contato", "pedidos", "pedidos_pagos", "total_pago_reais", "ultimo_pagamento", "codigos_ativados", "tem_conta", "email_confirmado"];
      lines = people.map((p) => [
        p.email,
        p.name ?? "",
        p.phone ?? "",
        p.first_source ?? "",
        day(p.first_seen),
        String(p.orders_count),
        String(p.paid_orders),
        (Number(p.paid_total_cents) / 100).toFixed(2),
        day(p.last_paid_at),
        String(p.plates_activated),
        p.has_account ? "sim" : "nao",
        p.email_confirmed ? "sim" : "nao",
      ]);
    }
    const csv = "﻿" + [header.map(cell).join(","), ...lines.map((l) => l.map(cell).join(","))].join("\r\n");
    return { csv, count: lines.length, filename: data.mode === "marketing" ? "contatos-consentidos.csv" : "pessoas-operacional.csv" };
  });
