import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { getPagarmePix, verifyPagarmeReturn } from "@/lib/payments/pagarme.functions";
import { ProductionNotice } from "@/components/ProductionNotice";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

export const Route = createFileRoute("/pagamento/pix")({
  validateSearch: z.object({ ref: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Pagar com Pix | GCard-PRÓ" }, { name: "robots", content: "noindex" }] }),
  component: PagamentoPix,
});

type Pix = { orderNumber: number; totalCents: number; qrCode: string; qrUrl: string | null; expiresAt: string | null };

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PagamentoPix() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const loadPix = useServerFn(getPagarmePix);
  const verify = useServerFn(verifyPagarmeReturn);
  const [pix, setPix] = useState<Pix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ref) return setError("Link inválido.");
    let cancelled = false;
    loadPix({ data: { orderId: ref } })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setPix(r);
        else if (r.error === "already_paid") navigate({ to: "/pagamento/retorno", search: { gw: "pagarme", ref } });
        else setError("Não conseguimos gerar o Pix agora.");
      })
      .catch(() => !cancelled && setError("Não conseguimos gerar o Pix agora."));
    return () => {
      cancelled = true;
    };
  }, [ref, loadPix, navigate]);

  // Confere a cada 5s direto na Pagar.me; pagou, vai pra tela de confirmação.
  useEffect(() => {
    if (!pix || !ref) return;
    const id = setInterval(() => {
      verify({ data: { orderId: ref } })
        .then((r) => {
          if (r.ok && r.status === "pago") navigate({ to: "/pagamento/retorno", search: { gw: "pagarme", ref } });
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [pix, ref, verify, navigate]);

  async function copy() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* o campo abaixo é selecionável */
    }
  }

  const wa = WHATSAPP_CONTACTS[0] ? whatsappLink(WHATSAPP_CONTACTS[0].number, "Oi! Preciso de ajuda com o pagamento do meu pedido.") : null;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center px-4 py-12 text-center">
      {!pix && !error && <p className="text-muted-foreground">Gerando seu Pix…</p>}
      {error && (
        <>
          <h1 className="text-2xl font-semibold">Ops</h1>
          <p className="mt-3 text-muted-foreground">{error} Chame a gente no WhatsApp que resolvemos.</p>
          {wa && (
            <Button asChild className="mt-6">
              <a href={wa}>Chamar no WhatsApp</a>
            </Button>
          )}
        </>
      )}
      {pix && (
        <>
          <h1 className="text-2xl font-semibold">Pague com Pix</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pedido #{pix.orderNumber} · {brl(pix.totalCents)}</p>
          {pix.qrUrl && <img src={pix.qrUrl} alt="QR Code Pix" className="mt-6 h-56 w-56 rounded-lg border bg-white p-2" />}
          <p className="mt-6 text-sm text-muted-foreground">Ou copie o código e cole no app do seu banco:</p>
          <textarea readOnly value={pix.qrCode} rows={3} className="mt-2 w-full rounded-md border bg-muted p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button onClick={copy} className="mt-3 w-full">
            {copied ? "Copiado!" : "Copiar código Pix"}
          </Button>
          <p className="mt-6 text-sm text-muted-foreground">
            Assim que o pagamento cair, esta tela confirma sozinha. O código vale por 30 minutos.
          </p>
          <ProductionNotice className="mt-6" />
        </>
      )}
    </main>
  );
}
