import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePanel } from "@/lib/panelContext";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/lotes")({ component: Lotes });

const BATCH_STATUS = ["rascunho", "produzido", "vendido"] as const;

type Batch = {
  id: string;
  code: string;
  label: string | null;
  quantity: number;
  status: string;
  owner_email: string | null;
  owner_user_id: string | null;
  sold_to: string | null;
  codes_sent_at: string | null;
  unit_cost_cents: number;
  created_at: string;
  products: { name: string } | null;
};
type Product = { id: string; slug: string; name: string };
type StockPlate = { id: string; short_code: string; token: string };

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const toCents = (s: string) => Math.round((Number.parseFloat(s.replace(",", ".")) || 0) * 100);

function Lotes() {
  const { userId, email } = usePanel();
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [counts, setCounts] = useState<Record<string, { active: number; total: number }>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | (typeof BATCH_STATUS)[number]>("all");

  const [label, setLabel] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [unitCost, setUnitCost] = useState("0,00");
  const [busy, setBusy] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ code: string; quantity: number } | null>(null);

  const [stockProductId, setStockProductId] = useState("");
  const [stockQuantity, setStockQuantity] = useState(100);
  const [stockBusy, setStockBusy] = useState(false);

  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [stockPlates, setStockPlates] = useState<StockPlate[]>([]);
  const [stockPlatesLoading, setStockPlatesLoading] = useState(false);

  async function toggleStock(productId: string) {
    if (expandedStock === productId) {
      setExpandedStock(null);
      return;
    }
    setExpandedStock(productId);
    setStockPlatesLoading(true);
    const { data } = await supabase
      .from("plates")
      .select("id, short_code, token")
      .is("batch_id", null)
      .eq("product_id", productId)
      .order("short_code", { ascending: true })
      .limit(500);
    setStockPlates((data ?? []) as unknown as StockPlate[]);
    setStockPlatesLoading(false);
  }

  const load = useCallback(async () => {
    const b = await supabase
      .from("batches")
      .select(
        "id, code, label, quantity, status, owner_email, owner_user_id, sold_to, codes_sent_at, unit_cost_cents, created_at, products(name)",
      )
      .order("created_at", { ascending: false });
    if (b.error) {
      toast.error("Não foi possível carregar os lotes.");
      return;
    }
    const list = (b.data ?? []) as unknown as Batch[];
    setBatches(list);

    // ponytail: pulls batch_id+status for every plate to count. Fine até alguns
    // milhares; virar rpc/view se crescer.
    const p = await supabase.from("plates").select("batch_id, status").not("batch_id", "is", null).limit(50000);
    const map: Record<string, { active: number; total: number }> = {};
    for (const row of p.data ?? []) {
      const k = row.batch_id as string;
      const c = map[k] ?? { active: 0, total: 0 };
      c.total += 1;
      if (row.status === "ativada") c.active += 1;
      map[k] = c;
    }
    setCounts(map);

    const pr = await supabase.from("products").select("id, slug, name").order("sort_order");
    setProducts((pr.data ?? []) as Product[]);
    if (!productId && pr.data?.[0]) setProductId(pr.data[0].id);
    if (!stockProductId && pr.data?.[0]) setStockProductId(pr.data[0].id);

    const s = await supabase.from("plates").select("product_id").is("batch_id", null).limit(50000);
    const stockMap: Record<string, number> = {};
    for (const row of s.data ?? []) {
      const k = row.product_id as string;
      stockMap[k] = (stockMap[k] ?? 0) + 1;
    }
    setStock(stockMap);
  }, [productId, stockProductId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (quantity < 1 || quantity > 5000) {
      toast.error("Quantidade de 1 a 5000.");
      return;
    }
    if (quantity > (stock[productId] ?? 0)) {
      toast.error(`Só há ${stock[productId] ?? 0} un. em estoque desse produto.`);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("allocate_batch_from_stock", {
      _label: label.trim() || null,
      _product_id: productId || null,
      _quantity: quantity,
      _owner_email: ownerEmail.trim() || null,
      _unit_cost_cents: toCents(unitCost),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "allocate_batch_from_stock",
      entity: "batches",
      entity_id: String(data),
      details: { quantity, label, owner_email: ownerEmail },
    });
    const created = await supabase.from("batches").select("code").eq("id", data as string).single();
    setLastCreated(created.data ? { code: created.data.code, quantity } : null);
    setLabel("");
    setOwnerEmail("");
    toast.success(`Lote montado com ${quantity} códigos.`);
    void load();
  }

  async function createStock(e: FormEvent) {
    e.preventDefault();
    if (stockQuantity < 1 || stockQuantity > 5000) {
      toast.error("Quantidade de 1 a 5000.");
      return;
    }
    setStockBusy(true);
    const { error } = await supabase.rpc("create_stock", {
      _product_id: stockProductId || null,
      _quantity: stockQuantity,
    });
    setStockBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "create_stock",
      entity: "plates",
      entity_id: stockProductId,
      details: { quantity: stockQuantity, product_id: stockProductId },
    });
    toast.success(`${stockQuantity} plaquinhas geradas no estoque.`);
    void load();
  }

  async function patch(b: Batch, changes: Partial<Batch>) {
    const { error } = await supabase.from("batches").update(changes).eq("id", b.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    setBatches((prev) => prev?.map((x) => (x.id === b.id ? { ...x, ...changes } : x)) ?? null);
  }

  async function exportCodes(b: Batch) {
    if (!confirm(`Exportar ${b.quantity} códigos do lote ${b.code} para CSV?`)) return;
    const { data, error } = await supabase
      .from("plates")
      .select("token, short_code, status, business_name")
      .eq("batch_id", b.id)
      .order("short_code", { ascending: true });
    if (error || !data) {
      toast.error("Não foi possível exportar.");
      return;
    }
    const rows = [
      "codigo,url,status,negocio",
      ...data.map(
        (p) =>
          `${p.short_code},${location.origin}/r/${p.token},${p.status},"${(p.business_name ?? "").replace(/"/g, "'")}"`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${b.code}-codigos.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Gera um PNG de QR por placa do lote e baixa tudo num .zip — pronto pra mandar pra gráfica. */
  async function exportQrZip(b: Batch) {
    if (!confirm(`Gerar ${b.quantity} imagens de QR do lote ${b.code} (.zip)?`)) return;
    const { data, error } = await supabase
      .from("plates")
      .select("token, short_code")
      .eq("batch_id", b.id)
      .order("short_code", { ascending: true });
    if (error || !data || data.length === 0) {
      toast.error("Não foi possível gerar os QR codes.");
      return;
    }
    toast.info(`Gerando ${data.length} QR codes...`);
    const [{ default: JSZip }, QRCode] = await Promise.all([import("jszip"), import("qrcode")]);
    const zip = new JSZip();
    for (const p of data) {
      const url = `${location.origin}/r/${p.token}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 1000, margin: 2, errorCorrectionLevel: "H" });
      const base64 = dataUrl.split(",")[1];
      zip.file(`${p.short_code}.png`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const zipUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = `${b.code}-qrcodes.zip`;
    link.click();
    URL.revokeObjectURL(zipUrl);
    toast.success("QR codes gerados.");
  }

  const totalCost = useMemo(
    () => (batches ?? []).reduce((s, b) => s + b.unit_cost_cents * b.quantity, 0),
    [batches],
  );

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { rascunho: 0, produzido: 0, vendido: 0 };
    for (const b of batches ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [batches]);

  const filteredBatches = (batches ?? []).filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      b.code.toLowerCase().includes(t) ||
      b.label?.toLowerCase().includes(t) ||
      b.owner_email?.toLowerCase().includes(t) ||
      b.sold_to?.toLowerCase().includes(t)
    );
  });

  return (
    <>
      <h1 className="text-2xl">Lotes (revenda)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada lote gera códigos únicos. O revendedor ativa cada código no painel dele em{" "}
        <code className="rounded bg-muted px-1">/ativar</code> usando o mesmo e-mail.
      </p>

      <div className="mt-6 rounded-2xl bg-card p-5 card-soft">
        <p className="text-sm font-semibold">Estoque disponível (plaquinhas soltas, sem dono)</p>
        <p className="mt-1 text-xs text-muted-foreground">Clique num produto pra ver os códigos parados no estoque</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void toggleStock(p.id)}
              className={`rounded-xl border p-3 flex items-center justify-between text-left transition-colors ${
                expandedStock === p.id ? "border-primary bg-surface" : "border-border hover:bg-surface"
              }`}
            >
              <span className="text-sm">{p.name}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  (stock[p.id] ?? 0) > 0
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : "bg-amber-100 text-amber-900 border border-amber-200"
                }`}
              >
                {stock[p.id] ?? 0} un.
              </span>
            </button>
          ))}
          {products.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          )}
        </div>

        {expandedStock && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-3">
            {stockPlatesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : stockPlates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma plaquinha solta desse produto.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {stockPlates.length} código(s) {stockPlates.length >= 500 ? "(mostrando os 500 primeiros)" : ""}
                </p>
                <div className="mt-2 max-h-64 overflow-y-auto grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {stockPlates.map((sp) => (
                    <span key={sp.id} className="rounded-lg bg-card border border-border px-2 py-1 font-mono text-xs">
                      {sp.short_code}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <form onSubmit={create} className="mt-4 rounded-2xl bg-card p-5 card-soft">
        <p className="text-sm font-semibold">Montar lote pro pedido (puxa do estoque)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cliente comprou N unidades? Monta um lote de N aqui. Se souber o e-mail dele, o lote já
          vai vinculado — ele entra em /ativar com o e-mail e puxa automático. Sem e-mail, manda o
          código do lote pra ele resgatar manualmente.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="text-xs">Identificação (nota interna)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: João - Curitiba" className="mt-1 h-10" />
          </div>
          <div>
            <Label className="text-xs">Produto</Label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {stock[p.id] ?? 0} em estoque
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Quantidade vendida</Label>
            <Input
              type="number"
              min={1}
              max={5000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label className="text-xs">E-mail do cliente (opcional)</Label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label className="text-xs">Custo por unidade</Label>
            <Input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="decimal" className="mt-1 h-10" />
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={busy || quantity > (stock[productId] ?? 0)}>
          {busy ? "Montando…" : "Montar lote"}
        </Button>
        {quantity > (stock[productId] ?? 0) && (
          <p className="mt-2 text-xs text-destructive">
            Só há {stock[productId] ?? 0} un. em estoque desse produto — gere mais estoque abaixo.
          </p>
        )}
        {lastCreated && (
          <div className="mt-4 rounded-xl border-2 border-primary/40 bg-surface p-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Lote de {lastCreated.quantity} un. pronto — manda esse código pro cliente:
            </p>
            <p className="mt-1 font-mono text-xl font-black tracking-wide">{lastCreated.code}</p>
          </div>
        )}
      </form>

      <form onSubmit={createStock} className="mt-4 rounded-2xl bg-card p-5 card-soft border border-dashed">
        <p className="text-sm font-semibold">Gerar estoque (plaquinhas soltas, sem dono)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Imprime em lote grande por economia, guarda solto, e monta o lote certinho na hora da venda (acima).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Produto</Label>
            <select
              value={stockProductId}
              onChange={(e) => setStockProductId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {stock[p.id] ?? 0} em estoque
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Quantidade a gerar</Label>
            <Input
              type="number"
              min={1}
              max={5000}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(Number(e.target.value) || 1)}
              className="mt-1 h-10"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="outline" disabled={stockBusy} className="h-10">
              {stockBusy ? "Gerando…" : "Gerar estoque"}
            </Button>
          </div>
        </div>
      </form>

      {batches === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : batches.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhum lote ainda.</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {batches.length} lotes · custo total em produção {money(totalCost)}
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-full bg-secondary p-1 text-xs font-semibold">
              {(
                [
                  ["all", `Todos (${batches.length})`],
                  ["rascunho", `Rascunho (${statusCounts["rascunho"]})`],
                  ["produzido", `Produzido (${statusCounts["produzido"]})`],
                  ["vendido", `Vendido (${statusCounts["vendido"]})`],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusFilter(k)}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    statusFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar código / revendedor / nota"
              className="h-10 w-full sm:w-72"
            />
          </div>

          {filteredBatches.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Nenhum lote encontrado.</p>
          ) : (
          <div className="mt-3 space-y-3">
            {filteredBatches.map((b) => {
              const c = counts[b.id] ?? { active: 0, total: b.quantity };
              return (
                <div key={b.id} className="rounded-2xl bg-card p-5 card-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">{b.code}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {b.label ? `${b.label} · ` : ""}
                        {b.products?.name ?? "—"} · {b.quantity} códigos
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Revendedor: {b.owner_email ?? "—"}{" "}
                        {b.owner_user_id ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            código resgatado
                          </span>
                        ) : (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs">aguardando resgate</span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.active}/{c.total} ativados · custo un. R$ {reais(b.unit_cost_cents)}
                        {b.codes_sent_at
                          ? ` · códigos enviados ${new Date(b.codes_sent_at).toLocaleDateString("pt-BR")}`
                          : " · códigos não enviados"}
                      </p>
                    </div>
                    <select
                      value={b.status}
                      onChange={(e) => void patch(b, { status: e.target.value })}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {BATCH_STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
                    <Button size="sm" variant="outline" onClick={() => void exportCodes(b)}>
                      Exportar códigos (CSV)
                    </Button>
                    <Button size="sm" onClick={() => void exportQrZip(b)}>
                      Baixar QR Codes (.zip)
                    </Button>
                    {!b.codes_sent_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!confirm(`Marcar códigos do lote ${b.code} como enviados? Essa ação é irreversível.`)) return;
                          void patch(b, { codes_sent_at: new Date().toISOString() });
                        }}
                      >
                        Marcar códigos como enviados
                      </Button>
                    )}
                    <div className="flex-1">
                      <Label className="text-xs">Vendido para (nota)</Label>
                      <div className="mt-1 flex gap-2">
                        <Input defaultValue={b.sold_to ?? ""} id={`s-${b.id}`} className="h-10" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const el = document.getElementById(`s-${b.id}`) as HTMLInputElement | null;
                            void patch(b, { sold_to: el?.value.trim() || null });
                          }}
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </>
      )}
    </>
  );
}
