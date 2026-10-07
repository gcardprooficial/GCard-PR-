import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMonthlySales } from "@/lib/accounting.functions";

export const Route = createFileRoute("/painel/contador")({ component: Contador });

type Sale = Awaited<ReturnType<typeof getMonthlySales>>["rows"][number];

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dec = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const dt = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const cell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function currentMonth() {
  const d = new Date(Date.now() - 3 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toCsv(rows: Sale[]) {
  const head = ["Data pagamento", "Pedido", "Situação", "Valor (R$)", "Gateway", "Método", "ID no gateway", "Cupom", "Desconto cupom (R$)", "Cliente", "CPF/CNPJ", "E-mail"];
  const lines = rows.map((r) =>
    [
      dt(r.paid_at ?? r.created_at),
      r.order_number,
      r.payment_status,
      dec(r.total_cents),
      r.payment_provider,
      r.payment_method,
      r.provider_payment_id,
      r.coupon_code,
      dec(r.coupon_discount_cents ?? 0),
      r.customer_name,
      r.customer_document,
      r.customer_email,
    ]
      .map(cell)
      .join(";"),
  );
  // BOM + ";" pro Excel em português abrir certo.
  return "﻿" + [head.map(cell).join(";"), ...lines].join("\r\n");
}

function Contador() {
  const run = useServerFn(getMonthlySales);
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<Sale[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows((await run({ data: { month } })).rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui carregar.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-gcardpro-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const paid = rows?.filter((r) => r.payment_status === "pago") ?? [];
  const refunded = rows?.filter((r) => r.payment_status === "estornado") ?? [];
  const byProvider = new Map<string, { n: number; cents: number }>();
  for (const r of paid) {
    const k = r.payment_provider ?? "manual / sem gateway";
    const cur = byProvider.get(k) ?? { n: 0, cents: 0 };
    byProvider.set(k, { n: cur.n + 1, cents: cur.cents + r.total_cents });
  }
  const semData = paid.filter((r) => !r.paid_at).length;
  const total = paid.reduce((s, r) => s + r.total_cents, 0);

  return (
    <>
      <h1 className="text-2xl">Contador</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Vendas pagas do GCard-PRÓ no mês (pelo dia do pagamento, ou do pedido se faltar; horário de Brasília), prontas para entregar ao contador. Não inclui o TOQY (Kiwify).
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="mes">Mês</label>
          <Input id="mes" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 h-10 w-44" />
        </div>
        <Button onClick={() => void load()} disabled={loading} className="h-10 font-bold">
          {loading ? "Carregando…" : "Ver vendas do mês"}
        </Button>
        {rows && rows.length > 0 && (
          <Button onClick={download} variant="outline" className="h-10 font-bold">
            Baixar CSV (Excel)
          </Button>
        )}
      </div>

      {rows && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-4 card-soft">
              <p className="text-xs font-semibold text-muted-foreground">Faturamento pago</p>
              <p className="text-2xl font-black">{brl(total)}</p>
              <p className="text-xs text-muted-foreground">{paid.length} pedido(s)</p>
            </div>
            <div className="rounded-2xl bg-card p-4 card-soft">
              <p className="text-xs font-semibold text-muted-foreground">Estornados no mês</p>
              <p className="text-2xl font-black">{brl(refunded.reduce((s, r) => s + r.total_cents, 0))}</p>
              <p className="text-xs text-muted-foreground">{refunded.length} pedido(s), já fora do faturamento acima</p>
            </div>
            <div className="rounded-2xl bg-card p-4 card-soft">
              <p className="text-xs font-semibold text-muted-foreground">Por gateway</p>
              {[...byProvider].map(([k, v]) => (
                <p key={k} className="text-sm">
                  <strong>{k}</strong>: {brl(v.cents)} ({v.n})
                </p>
              ))}
              {byProvider.size === 0 && <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </div>
          {rows.length >= 5000 && (
            <p className="mt-2 text-xs text-red-700">Limite de 5.000 linhas atingido: a lista pode estar incompleta.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {semData > 0 && (
              <>
                {semData} pedido(s) pago(s) não têm data de pagamento registrada (marcados à mão ou antigos): usei a data do pedido.{" "}
              </>
            )}
            Confira com o extrato de cada gateway: o contador usa o que entrou na conta, e este relatório é só a visão do site.
          </p>
        </>
      )}
    </>
  );
}
