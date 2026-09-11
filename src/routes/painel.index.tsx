import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import { confirmOrderPayment } from "@/lib/panel.functions";
import { usePanel } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/")({ component: Orders });

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
  businesses: { name: string; review_url: string } | null;
};

type BatchByOrder = { orderId: string; code: string; codes_sent_at: string | null };

function Orders() {
  const { userId, email } = usePanel();
  const runConfirmPayment = useServerFn(confirmOrderPayment);
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [batchesByOrder, setBatchesByOrder] = useState<Record<string, BatchByOrder>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | "individual" | "revenda">("all");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, created_at, kind, customer_name, customer_email, customer_phone, customer_document, quantity, total_cents, payment_status, fulfillment_status, tracking_code, ship_street, ship_number, ship_district, ship_city, ship_state, ship_zip, businesses(name, review_url)",
      )
      .order("created_at", { ascending: false });
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

  async function markPaidAndEmit(row: OrderRow) {
    setConfirmingId(row.id);
    try {
      const res = await runConfirmPayment({ data: { orderId: row.id } });
      await supabase.from("audit_log").insert({
        actor_id: userId,
        actor_email: email,
        action: "confirm_payment",
        entity: "orders",
        entity_id: row.id,
        details: { created: res.created, total: res.total },
      });
      toast.success(
        res.created > 0
          ? `Pagamento confirmado. ${res.created} código(s)/placa(s) gerados (total ${res.total}).`
          : `Pagamento confirmado. ${res.total} item(ns) já estavam no sistema.`,
      );
      void load();
    } catch {
      toast.error("Não foi possível confirmar pagamento ou gerar códigos.");
    } finally {
      setConfirmingId(null);
    }
  }

  const counts = {
    all: rows?.length ?? 0,
    individual: rows?.filter((r) => r.kind === "individual").length ?? 0,
    revenda: rows?.filter((r) => r.kind === "revenda").length ?? 0,
  };
  const visible = (rows ?? []).filter((r) => kindFilter === "all" || r.kind === kindFilter);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Pedidos</h1>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      <div className="mt-4 flex gap-1 rounded-full bg-secondary p-1 text-xs font-semibold">
        {([
          ["all", `Todos (${counts.all})`],
          ["individual", `Loja própria (${counts.individual})`],
          ["revenda", `Revenda / lote (${counts.revenda})`],
        ] as const).map(([k, label]) => (
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
                    <p className="mt-2 text-sm text-amber-800">
                      Pago, mas ainda sem lote — use &quot;Confirmar pagamento e gerar códigos&quot;.
                    </p>
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
                {r.payment_status !== "pago" && (
                  <Button
                    size="sm"
                    className="btn-press btn-primary-shadow"
                    disabled={confirmingId === r.id}
                    onClick={() => void markPaidAndEmit(r)}
                  >
                    {confirmingId === r.id ? "Gerando…" : "Confirmar pagamento e gerar códigos"}
                  </Button>
                )}
                <div>
                  <Label className="text-xs">Pagamento</Label>
                  <select
                    value={r.payment_status}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "pago" && r.payment_status !== "pago") {
                        void markPaidAndEmit(r);
                        return;
                      }
                      void patch(r, { payment_status: next });
                    }}
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
                        void patch(r, { tracking_code: el?.value.trim() || null });
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
