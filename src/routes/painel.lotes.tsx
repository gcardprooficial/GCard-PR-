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

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const toCents = (s: string) => Math.round((Number.parseFloat(s.replace(",", ".")) || 0) * 100);

function Lotes() {
  const { userId, email } = usePanel();
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [counts, setCounts] = useState<Record<string, { active: number; total: number }>>({});
  const [products, setProducts] = useState<Product[]>([]);

  const [label, setLabel] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [unitCost, setUnitCost] = useState("0,00");
  const [busy, setBusy] = useState(false);

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
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (quantity < 1 || quantity > 5000) {
      toast.error("Quantidade de 1 a 5000.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_batch", {
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
      action: "create_batch",
      entity: "batches",
      entity_id: String(data),
      details: { quantity, owner_email: ownerEmail },
    });
    setLabel("");
    setOwnerEmail("");
    toast.success(`Lote criado com ${quantity} códigos.`);
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
      .select("token, status, business_name")
      .eq("batch_id", b.id)
      .order("created_at", { ascending: true });
    if (error || !data) {
      toast.error("Não foi possível exportar.");
      return;
    }
    const rows = [
      "codigo,url,status,negocio",
      ...data.map(
        (p) =>
          `${p.token},${location.origin}/r/${p.token},${p.status},"${(p.business_name ?? "").replace(/"/g, "'")}"`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${b.code}-codigos.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalCost = useMemo(
    () => (batches ?? []).reduce((s, b) => s + b.unit_cost_cents * b.quantity, 0),
    [batches],
  );

  return (
    <>
      <h1 className="text-2xl">Lotes (revenda)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada lote gera códigos únicos. O revendedor ativa cada código no painel dele em{" "}
        <code className="rounded bg-muted px-1">/ativar</code> usando o mesmo e-mail.
      </p>

      <form onSubmit={create} className="mt-6 rounded-2xl bg-card p-5 card-soft">
        <p className="text-sm font-semibold">Novo lote</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="text-xs">Identificação</Label>
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
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Quantidade de códigos</Label>
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
            <Label className="text-xs">E-mail do revendedor</Label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="dono@exemplo.com"
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label className="text-xs">Custo por unidade</Label>
            <Input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="decimal" className="mt-1 h-10" />
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={busy}>
          {busy ? "Gerando códigos…" : "Criar lote"}
        </Button>
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
          <div className="mt-3 space-y-3">
            {batches.map((b) => {
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
                            conta vinculada
                          </span>
                        ) : (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs">aguardando login</span>
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
        </>
      )}
    </>
  );
}
