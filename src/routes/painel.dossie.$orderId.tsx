import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getOrderDossier } from "@/lib/dossier.functions";
import { money } from "@/lib/pricing";
import { CARRIERS } from "@/lib/shipping";

export const Route = createFileRoute("/painel/dossie/$orderId")({ component: Dossie });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Order = any;

const dt = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

const EVENT_LABEL: Record<string, string> = {
  pedido_recebido: "Pedido recebido",
  pagamento_confirmado: "Pagamento confirmado",
  pedido_enviado: "Pedido enviado",
};

function trackingUrl(carrier: string | null, code: string | null) {
  if (!code) return null;
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("correio")) return `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(code)}`;
  if (c.includes("jadlog")) return `https://www.jadlog.com.br/jadlog/tracking?cte=${encodeURIComponent(code)}`;
  return null;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border/60 py-1.5 text-sm">
      <dt className="w-44 shrink-0 font-semibold text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{v || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="border-b-2 border-foreground pb-1 text-base font-black uppercase tracking-wider">{title}</h2>
      <dl className="mt-2">{children}</dl>
    </section>
  );
}

function Dossie() {
  const { orderId } = Route.useParams();
  const load = useServerFn(getOrderDossier);
  const [state, setState] = useState<{ order: Order; emails: Order[]; generatedAt: string } | "erro" | null>(null);

  useEffect(() => {
    load({ data: { orderId } })
      .then((r) => setState(r as never))
      .catch(() => setState("erro"));
  }, [orderId, load]);

  if (state === null) return <p className="text-sm text-muted-foreground">Montando dossiê…</p>;
  if (state === "erro") return <p className="text-sm text-red-700">Não consegui carregar o dossiê deste pedido.</p>;

  const { order: o, emails, generatedAt } = state;
  const carrier = CARRIERS.find((c) => c.value === o.tracking_carrier)?.label ?? o.tracking_carrier;
  const url = trackingUrl(o.tracking_carrier, o.tracking_code);
  const items = (o.order_items ?? []) as { product_name: string; quantity: number; total_cents: number }[];

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-foreground print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link to="/painel" className="text-sm text-muted-foreground hover:text-foreground">← Pedidos</Link>
        <Button onClick={() => window.print()} className="font-bold">Imprimir / salvar em PDF</Button>
      </div>

      <h1 className="text-2xl font-black">Dossiê do pedido #{o.order_number}</h1>
      <p className="text-xs text-muted-foreground">
        GCard-PRÓ · Marusso Produções · gerado em {dt(generatedAt)} · documento interno para disputa/análise de pagamento
      </p>

      <Section title="Pagamento">
        <Row k="Status" v={o.payment_status} />
        <Row k="Meio de pagamento" v={[o.payment_provider, o.payment_method].filter(Boolean).join(" · ")} />
        <Row k="ID do pagamento (gateway)" v={o.provider_payment_id} />
        <Row k="Valor" v={money(o.total_cents)} />
        <Row k="Pedido feito em" v={dt(o.created_at)} />
        <Row k="Pago em" v={dt(o.paid_at)} />
        {o.coupon_code ? <Row k="Cupom aplicado" v={`${o.coupon_code} (${money(o.coupon_discount_cents ?? 0)} de desconto)`} /> : null}
      </Section>

      <Section title="Comprador">
        <Row k="Nome" v={o.customer_name} />
        <Row k="CPF/CNPJ" v={o.customer_document} />
        <Row k="E-mail" v={o.customer_email} />
        <Row k="Telefone" v={o.customer_phone} />
      </Section>

      <Section title="Itens">
        {items.map((i, n) => (
          <Row key={n} k={`${i.quantity}x`} v={`${i.product_name} — ${money(i.total_cents)}`} />
        ))}
        {o.businesses?.name ? <Row k="Negócio configurado" v={`${o.businesses.name} (${o.businesses.review_url ?? "—"})`} /> : null}
      </Section>

      <Section title="Entrega">
        <Row k="Endereço" v={[o.ship_street, o.ship_number, o.ship_complement, o.ship_district, `${o.ship_city ?? ""}/${o.ship_state ?? ""}`, o.ship_zip].filter(Boolean).join(", ")} />
        <Row k="Situação" v={o.fulfillment_status} />
        <Row k="Enviado em" v={dt(o.shipped_at)} />
        <Row k="Transportadora" v={carrier} />
        <Row k="Código de rastreio" v={o.tracking_code} />
        {url ? <Row k="Link de rastreio" v={<a className="underline" href={url}>{url}</a>} /> : null}
      </Section>

      <Section title="Comunicação com o cliente (e-mails automáticos)">
        {emails.length === 0 ? <Row k="E-mails" v="Nenhum registrado" /> : null}
        {emails.map((e, n) => (
          <Row key={n} k={EVENT_LABEL[e.event_type] ?? e.event_type} v={`${e.status} · ${dt(e.sent_at ?? e.created_at)} · ${e.recipient}`} />
        ))}
      </Section>

      {o.internal_notes ? (
        <Section title="Observações internas">
          <Row k="Notas" v={o.internal_notes} />
        </Section>
      ) : null}

      <p className="mt-8 text-xs text-muted-foreground">
        Anexe a este dossiê: print do rastreio com "entregue", a declaração de conteúdo do Melhor Envio e a conversa de WhatsApp com o cliente.
      </p>
    </div>
  );
}
