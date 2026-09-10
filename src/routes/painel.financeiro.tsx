import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import { usePanel } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/financeiro")({ component: Financeiro });

type Entry = {
  id: string;
  kind: "entrada" | "saida";
  category: string;
  description: string | null;
  amount_cents: number;
  entry_date: string;
  is_recurring: boolean;
};
type Partner = { id: string; name: string; share_percent: number };

/** "1.234,56" | "1234.56" | "1234,5" -> cents */
function parseBRL(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start, end };
}

function Financeiro() {
  const { userId } = usePanel();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [kind, setKind] = useState<"entrada" | "saida">("saida");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);
    const [e, p] = await Promise.all([
      supabase
        .from("finance_entries")
        .select("id, kind, category, description, amount_cents, entry_date, is_recurring")
        .gte("entry_date", start)
        .lt("entry_date", end)
        .order("entry_date", { ascending: false }),
      supabase.from("finance_partners").select("id, name, share_percent").eq("is_active", true),
    ]);
    if (e.error) {
      toast.error("Não foi possível carregar o financeiro.");
      return;
    }
    setEntries((e.data ?? []) as Entry[]);
    setPartners((p.data ?? []) as Partner[]);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const inc = (entries ?? []).filter((x) => x.kind === "entrada").reduce((s, x) => s + x.amount_cents, 0);
    const out = (entries ?? []).filter((x) => x.kind === "saida").reduce((s, x) => s + x.amount_cents, 0);
    return { inc, out, net: inc - out };
  }, [entries]);

  async function add(ev: FormEvent) {
    ev.preventDefault();
    const cents = parseBRL(amount);
    if (cents <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    if (category.trim().length < 2) {
      toast.error("Informe a categoria.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("finance_entries").insert({
      kind,
      category: category.trim(),
      description: description.trim() || null,
      amount_cents: cents,
      entry_date: date,
      is_recurring: recurring,
      recurrence: recurring ? "mensal" : null,
      created_by: userId,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível lançar.");
      return;
    }
    setCategory("");
    setDescription("");
    setAmount("");
    setRecurring(false);
    toast.success("Lançamento registrado.");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("finance_entries").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    setEntries((prev) => prev?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Financeiro</h1>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 w-44"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Entradas" value={money(totals.inc)} tone="pos" />
        <Card label="Saídas" value={money(totals.out)} tone="neg" />
        <Card label="Saldo" value={money(totals.net)} tone={totals.net >= 0 ? "pos" : "neg"} />
      </div>

      {partners.length > 0 && (
        <div className="mt-4 rounded-2xl bg-card p-5 card-soft">
          <p className="text-sm font-semibold">Divisão do saldo</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {partners.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {p.name} ({p.share_percent}%)
                </span>
                <span className="font-medium">
                  {money(Math.round((totals.net * p.share_percent) / 100))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={add} className="mt-6 rounded-2xl bg-card p-5 card-soft">
        <p className="text-sm font-semibold">Novo lançamento</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs">Tipo</Label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "entrada" | "saida")}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Insumos, frete, venda…"
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            Recorrente (mensal)
          </label>
          <Button type="submit" className="self-end" disabled={busy}>
            {busy ? "Salvando…" : "Lançar"}
          </Button>
        </div>
      </form>

      <div className="mt-6 space-y-2">
        {entries === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>
        ) : (
          entries.map((x) => (
            <div
              key={x.id}
              className="flex items-center justify-between gap-4 rounded-xl bg-card px-4 py-3 text-sm card-soft"
            >
              <div>
                <span
                  className={`mr-2 inline-block size-2 rounded-full ${
                    x.kind === "entrada" ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="font-medium">{x.category}</span>
                {x.description ? (
                  <span className="text-muted-foreground"> — {x.description}</span>
                ) : null}
                {x.is_recurring ? (
                  <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs">mensal</span>
                ) : null}
                <span className="ml-2 text-muted-foreground">
                  {new Date(x.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={x.kind === "entrada" ? "text-green-700" : "text-red-700"}>
                  {x.kind === "entrada" ? "+" : "−"}
                  {money(x.amount_cents)}
                </span>
                <button
                  onClick={() => void remove(x.id)}
                  className="text-xs text-muted-foreground hover:text-red-600"
                >
                  excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" }) {
  return (
    <div className="rounded-2xl bg-card p-5 card-soft">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl ${tone === "pos" ? "text-foreground" : "text-red-700"}`}>
        {value}
      </p>
    </div>
  );
}
