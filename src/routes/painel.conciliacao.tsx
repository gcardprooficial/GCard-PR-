import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMpReconciliation, syncMpFees, type MpLine } from "@/lib/payments/reconcile-mp.functions";

export const Route = createFileRoute("/painel/conciliacao")({ component: Conciliacao });

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const num = (s: string) => {
  const n = Number.parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

function currentMonth() {
  const d = new Date(Date.now() - 3 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function Conciliacao() {
  const load = useServerFn(getMpReconciliation);
  const sync = useServerFn(syncMpFees);
  const [month, setMonth] = useState(currentMonth());
  const [lines, setLines] = useState<MpLine[] | null>(null);
  const [balance, setBalance] = useState<{ available: number; unavailable: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState("0");
  const [current, setCurrent] = useState("");
  const [mpOut, setMpOut] = useState("");
  // Entradas de venda que o Financeiro do site tem no mês (pelo pedido), p/ comparar com o Mercado Pago.
  const [fin, setFin] = useState<{ order: number; cents: number; provider: string | null }[] | null>(null);

  async function run() {
    setLoading(true);
    try {
      const r = await load({ data: { month } });
      const [y, m] = month.split("-").map(Number) as [number, number];
      const start = `${month}-01`;
      const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const { data: f } = await supabase
        .from("finance_entries")
        .select("amount_cents, orders(order_number, payment_provider)")
        .eq("kind", "entrada")
        .not("order_id", "is", null)
        .gte("entry_date", start)
        .lt("entry_date", end);
      setFin(
        ((f ?? []) as unknown as { amount_cents: number; orders: { order_number: number; payment_provider: string | null } | null }[])
          .filter((x) => x.orders)
          .map((x) => ({ order: x.orders!.order_number, cents: x.amount_cents, provider: x.orders!.payment_provider })),
      );
      setLines(r.lines);
      setBalance(r.balance);
      if (r.balance) setCurrent(((r.balance.available + r.balance.unavailable) / 100).toFixed(2).replace(".", ","));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui consultar o Mercado Pago.");
    } finally {
      setLoading(false);
    }
  }

  async function lancarTaxas() {
    if (!confirm("Lançar no Financeiro, como saída, a taxa de cada pagamento deste mês? (Não duplica o que já foi lançado.)")) return;
    try {
      const r = await sync({ data: { month } });
      toast.success(`${r.created} taxa(s) lançada(s) de ${r.checked} pagamento(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui lançar.");
    }
  }

  const t = useMemo(() => {
    const ok = (lines ?? []).filter((l) => l.status === "approved");
    const all = lines ?? [];
    const sum = (f: (l: MpLine) => number, arr = all) => arr.reduce((s, l) => s + f(l), 0);
    const now = Date.now();
    return {
      gross: sum((l) => l.grossCents),
      fee: sum((l) => l.feeCents),
      net: sum((l) => l.netCents),
      refunded: sum((l) => l.refundedCents),
      released: sum((l) => l.netCents, ok.filter((l) => l.releaseAt && new Date(l.releaseAt).getTime() <= now)),
      pending: sum((l) => l.netCents, ok.filter((l) => !l.releaseAt || new Date(l.releaseAt).getTime() > now)),
    };
  }, [lines]);

  const outflow = lines ? num(opening) + t.net - t.refunded - num(current) : 0;
  const expected = num(opening) + t.net - t.refunded - num(mpOut);

  // Pedido a pedido: o que o Mercado Pago aprovou x o que o Financeiro lançou como Mercado Pago.
  const diff = useMemo(() => {
    if (!lines || !fin) return null;
    const mp = new Map<number, number>();
    for (const l of lines) if (l.status === "approved" && l.orderNumber) mp.set(l.orderNumber, (mp.get(l.orderNumber) ?? 0) + l.grossCents);
    const gc = new Map<number, number>();
    for (const e of fin) if (e.provider === "mercadopago") gc.set(e.order, (gc.get(e.order) ?? 0) + e.cents);
    const onlyMp = [...mp].filter(([o]) => !gc.has(o)).map(([o, c]) => ({ o, c }));
    const onlyGc = [...gc].filter(([o]) => !mp.has(o)).map(([o, c]) => ({ o, c }));
    const valueDiff = [...mp].filter(([o, c]) => gc.has(o) && gc.get(o) !== c).map(([o, c]) => ({ o, mp: c, gc: gc.get(o)! }));
    const notMpProviders = fin.filter((e) => e.provider !== "mercadopago");
    return { onlyMp, onlyGc, valueDiff, notMpProviders };
  }, [lines, fin]);

  return (
    <>
      <h1 className="text-2xl">Conciliação com o Mercado Pago</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Puxa os pagamentos reais do mês direto do Mercado Pago (valor cobrado, taxa e o que entrou líquido) para você conferir com o seu saldo e com o Financeiro. Só consulta, não mexe no dinheiro.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="m">Mês</label>
          <Input id="m" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 h-10 w-44" />
        </div>
        <Button onClick={() => void run()} disabled={loading} className="h-10 font-bold">
          {loading ? "Consultando…" : "Consultar Mercado Pago"}
        </Button>
        {lines && lines.length > 0 && (
          <Button onClick={() => void lancarTaxas()} variant="outline" className="h-10 font-bold">
            Lançar taxas no Financeiro
          </Button>
        )}
      </div>

      {lines && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Cobrado dos clientes", brl(t.gross), `${lines.length} pagamento(s)`],
              ["Taxas do Mercado Pago", brl(t.fee), "descontadas do que você recebe"],
              ["Líquido (entrou para você)", brl(t.net), "cobrado − taxas"],
              ["Estornado/devolvido", brl(t.refunded), "saiu da conta"],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-2xl bg-card p-4 card-soft">
                <p className="text-xs font-semibold text-muted-foreground">{k}</p>
                <p className="text-xl font-black">{v}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm">
            Líquido já liberado: <strong>{brl(t.released)}</strong> · ainda a liberar/retido: <strong>{brl(t.pending)}</strong>
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">Bate com o seu saldo?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saldo atual = saldo do início do mês + líquido recebido − devoluções − tudo o que saiu da conta (transferências para o banco, gastos e compras no Mercado Pago).
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="o">Saldo no início do mês (R$)</label>
                <Input id="o" value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" className="mt-1 h-10 w-40" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="c">
                  Saldo total hoje (disponível + retido) (R$){balance ? " — vindo do Mercado Pago" : ""}
                </label>
                <Input id="c" value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="decimal" placeholder="Ex.: 1864,85" className="mt-1 h-10 w-56" />
              </div>
            </div>
            {current && (
              <p className="mt-3 text-sm">
                O que <strong>saiu da conta</strong> no período, pela conta: <strong className="text-red-700">{brl(Math.max(0, outflow))}</strong>
                {outflow < 0 ? " (negativo: o saldo está maior que o recebido — confira o saldo inicial ou depósitos)" : ""}
                . Compare com as “Saídas” do extrato do Mercado Pago. Se for parecido, está batendo; se o extrato mostrar bem menos, falta dinheiro explicado.
              </p>
            )}
            {!balance && <p className="mt-2 text-xs text-muted-foreground">O Mercado Pago não liberou o saldo pela API: digite o saldo que aparece no seu app.</p>}
          </div>

          {diff && (
            <div className="mt-5 rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-bold">Pedido a pedido: Mercado Pago × Financeiro do site</p>
              <ul className="mt-2 space-y-2 text-sm">
                <li>
                  <strong>No Mercado Pago, sem entrada no Financeiro:</strong>{" "}
                  {diff.onlyMp.length ? diff.onlyMp.map((x) => `#${x.o} (${brl(x.c)})`).join(", ") : "nenhum ✓"}
                </li>
                <li>
                  <strong>No Financeiro como Mercado Pago, sem pagamento aprovado no mês:</strong>{" "}
                  {diff.onlyGc.length ? diff.onlyGc.map((x) => `#${x.o} (${brl(x.c)})`).join(", ") : "nenhum ✓"}
                  {diff.onlyGc.length ? <span className="text-muted-foreground"> — pode ser pedido aprovado em outro mês, estornado ou marcado à mão.</span> : null}
                </li>
                <li>
                  <strong>Valor diferente entre os dois:</strong>{" "}
                  {diff.valueDiff.length ? diff.valueDiff.map((x) => `#${x.o} (MP ${brl(x.mp)} × site ${brl(x.gc)})`).join(", ") : "nenhum ✓"}
                </li>
                <li className="text-muted-foreground">
                  Entradas do Financeiro que <strong>não são Mercado Pago</strong> (InfinitePay, Pix, manual): {diff.notMpProviders.length} lançamento(s), {brl(diff.notMpProviders.reduce((s, e) => s + e.cents, 0))} — estas não existem no extrato do Mercado Pago.
                </li>
              </ul>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">Conferir com as saídas do extrato do Mercado Pago</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Digite o total de saídas do mês no extrato do Mercado Pago. Lembre: Pix que você fez em outubro conta como saída de outubro lá, mesmo que no Financeiro você tenha lançado em setembro.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="s">Total de saídas no Mercado Pago (R$)</label>
                <Input id="s" value={mpOut} onChange={(e) => setMpOut(e.target.value)} inputMode="decimal" className="mt-1 h-10 w-48" />
              </div>
            </div>
            {mpOut && current ? (
              <p className="mt-3 text-sm">
                Saldo esperado = {brl(num(opening))} + {brl(t.net)} − {brl(t.refunded)} − {brl(num(mpOut))} = <strong>{brl(expected)}</strong>. Saldo real: <strong>{brl(num(current))}</strong>. Diferença:{" "}
                <strong className={Math.abs(expected - num(current)) < 100 ? "text-green-700" : "text-red-700"}>{brl(expected - num(current))}</strong>
                {Math.abs(expected - num(current)) < 100 ? " — bate (diferença só de centavos/arredondamento)." : " — não bate: confira o saldo do início do mês e se há entradas no extrato que não são vendas (depósitos, reembolsos)."}
              </p>
            ) : null}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Aprovado</th>
                  <th className="px-3 py-2">Pedido</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2 text-right">Cobrado</th>
                  <th className="px-3 py-2 text-right">Taxa</th>
                  <th className="px-3 py-2 text-right">Líquido</th>
                  <th className="px-3 py-2">Libera em</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2">{dt(l.approvedAt)}</td>
                    <td className="px-3 py-2">{l.orderNumber ? `#${l.orderNumber}` : "—"}</td>
                    <td className="px-3 py-2">{l.status}</td>
                    <td className="px-3 py-2 text-right">{brl(l.grossCents)}</td>
                    <td className="px-3 py-2 text-right text-red-700">{brl(l.feeCents)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{brl(l.netCents)}</td>
                    <td className="px-3 py-2">{dt(l.releaseAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
