import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePanel } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/estoque")({ component: Estoque });

type CardProduct = { id: string; name: string };
type StockEntry = { id: string; product_id: string; quantity: number; note: string | null; created_at: string };
type SoldRow = {
  quantity: number;
  product_id: string;
  orders: { fulfillment_status: string } | null;
};

/**
 * Estoque simples pra tudo que não gera QR Code (cartão PVC e acrílico sem arte):
 * não têm código, não entram em lote. Produzidos = entradas manuais; vendidos = pedidos
 * pagos (soma sozinha, nunca defasa).
 */
function CardStock({ userId }: { userId: string }) {
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [sold, setSold] = useState<SoldRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [productId, setProductId] = useState("");
  const [mode, setMode] = useState<"producao" | "baixa">("producao");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Os tipos gerados do Supabase não conhecem a tabela nova; o cast fica só aqui.
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
      insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    };
  };

  const load = useCallback(async () => {
    const { data: prods } = await db
      .from("products")
      .select("id, name")
      .eq("has_qr", false)
      .neq("status", "oculto");
    const list = (prods ?? []) as CardProduct[];
    setProducts(list);
    setProductId((cur) => cur || list[0]?.id || "");
    if (list.length === 0) {
      setLoaded(true);
      return;
    }
    const ids = list.map((x) => x.id);
    const [{ data: ent }, { data: soldRows }] = await Promise.all([
      db
        .from("card_stock_entries")
        .select("id, product_id, quantity, note, created_at")
        .in("product_id", ids)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("order_items")
        .select("quantity, product_id, orders!inner(payment_status, fulfillment_status)")
        .in("product_id", ids)
        .eq("orders.payment_status", "pago")
        .neq("orders.fulfillment_status", "cancelado"),
    ]);
    setEntries((ent ?? []) as StockEntry[]);
    setSold((soldRows ?? []) as SoldRow[]);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    const n = Math.abs(Math.trunc(Number(qty)));
    if (!productId || !n) {
      toast.error("Informe a quantidade.");
      return;
    }
    setSaving(true);
    const { error } = await db.from("card_stock_entries").insert({
      product_id: productId,
      quantity: mode === "producao" ? n : -n,
      note: note.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQty("");
    setNote("");
    toast.success(mode === "producao" ? `${n} cartões adicionados ao estoque.` : `Baixa de ${n} registrada.`);
    void load();
  }

  async function remove(id: string) {
    if (!window.confirm("Apagar este lançamento de estoque?")) return;
    const { error } = await db.from("card_stock_entries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  if (!loaded || products.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5 card-soft">
      <h2 className="text-lg font-bold">Estoque sem QR Code</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cartão PVC e acrílico sem arte: sem código, não usam lote. Registre quantos você produziu; os
        vendidos entram sozinhos dos pedidos pagos.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {products.map((prod) => {
          const mine = entries.filter((e) => e.product_id === prod.id);
          const produced = mine.filter((e) => e.quantity > 0).reduce((n, e) => n + e.quantity, 0);
          const adjusts = mine.filter((e) => e.quantity < 0).reduce((n, e) => n + e.quantity, 0);
          const soldRows = sold.filter((r) => r.product_id === prod.id);
          const soldTotal = soldRows.reduce((n, r) => n + r.quantity, 0);
          const toShip = soldRows
            .filter((r) => ["recebido", "em_producao"].includes(r.orders?.fulfillment_status ?? ""))
            .reduce((n, r) => n + r.quantity, 0);
          const inStock = produced + adjusts - soldTotal;
          const stats: [string, number][] = [
            ["Produzidos", produced],
            ["Vendidos", soldTotal],
            ["A enviar", toShip],
            ["Em estoque", inStock],
          ];
          return (
            <div key={prod.id} className="rounded-xl border border-border p-4">
              <p className="font-semibold">{prod.name}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {stats.map(([label, value]) => {
                  const highlight = label === "Em estoque";
                  return (
                    <div
                      key={label}
                      className={`rounded-xl px-1 py-3 ${
                        highlight ? "border border-primary/40 bg-primary/15" : "bg-muted"
                      }`}
                    >
                      <dd
                        className={`font-display text-2xl leading-none ${
                          highlight && value < 0 ? "text-red-700" : "text-foreground"
                        }`}
                      >
                        {value}
                      </dd>
                      <dt className="mt-1.5 text-[11px] font-semibold text-muted-foreground">{label}</dt>
                    </div>
                  );
                })}
              </dl>
              {adjusts !== 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Baixas/ajustes: {adjusts}</p>
              )}
              {inStock < 0 && (
                <p className="mt-2 text-xs font-semibold text-red-700">
                  Vendeu mais do que foi registrado como produzido — lance a produção que faltou.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        {products.length > 1 && (
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "producao" | "baixa")}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="producao">Produzi (+)</option>
          <option value="baixa">Baixa / perda (−)</option>
        </select>
        <Input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          placeholder="Quantidade"
          className="h-10 w-32"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação (opcional)"
          className="h-10 w-full sm:w-56"
        />
        <Button size="sm" onClick={() => void add()} disabled={saving}>
          {saving ? "Salvando…" : "Registrar"}
        </Button>
      </div>

      {entries.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">Histórico ({entries.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {entries.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-1">
                <span>
                  <strong className={e.quantity > 0 ? "text-green-700" : "text-red-700"}>
                    {e.quantity > 0 ? "+" : ""}
                    {e.quantity}
                  </strong>{" "}
                  · {new Date(e.created_at).toLocaleDateString("pt-BR")}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(e.id)}
                  className="text-xs text-red-700 hover:underline"
                >
                  apagar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

type ComponentEntry = { id: string; name: string; quantity: number; note: string | null; created_at: string };

const KNOWN_COMPONENTS = [
  "Chip NFC avulso",
  "Arte 10x10 Avaliação Google (adesivo)",
  "Cartão PVC com NFC (sem arte)",
];

/**
 * Estoque de insumo solto, sem produto do catálogo (chip NFC avulso, arte impressa
 * avulsa, cartão PVC ainda sem arte) -- coisa que ainda não virou produto pronto.
 * Mesmo padrão do CardStock acima, só que por nome livre em vez de product_id.
 */
function ComponentStock({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<ComponentEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(KNOWN_COMPONENTS[0]!);
  const [mode, setMode] = useState<"producao" | "baixa">("producao");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
      insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    };
  };

  const load = useCallback(async () => {
    const { data } = await db
      .from("component_stock_entries")
      .select("id, name, quantity, note, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setEntries((data ?? []) as ComponentEntry[]);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const names = useMemo(() => {
    const set = new Set(KNOWN_COMPONENTS);
    for (const e of entries) set.add(e.name);
    return [...set];
  }, [entries]);

  async function add() {
    const n = Math.abs(Math.trunc(Number(qty)));
    if (!name.trim() || !n) {
      toast.error("Informe o nome e a quantidade.");
      return;
    }
    setSaving(true);
    const { error } = await db.from("component_stock_entries").insert({
      name: name.trim(),
      quantity: mode === "producao" ? n : -n,
      note: note.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQty("");
    setNote("");
    toast.success(mode === "producao" ? `${n} adicionado(s) ao estoque.` : `Baixa de ${n} registrada.`);
    void load();
  }

  async function remove(id: string) {
    if (!window.confirm("Apagar este lançamento?")) return;
    const { error } = await db.from("component_stock_entries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  if (!loaded) return null;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5 card-soft">
      <h2 className="text-lg font-bold">Estoque de insumo avulso</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Chip NFC solto, arte impressa avulsa, cartão PVC sem arte aplicada -- ainda não é um
        produto pronto pra vender, mas você tem em mãos e quer controlar.
      </p>

      {names.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {names.map((n) => {
            const total = entries.filter((e) => e.name === n).reduce((sum, e) => sum + e.quantity, 0);
            return (
              <div key={n} className="rounded-xl border border-border p-4">
                <p className="font-semibold">{n}</p>
                <p className={`mt-2 font-display text-2xl ${total < 0 ? "text-red-700" : "text-foreground"}`}>
                  {total}
                </p>
                <p className="text-xs text-muted-foreground">em estoque</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Insumo</Label>
          <Input
            list="component-names"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-10 w-56"
            placeholder="Nome do insumo"
          />
          <datalist id="component-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "producao" | "baixa")}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="producao">Entrada (+)</option>
          <option value="baixa">Baixa / uso (−)</option>
        </select>
        <Input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          placeholder="Quantidade"
          className="h-10 w-32"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação (opcional)"
          className="h-10 w-full sm:w-56"
        />
        <Button size="sm" onClick={() => void add()} disabled={saving}>
          {saving ? "Salvando…" : "Registrar"}
        </Button>
      </div>

      {entries.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">Histórico ({entries.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {entries.slice(0, 30).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-1">
                <span>
                  <strong className={e.quantity > 0 ? "text-green-700" : "text-red-700"}>
                    {e.quantity > 0 ? "+" : ""}
                    {e.quantity}
                  </strong>{" "}
                  {e.name} · {new Date(e.created_at).toLocaleDateString("pt-BR")}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(e.id)}
                  className="text-xs text-red-700 hover:underline"
                >
                  apagar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Estoque() {
  const { userId } = usePanel();
  return (
    <>
      <h1 className="text-2xl">Estoque</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tudo que não gera QR Code (não entra em lote): cartão PVC, acrílico sem arte, e insumo
        avulso que ainda não virou produto pronto.
      </p>
      <CardStock userId={userId} />
      <ComponentStock userId={userId} />
    </>
  );
}
