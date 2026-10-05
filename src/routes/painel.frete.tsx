import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFreightByState } from "@/lib/shipping/melhorenvio.functions";

export const Route = createFileRoute("/painel/frete")({ component: FretePorEstado });

type Cell = { jadlog: number | null; correios: number | null } | { error: string };
type Row = { uf: string; acrilico: Cell; pvc: Cell };

const brl = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const best = (c: Cell) => ("error" in c ? null : [c.jadlog, c.correios].filter((x): x is number => x !== null).sort((a, b) => a - b)[0] ?? null);

function FretePorEstado() {
  const run = useServerFn(getFreightByState);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(25);

  async function load() {
    setLoading(true);
    try {
      setRows((await run()).rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui cotar agora.");
    } finally {
      setLoading(false);
    }
  }

  const limitCents = limit * 100;
  const over = rows?.filter((r) => (best(r.acrilico) ?? 0) > limitCents || (best(r.pvc) ?? 0) > limitCents) ?? [];

  const cell = (c: Cell) =>
    "error" in c ? (
      <span className="text-xs text-red-700">erro</span>
    ) : (
      <span className={best(c) !== null && best(c)! > limitCents ? "font-bold text-red-700" : "font-semibold text-g-green"}>
        {brl(best(c))}
        <span className="ml-1 block text-[10px] font-normal text-muted-foreground">
          J {brl(c.jadlog)} · C {brl(c.correios)}
        </span>
      </span>
    );

  return (
    <>
      <h1 className="text-2xl">Frete por estado</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Cotação do Melhor Envio (origem Indaiatuba/SP) para o CEP central de cada capital, 1 kit de placa e 1 de cartão. Mostra o mais barato entre Jadlog (J) e Correios (C). Só consulta preço, não compra etiqueta. Interior costuma ser mais caro que a capital.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="lim">Limite do frete diluído (R$)</label>
          <Input id="lim" type="number" min={1} value={limit} onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 25))} className="mt-1 h-10 w-32" />
        </div>
        <Button onClick={() => void load()} disabled={loading} className="h-10 font-bold">
          {loading ? "Cotando 27 estados…" : rows ? "Cotar de novo" : "Cotar todos os estados"}
        </Button>
      </div>

      {rows && (
        <>
          <p className="mt-5 text-sm">
            <strong>{rows.length - over.length}</strong> estados até {brl(limitCents)} · <strong className="text-red-700">{over.length}</strong> passam:{" "}
            <span className="font-semibold">{over.map((r) => r.uf).join(", ") || "nenhum"}</span>
          </p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">UF</th>
                  <th className="px-4 py-3">Placa (acrílico)</th>
                  <th className="px-4 py-3">Cartão (PVC)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uf} className="border-t border-border">
                    <td className="px-4 py-2.5 font-black">{r.uf}</td>
                    <td className="px-4 py-2.5">{cell(r.acrilico)}</td>
                    <td className="px-4 py-2.5">{cell(r.pvc)}</td>
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
