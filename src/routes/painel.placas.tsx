import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePanel } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/placas")({ component: Placas });

const STATUS = ["nao_ativada", "ativada", "bloqueada"] as const;
const STATUS_LABEL: Record<string, string> = {
  nao_ativada: "Não ativada",
  ativada: "Ativada",
  bloqueada: "Bloqueada",
};

const PAGE = 40;

type Plate = {
  id: string;
  token: string;
  short_code: string;
  status: string;
  destination_url: string | null;
  scan_count: number;
  last_scan_at: string | null;
  activated_at: string | null;
  batch_id: string | null;
  products: { name: string } | null;
  orders: { order_number: number; customer_name: string } | null;
  businesses: { name: string; review_url: string } | null;
  batches: { code: string; label: string | null; owner_email: string | null } | null;
};

type View = "lotes" | "estoque" | "todas";

type BatchGroup = {
  id: string;
  code: string;
  label: string | null;
  owner_email: string | null;
  plates: Plate[];
  activated: number;
  scans: number;
};

type CardProduct = { id: string; name: string };
type StockEntry = { id: string; product_id: string; quantity: number; note: string | null; created_at: string };
type SoldRow = {
  quantity: number;
  product_id: string;
  orders: { fulfillment_status: string } | null;
};

/**
 * Estoque de cartões de PVC (só NFC, sem QR): não têm código, então não entram em lote.
 * Produzidos = entradas manuais; vendidos = pedidos pagos (soma sozinha, nunca defasa).
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
      .eq("is_blank", false)
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
      <h2 className="text-lg font-bold">Estoque de cartões de PVC</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sem QR e sem código: não usam lote. Registre quantos você produziu; os vendidos entram sozinhos
        dos pedidos pagos.
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
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                {stats.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-secondary/60 px-1 py-2">
                    <dd className={`font-display text-xl ${label === "Em estoque" && value < 0 ? "text-red-700" : ""}`}>
                      {value}
                    </dd>
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  </div>
                ))}
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
          className="h-10 w-56"
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

function Placas() {
  const { userId, email } = usePanel();
  const [rows, setRows] = useState<Plate[] | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | (typeof STATUS)[number]>("all");
  const [view, setView] = useState<View>("lotes");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("plates")
      .select(
        "id, token, short_code, status, destination_url, scan_count, last_scan_at, activated_at, batch_id, products(name), orders(order_number, customer_name), businesses(name, review_url), batches(code, label, owner_email)",
      )
      .order("short_code", { ascending: true })
      .limit(3000);
    if (error) {
      toast.error("Não foi possível carregar as placas.");
      return;
    }
    setRows((data ?? []) as unknown as Plate[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Trocar de visão/busca volta a paginação pro começo.
  useEffect(() => {
    setLimit(PAGE);
  }, [view, q, statusFilter]);

  async function patch(row: Plate, changes: Record<string, unknown>) {
    const { error } = await supabase.from("plates").update(changes).eq("id", row.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "update_plate",
      entity: "plates",
      entity_id: row.id,
      details: changes,
    });
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, ...changes } : r)) ?? null);
    toast.success(`Placa ${row.short_code} atualizada.`);
  }

  function setStatus(row: Plate, status: string) {
    const dest = row.destination_url ?? row.businesses?.review_url ?? null;
    if (status === "ativada" && !dest) {
      toast.error("Defina o link de avaliação antes de ativar.");
      return;
    }
    void patch(row, {
      status,
      ...(status === "ativada" && !row.activated_at ? { activated_at: new Date().toISOString() } : {}),
    });
  }

  const searching = q.trim().length > 0;

  const matches = useCallback(
    (r: Plate) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!searching) return true;
      const t = q.toLowerCase();
      return (
        r.token.toLowerCase().includes(t) ||
        r.short_code.toLowerCase().includes(t) ||
        !!r.businesses?.name.toLowerCase().includes(t) ||
        !!r.orders?.customer_name.toLowerCase().includes(t) ||
        String(r.orders?.order_number ?? "").includes(t) ||
        !!r.batches?.code.toLowerCase().includes(t) ||
        !!r.batches?.owner_email?.toLowerCase().includes(t)
      );
    },
    [q, searching, statusFilter],
  );

  const statusCounts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  // Estoque livre = sem lote e sem pedido (placas de loja própria já nascem ligadas a um pedido).
  const stock = useMemo(
    () => (rows ?? []).filter((r) => !r.batch_id && !r.orders && matches(r)),
    [rows, matches],
  );

  // Lotes mais recentes primeiro (o código começa com a data YYMMDD).
  const groups = useMemo(() => {
    const map = new Map<string, BatchGroup>();
    for (const r of rows ?? []) {
      if (!r.batch_id || !r.batches) continue;
      let g = map.get(r.batch_id);
      if (!g) {
        g = {
          id: r.batch_id,
          code: r.batches.code,
          label: r.batches.label,
          owner_email: r.batches.owner_email,
          plates: [],
          activated: 0,
          scans: 0,
        };
        map.set(r.batch_id, g);
      }
      g.plates.push(r);
      if (r.status === "ativada") g.activated++;
      g.scans += r.scan_count;
    }
    return [...map.values()]
      .map((g) => ({ ...g, plates: g.plates.filter(matches) }))
      .filter((g) => g.plates.length > 0)
      .sort((a, b) => b.code.localeCompare(a.code));
  }, [rows, matches]);

  const all = useMemo(() => (rows ?? []).filter(matches), [rows, matches]);

  const totalInLotes = (rows ?? []).filter((r) => r.batch_id).length;
  const totalBatches = new Set((rows ?? []).filter((r) => r.batch_id).map((r) => r.batch_id)).size;
  const totalStock = (rows ?? []).filter((r) => !r.batch_id && !r.orders).length;

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderPlate(r: Plate) {
    return (
      <div key={r.id} className="rounded-2xl bg-card p-5 card-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-black tracking-wide bg-surface px-2 py-1 rounded-lg border border-primary/30">
                {r.short_code}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{r.token}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.products?.name ?? "—"}
              {r.orders ? ` · pedido #${r.orders.order_number} (${r.orders.customer_name})` : ""}
            </p>
            {r.businesses && <p className="text-sm text-muted-foreground">Negócio: {r.businesses.name}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {r.scan_count} scans
              {r.last_scan_at ? ` · último ${new Date(r.last_scan_at).toLocaleString("pt-BR")}` : ""}
            </p>
          </div>
          <select
            value={r.status}
            onChange={(e) => setStatus(r, e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <Label className="text-xs">Link de avaliação (destino)</Label>
          <div className="mt-1 flex gap-2">
            <Input
              defaultValue={r.destination_url ?? r.businesses?.review_url ?? ""}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              className="h-10"
              id={`d-${r.id}`}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const el = document.getElementById(`d-${r.id}`) as HTMLInputElement | null;
                const v = el?.value.trim() || null;
                if (
                  v &&
                  !/^https:\/\/(search\.google\.com|www\.google\.com|google\.com|maps\.google\.com|g\.page)\//.test(v)
                ) {
                  toast.error("O link precisa ser do Google.");
                  return;
                }
                void patch(r, { destination_url: v });
              }}
            >
              Salvar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function moreButton(total: number) {
    return total > limit ? (
      <div className="mt-4 text-center">
        <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
          Mostrar mais ({total - limit} restantes)
        </Button>
      </div>
    ) : null;
  }

  const VIEWS: [View, string][] = [
    ["lotes", `Por lote (${totalBatches} lotes · ${totalInLotes} placas)`],
    ["estoque", `Estoque livre (${totalStock})`],
    ["todas", `Todas (${rows?.length ?? 0})`],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Placas</h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar token, código, negócio, lote…"
          className="h-10 w-64"
        />
      </div>

      <CardStock userId={userId} />

      <div className="mt-3 flex flex-wrap gap-2">
        {VIEWS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
              view === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1 text-xs font-semibold text-muted-foreground">
        <span className="self-center pr-1">Status:</span>
        {(
          [
            ["all", `Todos (${rows?.length ?? 0})`],
            ...STATUS.map((s) => [s, `${STATUS_LABEL[s]} (${statusCounts[s] ?? 0})`] as const),
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStatusFilter(k)}
            className={`rounded-full px-3 py-1 transition-colors ${
              statusFilter === k ? "bg-secondary text-foreground" : "hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : view === "lotes" ? (
        groups.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            {totalBatches === 0 ? "Nenhum lote criado ainda." : "Nada encontrado."}
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {groups.slice(0, limit).map((g) => {
              const isOpen = searching || open.has(g.id);
              return (
                <div key={g.id} className="rounded-2xl border border-border bg-card card-soft">
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left"
                  >
                    <div>
                      <p className="font-mono text-sm font-bold">{g.code}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {g.label ?? "Sem descrição"}
                        {g.owner_email ? ` · ${g.owner_email}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        <strong>{g.activated}</strong>/{g.plates.length} ativadas
                      </span>
                      <span className="text-muted-foreground">{g.scans} scans</span>
                      <span className="text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t border-border p-4">{g.plates.map(renderPlate)}</div>
                  )}
                </div>
              );
            })}
            {moreButton(groups.length)}
          </div>
        )
      ) : (
        (() => {
          const list = view === "estoque" ? stock : all;
          return list.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">
              {rows.length === 0 ? "Nenhuma placa emitida ainda." : "Nada encontrado."}
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {list.slice(0, limit).map(renderPlate)}
              {moreButton(list.length)}
            </div>
          );
        })()
      )}
    </>
  );
}
