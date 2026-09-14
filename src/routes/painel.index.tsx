import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import { saveOrderTracking } from "@/lib/panel.functions";
import { usePanel } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" ? { q: search["q"] } : {},
  component: Orders,
});

const FULFILLMENT = ["recebido", "em_producao", "enviado", "entregue", "cancelado"] as const;
const FULFILLMENT_LABEL: Record<string, string> = {
  recebido: "Recebido",
  em_producao: "Em produção",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const PAYMENT_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  recusado: "Recusado",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

type OrderRow = {
  id: string;
  order_number: number;
  created_at: string;
  kind: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_document: string | null;
  quantity: number;
  total_cents: number;
  payment_status: string;
  fulfillment_status: string;
  tracking_code: string | null;
  ship_street: string | null;
  ship_number: string | null;
  ship_district: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_zip: string | null;
  internal_notes: string | null;
  businesses: { name: string; review_url: string } | null;
};

type BatchByOrder = { orderId: string; code: string; codes_sent_at: string | null };
type AuditRow = {
  id: string;
  action: string;
  actor_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

function Orders() {
  const { userId, email } = usePanel();
  const search = Route.useSearch();
  const runSaveTracking = useServerFn(saveOrderTracking);
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [batchesByOrder, setBatchesByOrder] = useState<Record<string, BatchByOrder>>({});
  const [kindFilter, setKindFilter] = useState<"all" | "individual" | "revenda">("all");
  const [q, setQ] = useState(search.q ?? "");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, created_at, kind, customer_name, customer_email, customer_phone, customer_document, quantity, total_cents, payment_status, fulfillment_status, tracking_code, ship_street, ship_number, ship_district, ship_city, ship_state, ship_zip, internal_notes, businesses(name, review_url)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Não foi possível carregar os pedidos.");
      return;
    }
    setRows((data ?? []) as unknown as OrderRow[]);

    const { data: batches } = await supabase
      .from("batches")
      .select("owner_order_id, code, codes_sent_at")
      .not("owner_order_id", "is", null);
    const map: Record<string, BatchByOrder> = {};
    for (const b of batches ?? []) {
      if (b.owner_order_id) {
        map[b.owner_order_id] = {
          orderId: b.owner_order_id,
          code: b.code,
          codes_sent_at: b.codes_sent_at,
        };
      }
    }
    setBatchesByOrder(map);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [historyByOrder, setHistoryByOrder] = useState<Record<string, AuditRow[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  async function toggleHistory(orderId: string) {
    if (historyOpenId === orderId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(orderId);
    if (historyByOrder[orderId]) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("audit_log")
      .select("id, action, actor_email, details, created_at")
      .eq("entity", "orders")
      .eq("entity_id", orderId)
      .order("created_at", { ascending: false });
    setHistoryLoading(false);
    setHistoryByOrder((prev) => ({ ...prev, [orderId]: (data ?? []) as unknown as AuditRow[] }));
  }

  async function generateBatchForOrder(row: OrderRow) {
    setGeneratingFor(row.id);
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", row.id);
    const productId = items?.[0]?.product_id;
    if (itemsError || !productId) {
      setGeneratingFor(null);
      toast.error("Não encontrei o produto deste pedido.");
      return;
    }
    const { data: batchId, error } = await supabase.rpc("allocate_batch_from_stock", {
      _label: `Pedido #${row.order_number}`,
      _product_id: productId,
      _quantity: row.quantity,
      _owner_email: row.customer_email,
      _unit_cost_cents: 0,
    });
    if (error) {
      setGeneratingFor(null);
      toast.error(error.message);
      return;
    }
    await supabase.from("batches").update({ owner_order_id: row.id }).eq("id", batchId as string);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "allocate_batch_from_stock",
      entity: "batches",
      entity_id: String(batchId),
      details: { order_id: row.id, quantity: row.quantity },
    });
    setGeneratingFor(null);
    toast.success(`Lote gerado pro pedido #${row.order_number}.`);
    void load();
  }

  async function patch(row: OrderRow, changes: Partial<OrderRow>) {
    const { error } = await supabase.from("orders").update(changes).eq("id", row.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "update_order",
      entity: "orders",
      entity_id: row.id,
      details: changes as Record<string, unknown>,
    });
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, ...changes } : r)) ?? null);
    toast.success(`Pedido #${row.order_number} atualizado.`);
  }

  const counts = {
    all: rows?.length ?? 0,
    individual: rows?.filter((r) => r.kind === "individual").length ?? 0,
    revenda: rows?.filter((r) => r.kind === "revenda").length ?? 0,
  };
  const visible = (rows ?? []).filter((r) => {
    if (kindFilter !== "all" && r.kind !== kindFilter) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      r.customer_name.toLowerCase().includes(t) ||
      r.customer_email.toLowerCase().includes(t) ||
      String(r.order_number).includes(t)
    );
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Pedidos</h1>
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome / e-mail / número"
            className="h-9 w-64"
          />
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 rounded-full bg-secondary p-1 text-xs font-semibold">
        {(
          [
            ["all", `Todos (${counts.all})`],
            ["individual", `Loja própria (${counts.individual})`],
            ["revenda", `Revenda / lote (${counts.revenda})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              kindFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhum pedido nesta aba.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {visible.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl bg-card p-5 card-soft ${
                r.kind === "individual" ? "border-l-4 border-primary" : "border-l-4 border-g-blue"
              }`}
            >
              <div
                className={`mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.kind === "individual"
                    ? "bg-primary/15 text-foreground"
                    : "bg-g-blue/15 text-foreground"
                }`}
              >
                {r.kind === "individual"
                  ? "LOJA PRÓPRIA — vai configurada com o negócio abaixo"
                  : "REVENDA — enviar em branco, sem configuração (códigos na aba Lotes)"}
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg">
                    #{r.order_number}{" "}
                    <span className="text-sm font-sans text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")} · {r.kind}
                    </span>
                  </p>
                  <p className="mt-1 text-sm">
                    {r.customer_name} · {r.customer_email}
                    {r.customer_phone ? ` · ${r.customer_phone}` : ""}
                    {r.customer_document ? ` · ${r.customer_document}` : ""}
                  </p>
                  {r.businesses && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Negócio: {r.businesses.name} ·{" "}
                      <a
                        className="underline"
                        href={r.businesses.review_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        link de avaliação
                      </a>
                    </p>
                  )}
                  {r.kind === "revenda" && batchesByOrder[r.id] && (
                    <p className="mt-2 text-sm">
                      Lote:{" "}
                      <Link to="/painel/lotes" className="font-mono font-semibold underline">
                        {batchesByOrder[r.id].code}
                      </Link>
                      {batchesByOrder[r.id].codes_sent_at
                        ? " · códigos marcados como enviados"
                        : " · exporte o CSV na aba Lotes e marque como enviado"}
                    </p>
                  )}
                  {r.kind === "revenda" && r.payment_status === "pago" && !batchesByOrder[r.id] && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-amber-800">Pago, mas ainda sem lote.</p>
                      <Button
                        size="sm"
                        onClick={() => void generateBatchForOrder(r)}
                        disabled={generatingFor === r.id}
                        className="h-7 rounded-lg text-xs"
                      >
                        {generatingFor === r.id ? "Gerando…" : "Gerar lote do estoque"}
                      </Button>
                    </div>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      r.ship_street,
                      r.ship_number,
                      r.ship_district,
                      r.ship_city,
                      r.ship_state,
                      r.ship_zip,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Sem endereço"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl">{money(r.total_cents)}</p>
                  <p className="text-sm text-muted-foreground">{r.quantity} un.</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.payment_status === "pago"
                        ? "bg-green-100 text-green-800"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {PAYMENT_LABEL[r.payment_status] ?? r.payment_status}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <div>
                  <Label className="text-xs">Pagamento</Label>
                  <select
                    value={r.payment_status}
                    onChange={(e) => void patch(r, { payment_status: e.target.value })}
                    className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(PAYMENT_LABEL).map(([s, label]) => (
                      <option key={s} value={s}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Produção</Label>
                  <select
                    value={r.fulfillment_status}
                    onChange={(e) => void patch(r, { fulfillment_status: e.target.value })}
                    className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {FULFILLMENT.map((s) => (
                      <option key={s} value={s}>
                        {FULFILLMENT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Rastreio</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      defaultValue={r.tracking_code ?? ""}
                      placeholder="Código de rastreio"
                      className="h-10"
                      id={`t-${r.id}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const el = document.getElementById(`t-${r.id}`) as HTMLInputElement | null;
                        void (async () => {
                          try {
                            await runSaveTracking({
                              data: { orderId: r.id, trackingCode: el?.value.trim() || null },
                            });
                            await load();
                            toast.success(`Rastreio do pedido #${r.order_number} salvo.`);
                          } catch {
                            toast.error("Não foi possível salvar o rastreio.");
                          }
                        })();
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="mt-3 w-full">
                  <Label className="text-xs">Nota interna (só a equipe vê)</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      defaultValue={r.internal_notes ?? ""}
                      placeholder="Ex: cliente ligou pedindo prioridade no envio"
                      className="h-10"
                      id={`n-${r.id}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const el = document.getElementById(`n-${r.id}`) as HTMLInputElement | null;
                        void patch(r, { internal_notes: el?.value.trim() || null });
                      }}
                    >
                      Salvar nota
                    </Button>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void toggleHistory(r.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {historyOpenId === r.id ? "Ocultar histórico" : "Ver histórico"}
                </Button>
              </div>

              {historyOpenId === r.id && (
                <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-xs">
                  {historyLoading && !historyByOrder[r.id] ? (
                    <p className="text-muted-foreground">Carregando…</p>
                  ) : (historyByOrder[r.id]?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground">Nenhum evento registrado ainda.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {historyByOrder[r.id]!.map((h) => (
                        <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")}
                          </span>
                          <span className="font-semibold">{h.action}</span>
                          {h.actor_email && (
                            <span className="text-muted-foreground">por {h.actor_email}</span>
                          )}
                          {h.details && (
                            <span className="text-muted-foreground">{JSON.stringify(h.details)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
