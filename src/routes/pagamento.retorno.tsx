import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PageShell } from "@/components/site/PageShell";
import { verifyReturnedPayment } from "@/lib/payments/reconcile.functions";
import { createInfinitePayCheckout, verifyInfinitePayReturn } from "@/lib/payments/infinitepay.functions";
import { verifyPagarmeReturn } from "@/lib/payments/pagarme.functions";
import { ProductionNotice } from "@/components/ProductionNotice";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

// O Mercado Pago volta com payment_id (ou collection_id) na URL. Só usamos isso pra
// perguntar ao próprio MP o que aconteceu -- o status da URL nunca é confiado.
const searchSchema = z.object({
  payment_id: z.coerce.string().optional().catch(undefined),
  collection_id: z.coerce.string().optional().catch(undefined),
  // InfinitePay volta com order_nsu (id do pedido), transaction_nsu e slug.
  order_nsu: z.string().optional().catch(undefined),
  // Pagar.me (Stone) volta com ?gw=pagarme&ref=<id do pedido>.
  gw: z.string().optional().catch(undefined),
  ref: z.string().optional().catch(undefined),
  transaction_nsu: z.string().optional().catch(undefined),
  slug: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/pagamento/retorno")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Pagamento | GCard-PRÓ" }, { name: "robots", content: "noindex" }],
  }),
  component: PagamentoRetorno,
});

type View =
  | { kind: "loading" }
  | { kind: "pago"; orderNumber: number | null }
  | { kind: "pendente"; orderNumber: number | null }
  | { kind: "falhou"; orderNumber: number | null }
  | { kind: "desconhecido" };

function PagamentoRetorno() {
  const search = Route.useSearch();
  const paymentId = search.payment_id || search.collection_id;
  const verifyMp = useServerFn(verifyReturnedPayment);
  const verifyIp = useServerFn(verifyInfinitePayReturn);
  const verifyPg = useServerFn(verifyPagarmeReturn);
  const isPg = search.gw === "pagarme" && Boolean(search.ref);
  const createIp = useServerFn(createInfinitePayCheckout);
  const [ipBusy, setIpBusy] = useState(false);
  const isIp = Boolean(search.order_nsu && search.transaction_nsu && search.slug);
  // UUID do pedido que a URL de retorno traz (Pagar.me: ref; InfinitePay: order_nsu). No retorno do Mercado Pago não há.
  const knownOrderId = isPg ? (search.ref ?? null) : isIp ? (search.order_nsu ?? null) : null;
  const [view, setView] = useState<View>(paymentId || isIp || isPg ? { kind: "loading" } : { kind: "desconhecido" });

  useEffect(() => {
    if (!paymentId && !isIp && !isPg) return;
    let cancelled = false;
    const call = isPg
      ? verifyPg({ data: { orderId: search.ref! } })
      : isIp
      ? verifyIp({ data: { orderId: search.order_nsu!, transactionNsu: search.transaction_nsu!, slug: search.slug! } })
      : verifyMp({ data: { paymentId: paymentId! } });
    call
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) return setView({ kind: "desconhecido" });
        const orderNumber = res.orderNumber;
        if (res.status === "pago") setView({ kind: "pago", orderNumber });
        else if (res.status === "pendente") setView({ kind: "pendente", orderNumber });
        else setView({ kind: "falhou", orderNumber });
      })
      .catch(() => !cancelled && setView({ kind: "desconhecido" }));
    return () => {
      cancelled = true;
    };
  }, [paymentId, isIp, isPg, search.ref, verifyPg, search.order_nsu, search.transaction_nsu, search.slug, verifyMp, verifyIp]);

  const content = {
    loading: {
      title: "Confirmando seu pagamento…",
      body: "Só um instante, estamos conferindo o pagamento.",
    },
    pago: {
      title: "Pagamento confirmado!",
      body: "Recebemos seu pagamento. Enviamos um e-mail com os próximos passos — se não aparecer, olhe também o spam.",
    },
    pendente: {
      title: "Pagamento em processamento",
      body: "Pix e boleto podem levar um pouco pra compensar. Assim que confirmar, você recebe um e-mail e o pedido entra em produção.",
    },
    falhou: {
      title: "Pagamento não aprovado",
      body: "Essa tentativa não foi aprovada. Você pode tentar de novo por outro meio de pagamento ou falar com a gente.",
    },
    desconhecido: {
      title: "Não conseguimos confirmar agora",
      body: "Se você acabou de pagar, fique tranquilo: assim que o pagamento for confirmado, atualizamos o pedido e você recebe um e-mail. Qualquer dúvida, chama a gente no WhatsApp.",
    },
  }[view.kind];

  const orderNumber = "orderNumber" in view ? view.orderNumber : null;

  const tone = view.kind === "pago" ? "green" : view.kind === "falhou" ? "warn" : "";
  return (
    <PageShell width={560}>
      <div className="card col" style={{ gap: 12, alignItems: "center", textAlign: "center", padding: 32 }}>
        <span className={`badge ${tone}`}>{view.kind === "pago" ? "Pago" : view.kind === "falhou" ? "Não aprovado" : view.kind === "pendente" ? "Em processamento" : view.kind === "loading" ? "Conferindo" : "Sem confirmação"}</span>
        <h1>{content.title}</h1>
        {orderNumber ? <p className="muted">Pedido <span className="badge"><b>#{orderNumber}</b></span></p> : null}
        <p className="muted" style={{ maxWidth: 440 }}>{content.body}</p>
        {view.kind === "pago" || view.kind === "pendente" ? <ProductionNotice className="mt-2" /> : null}

        {view.kind === "falhou" && orderNumber && knownOrderId ? (
          <div className="card goldframe col" style={{ gap: 6, textAlign: "left", width: "100%" }}>
            <b>Tentar por outro meio de pagamento</b>
            <span className="sm muted">Pague este mesmo pedido por Pix ou cartão pela InfinitePay.</span>
            <button
              type="button"
              className="btn goldbtn block"
              disabled={ipBusy}
              onClick={() => {
                setIpBusy(true);
                createIp({ data: { orderId: knownOrderId } })
                  .then((r) => {
                    if (r.ok) window.location.href = r.url;
                    else setIpBusy(false);
                  })
                  .catch(() => setIpBusy(false));
              }}
            >
              {ipBusy ? "Abrindo…" : "Pagar com InfinitePay"}
            </button>
          </div>
        ) : null}

        <div className="col" style={{ width: "100%", marginTop: 8 }}>
          {view.kind === "falhou" ? <Link to="/produtos" className="btn primary block">Tentar de novo</Link> : null}
          {view.kind === "falhou" || view.kind === "desconhecido" ? (
            <div className="row wrap" style={{ gap: 8, justifyContent: "center" }}>
              {WHATSAPP_CONTACTS.map((c) => (
                <a
                  key={c.number}
                  className="btn"
                  href={whatsappLink(c.number, orderNumber ? `Oi! Preciso de ajuda com o pagamento do pedido #${orderNumber}.` : "Oi! Preciso de ajuda com o pagamento do meu pedido.")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp {c.name}
                </a>
              ))}
            </div>
          ) : null}
          <Link to="/" className={`btn ${view.kind === "falhou" ? "" : "primary"} block`}>Voltar ao início</Link>
        </div>
      </div>
    </PageShell>
  );
}
