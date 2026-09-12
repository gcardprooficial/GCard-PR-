import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/painel/visao-geral")({ component: Overview });

type Order = {
  id: string;
  order_number: number;
  created_at: string;
  customer_name: string;
  customer_email: string;
  total_cents: number;
  payment_status: string;
  fulfillment_status: string;
  tracking_code: string | null;
  kind: string;
};

const statusLabels: Record<string, string> = {
  recebido: "Recebido",
  em_producao: "Em produção",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function Overview() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, created_at, customer_name, customer_email, total_cents, payment_status, fulfillment_status, tracking_code, kind",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Não foi possível carregar a visão geral.");
      return;
    }
    setOrders((data ?? []) as Order[]);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin-orders-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        setIsLive(true);
        void load();
      })
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const metrics = useMemo(() => {
    const list = orders ?? [];
    const paid = list.filter((order) => order.payment_status === "pago");
    const open = list.filter(
      (order) => !["entregue", "cancelado"].includes(order.fulfillment_status),
    );
    const pendingShipping = paid.filter(
      (order) => !order.tracking_code && order.fulfillment_status !== "cancelado",
    );
    const revenue = paid.reduce((sum, order) => sum + order.total_cents, 0);
    const todayKey = new Date().toLocaleDateString("pt-BR");
    const today = list.filter(
      (order) => new Date(order.created_at).toLocaleDateString("pt-BR") === todayKey,
    ).length;
    return { paid, open, pendingShipping, revenue, today };
  }, [orders]);

  const funnel = useMemo(() => {
    const list = orders ?? [];
    return [
      ["Recebidos", list.filter((x) => x.fulfillment_status === "recebido").length, "bg-slate-400"],
      [
        "Em produção",
        list.filter((x) => x.fulfillment_status === "em_producao").length,
        "bg-primary",
      ],
      ["Enviados", list.filter((x) => x.fulfillment_status === "enviado").length, "bg-g-blue"],
      ["Entregues", list.filter((x) => x.fulfillment_status === "entregue").length, "bg-g-green"],
    ] as const;
  }, [orders]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
            Centro de comando
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe vendas, operação e clientes em um só lugar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isLive ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"}`}
          >
            <span
              className={`size-2 rounded-full ${isLive ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}
            />
            {isLive ? "Atualização ao vivo" : "Atualização manual"}
          </span>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Faturamento pago"
          value={money(metrics.revenue)}
          hint={`${metrics.paid.length} pedidos pagos`}
          tone="primary"
        />
        <Metric
          label="Pedidos hoje"
          value={String(metrics.today)}
          hint={`${metrics.open.length} em aberto no total`}
          tone="blue"
        />
        <Metric
          label="Aguardando expedição"
          value={String(metrics.pendingShipping.length)}
          hint="Pagos sem rastreio"
          tone="amber"
        />
        <Metric
          label="Ticket médio"
          value={money(metrics.paid.length ? Math.round(metrics.revenue / metrics.paid.length) : 0)}
          hint="Entre pedidos pagos"
          tone="green"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-3xl bg-card p-5 card-soft sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Operação dos pedidos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Onde estão os pedidos neste momento.
              </p>
            </div>
            <Link to="/painel" className="text-sm font-semibold text-primary hover:underline">
              Ver pedidos →
            </Link>
          </div>
          <div className="mt-7 space-y-4">
            {funnel.map(([label, value, color]) => {
              const max = Math.max(...funnel.map((item) => item[1]), 1);
              return (
                <div
                  key={label}
                  className="grid grid-cols-[110px_1fr_38px] items-center gap-3 text-sm"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${Math.max((value / max) * 100, value ? 8 : 0)}%` }}
                    />
                  </div>
                  <strong className="text-right">{value}</strong>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-3xl bg-secondary p-5 text-secondary-foreground card-soft sm:p-6">
          <h2 className="text-lg font-semibold">Ações prioritárias</h2>
          <p className="mt-1 text-sm text-white/60">O que merece atenção agora.</p>
          <div className="mt-5 space-y-3">
            <Priority
              title="Expedição"
              value={`${metrics.pendingShipping.length} pedidos`}
              description="pagos sem código de rastreio"
              href="/painel"
            />
            <Priority
              title="Clientes"
              value="Abrir CRM"
              description="consultar histórico e consentimento"
              href="/painel/clientes"
            />
            <Priority
              title="Lotes"
              value="Gerenciar"
              description="códigos para revendedores"
              href="/painel/lotes"
            />
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-3xl bg-card p-5 card-soft sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Atividade recente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Os últimos pedidos e mudanças recebidas.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {lastUpdated
              ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Carregando…"}
          </span>
        </div>
        <div className="mt-4 divide-y divide-border">
          {(orders ?? []).slice(0, 6).map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <Link to="/painel" className="font-semibold hover:text-primary">
                  Pedido #{order.order_number}
                </Link>
                <p className="text-muted-foreground">
                  {order.customer_name} · {order.customer_email}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{money(order.total_cents)}</span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                  {statusLabels[order.fulfillment_status] ?? order.fulfillment_status}
                </span>
              </div>
            </div>
          ))}
          {orders?.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">Ainda não há pedidos para mostrar.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "blue" | "amber" | "green";
}) {
  const colors = {
    primary: "bg-primary/15 text-primary",
    blue: "bg-g-blue/15 text-g-blue",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-green-100 text-green-700",
  };
  return (
    <div className="rounded-3xl bg-card p-5 card-soft">
      <div
        className={`mb-5 inline-flex rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-wide ${colors[tone]}`}
      >
        {label}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Priority({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="block rounded-2xl bg-white/10 p-3 transition-colors hover:bg-white/15"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-sm font-bold text-primary">{value}</span>
      </div>
      <p className="mt-1 text-xs text-white/55">{description} →</p>
    </Link>
  );
}

export default Overview;
