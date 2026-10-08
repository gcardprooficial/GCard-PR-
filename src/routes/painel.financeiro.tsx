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
  created_at: string;
  order_id: string | null;
  orders: { order_number: number; payment_provider: string | null } | null;
};
type SortKey = "data_desc" | "data_asc" | "nome_az" | "nome_za" | "valor_desc" | "valor_asc";
type Partner = { id: string; name: string; share_percent: number };

/** "1.234,56" | "1234.56" | "1234,5" -> cents */
function parseBRL(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** "frete", "Frete " e "FRETE" viram a mesma categoria: "Frete". */
function normCat(input: string): string {
  const t = input.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Por onde o dinheiro de uma venda entrou. Sem gateway = pago à mão (Pix direto) -- vira observação. */
function gateway(x: Entry): { label: string; cls: string; manual: boolean } | null {
  if (!x.order_id) return null;
  const p = x.orders?.payment_provider;
  if (p === "mercadopago") return { label: "Mercado Pago", cls: "bg-sky-100 text-sky-800", manual: false };
  if (p === "pagarme") return { label: "Pagar.me (Stone)", cls: "bg-green-100 text-green-800", manual: false };
  if (p === "infinitepay") return { label: "InfinitePay", cls: "bg-emerald-100 text-emerald-800", manual: false };
  return { label: "Pix direto (manual)", cls: "bg-amber-100 text-amber-900", manual: true };
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
  const [sortBy, setSortBy] = useState<SortKey>("data_desc");
  const [kindFilter, setKindFilter] = useState<"todos" | "entrada" | "saida">("todos");
  const [q, setQ] = useState("");

  const [kind, setKind] = useState<"entrada" | "saida">("saida");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);
    const [e, p] = await Promise.all([
      supabase
        .from("finance_entries")
        .select("id, kind, category, description, amount_cents, entry_date, is_recurring, created_at, order_id, orders(order_number, payment_provider)")
        .gte("entry_date", start)
        .lt("entry_date", end)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
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

  // Lista ordenada/filtrada na tela. Mesma data? desempata pelo horário do lançamento.
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = (entries ?? []).filter(
      (x) =>
        (kindFilter === "todos" || x.kind === kindFilter) &&
        (!t || `${x.category} ${x.description ?? ""} ${x.orders?.order_number ?? ""}`.toLowerCase().includes(t)),
    );
    const byDate = (a: Entry, b: Entry) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at);
    const name = (x: Entry) => `${x.category} ${x.description ?? ""}`;
    const cmp: Record<SortKey, (a: Entry, b: Entry) => number> = {
      data_desc: (a, b) => byDate(b, a),
      data_asc: byDate,
      nome_az: (a, b) => name(a).localeCompare(name(b), "pt-BR") || byDate(b, a),
      nome_za: (a, b) => name(b).localeCompare(name(a), "pt-BR") || byDate(b, a),
      valor_desc: (a, b) => b.amount_cents - a.amount_cents,
      valor_asc: (a, b) => a.amount_cents - b.amount_cents,
    };
    return [...list].sort(cmp[sortBy]);
  }, [entries, sortBy, kindFilter, q]);

  const byCategory = useMemo(() => {
    const m = new Map<string, { kind: "entrada" | "saida"; cents: number; n: number }>();
    for (const x of entries ?? []) {
      const k = `${x.kind}|${normCat(x.category)}`;
      const cur = m.get(k) ?? { kind: x.kind, cents: 0, n: 0 };
      m.set(k, { kind: x.kind, cents: cur.cents + x.amount_cents, n: cur.n + 1 });
    }
    return [...m].map(([k, v]) => ({ category: k.split("|").slice(1).join("|"), ...v })).sort((a, b) => b.cents - a.cents);
  }, [entries]);

  const categoryOptions = useMemo(
    () => [...new Set((entries ?? []).map((x) => normCat(x.category)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [entries],
  );

  // Entradas de vendas por gateway (o que entrou por Mercado Pago, InfinitePay ou à mão).
  const byGateway = useMemo(() => {
    const m = new Map<string, { cents: number; n: number; manual: boolean }>();
    for (const x of entries ?? []) {
      const g = x.kind === "entrada" ? gateway(x) : null;
      if (!g) continue;
      const cur = m.get(g.label) ?? { cents: 0, n: 0, manual: g.manual };
      m.set(g.label, { cents: cur.cents + x.amount_cents, n: cur.n + 1, manual: g.manual });
    }
    return [...m];
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
    const payload = {
      kind,
      category: normCat(category),
      description: description.trim() || null,
      amount_cents: cents,
      entry_date: date,
      is_recurring: recurring,
      recurrence: recurring ? "mensal" : null,
    };
    const { error } = editingId
      ? await supabase.from("finance_entries").update(payload).eq("id", editingId)
      : await supabase.from("finance_entries").insert({ ...payload, created_by: userId });
    setBusy(false);
    if (error) {
      toast.error(editingId ? "Não foi possível salvar a edição." : "Não foi possível lançar.");
      return;
    }
    setCategory("");
    setDescription("");
    setAmount("");
    setRecurring(false);
    setEditingId(null);
    toast.success(editingId ? "Lançamento atualizado." : "Lançamento registrado.");
    void load();
  }

  function startEdit(x: Entry) {
    setEditingId(x.id);
    setKind(x.kind);
    setCategory(normCat(x.category));
    setDescription(x.description ?? "");
    setAmount((x.amount_cents / 100).toFixed(2).replace(".", ","));
    setDate(x.entry_date);
    setRecurring(x.is_recurring);
  }

  function cancelEdit() {
    setEditingId(null);
    setCategory("");
    setDescription("");
    setAmount("");
    setRecurring(false);
  }

  async function remove(id: string) {
    if (!confirm("Excluir este lançamento? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("finance_entries").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    if (editingId === id) cancelEdit();
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
        <p className="text-sm font-semibold">{editingId ? "Editar lançamento" : "Novo lançamento"}</p>
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
              list="financeiro-categorias"
            />
            <datalist id="financeiro-categorias">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : editingId ? "Salvar edição" : "Lançar"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </form>

      {byGateway.length > 0 && (
        <div className="mt-4 rounded-2xl bg-card p-5 card-soft">
          <p className="text-sm font-semibold">Vendas por onde entraram</p>
          <div className="mt-2 space-y-1 text-sm">
            {byGateway.map(([label, v]) => (
              <div key={label} className={`flex justify-between gap-3 rounded-lg px-2 py-1 ${v.manual ? "bg-amber-50 text-amber-900" : ""}`}>
                <span>
                  {label} ({v.n}){v.manual ? " — atenção: não passou por gateway" : ""}
                </span>
                <span className="font-medium">{money(v.cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {byCategory.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(["entrada", "saida"] as const).map((k) => (
            <div key={k} className="rounded-2xl bg-card p-5 card-soft">
              <p className="text-sm font-semibold">{k === "entrada" ? "Entradas por categoria" : "Saídas por categoria"}</p>
              <div className="mt-2 space-y-1 text-sm">
                {byCategory.filter((c) => c.kind === k).map((c) => (
                  <div key={c.category} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{c.category} ({c.n})</span>
                    <span className="font-medium">{money(c.cents)}</span>
                  </div>
                ))}
                {!byCategory.some((c) => c.kind === k) && <p className="text-muted-foreground">Nenhuma</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Ordenar por</Label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="data_desc">Data (mais recente primeiro)</option>
            <option value="data_asc">Data (mais antigo primeiro)</option>
            <option value="nome_az">Nome / categoria (A–Z)</option>
            <option value="nome_za">Nome / categoria (Z–A)</option>
            <option value="valor_desc">Valor (maior primeiro)</option>
            <option value="valor_asc">Valor (menor primeiro)</option>
          </select>
        </div>
        <div className="flex gap-1 rounded-full bg-secondary p-1 text-xs font-semibold">
          {([["todos", "Todos"], ["entrada", "Entradas"], ["saida", "Saídas"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`rounded-full px-3 py-1.5 ${kindFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar categoria, descrição, nº do pedido" className="h-10 w-full sm:w-72" />
        <span className="text-xs text-muted-foreground">{shown.length} lançamento(s)</span>
      </div>

      <div className="mt-3 space-y-2">
        {entries === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento {entries.length ? "com esse filtro" : "neste mês"}.</p>
        ) : (
          shown.map((x) => (
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
                <span className="font-medium">{normCat(x.category)}</span>
                {x.description ? (
                  <span className="text-muted-foreground"> — {x.description}</span>
                ) : null}
                {x.is_recurring ? (
                  <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs">mensal</span>
                ) : null}
                {x.order_id ? (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">automático</span>
                ) : null}
                {gateway(x) ? (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${gateway(x)!.cls}`}>
                    {gateway(x)!.label}
                  </span>
                ) : null}
                {gateway(x)?.manual ? (
                  <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                    Observação: venda paga por fora (Pix direto), sem Mercado Pago/InfinitePay — confira no extrato.
                  </span>
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
                  onClick={() => startEdit(x)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  editar
                </button>
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
