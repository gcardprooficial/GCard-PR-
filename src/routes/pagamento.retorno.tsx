import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { verifyReturnedPayment } from "@/lib/payments/reconcile.functions";
import { createInfinitePayCheckout, verifyInfinitePayReturn } from "@/lib/payments/infinitepay.functions";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

// O Mercado Pago volta com payment_id (ou collection_id) na URL. Só usamos isso pra
// perguntar ao próprio MP o que aconteceu -- o status da URL nunca é confiado.
const searchSchema = z.object({
  payment_id: z.coerce.string().optional().catch(undefined),
  collection_id: z.coerce.string().optional().catch(undefined),
  // InfinitePay volta com order_nsu (id do pedido), transaction_nsu e slug.
  order_nsu: z.string().optional().catch(undefined),
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
  const createIp = useServerFn(createInfinitePayCheckout);
  const [ipBusy, setIpBusy] = useState(false);
  const isIp = Boolean(search.order_nsu && search.transaction_nsu && search.slug);
  const [view, setView] = useState<View>(paymentId || isIp ? { kind: "loading" } : { kind: "desconhecido" });

  useEffect(() => {
    if (!paymentId && !isIp) return;
    let cancelled = false;
    const call = isIp
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
  }, [paymentId, isIp, search.order_nsu, search.transaction_nsu, search.slug, verifyMp, verifyIp]);

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
      body: "Se você acabou de pagar, fique tranquilo: assim que o Mercado Pago avisar, atualizamos o pedido e você recebe um e-mail. Qualquer dúvida, chama a gente no WhatsApp.",
    },
  }[view.kind];

  const orderNumber = "orderNumber" in view ? view.orderNumber : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-8 text-center card-soft sm:p-10">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{content.title}</h1>
        {orderNumber ? (
          <p className="mt-4 text-base text-muted-foreground">
            Pedido{" "}
            <strong className="rounded-xl bg-foreground/5 px-2.5 py-1 font-display text-xl font-black text-foreground">
              #{orderNumber}
            </strong>
          </p>
        ) : null}
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          {content.body}
        </p>

        {view.kind === "falhou" && orderNumber ? (
          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left">
            <p className="text-sm font-bold">Tentar por outro meio de pagamento</p>
            <p className="mt-1 text-xs text-muted-foreground">Pague este mesmo pedido por Pix ou cartão pela InfinitePay.</p>
            <Button
              className="mt-3 w-full rounded-xl font-bold"
              disabled={ipBusy}
              onClick={() => {
                setIpBusy(true);
                createIp({ data: { orderNumber } })
                  .then((r) => {
                    if (r.ok) window.location.href = r.url;
                    else setIpBusy(false);
                  })
                  .catch(() => setIpBusy(false));
              }}
            >
              {ipBusy ? "Abrindo…" : "Pagar com InfinitePay"}
            </Button>
          </div>
        ) : null}

        <div className="mt-8 grid gap-3">
          {view.kind === "falhou" ? (
            <Button asChild size="lg" className="rounded-2xl">
              <Link to="/comprar">Tentar de novo</Link>
            </Button>
          ) : null}
          {view.kind === "falhou" || view.kind === "desconhecido" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {WHATSAPP_CONTACTS.map((c) => (
                <Button key={c.number} asChild variant="outline" className="rounded-2xl">
                  <a
                    href={whatsappLink(
                      c.number,
                      orderNumber
                        ? `Oi! Preciso de ajuda com o pagamento do pedido #${orderNumber}.`
                        : "Oi! Preciso de ajuda com o pagamento do meu pedido.",
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp {c.name}
                  </a>
                </Button>
              ))}
            </div>
          ) : null}
          <Button asChild variant={view.kind === "falhou" ? "ghost" : "default"} size="lg" className="rounded-2xl">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
