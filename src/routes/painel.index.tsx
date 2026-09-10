import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
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

function Orders() {
  const { userId, email } = usePanel();
  const [rows, setRows] = useState<OrderRow[] | null>(null);
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
