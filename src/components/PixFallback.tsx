import { useState } from "react";
import { COMPANY, PIX_KEY } from "@/lib/company";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { Button } from "@/components/ui/button";

/**
 * Saída manual quando o Mercado Pago não aceita o pagamento do cliente (conta dele
 * restrita, cartão e Pix recusados, etc.). Paga direto na chave Pix da empresa e manda
 * o comprovante -- a equipe confirma manualmente no painel (mesmo fluxo de venda por fora).
 */
export function PixFallback({ orderNumber, totalLabel }: { orderNumber: number; totalLabel?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem clipboard: a chave já está visível pra copiar manualmente.
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted/60 p-4 text-left sm:p-5">
      <p className="text-sm font-bold">Mercado Pago não aceitou seu pagamento?</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Às vezes é a própria conta do Mercado Pago do comprador que bloqueia, não o cartão. Paga
        direto na nossa chave Pix{totalLabel ? ` (${totalLabel})` : ""} e manda o comprovante no
        WhatsApp com o número do pedido — a gente confirma na hora.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 text-xs font-semibold">
          {COMPANY.legalName} · CNPJ {COMPANY.cnpj}
        </code>
        <Button size="sm" variant="outline" onClick={() => void copyKey()} className="shrink-0 rounded-xl">
          {copied ? "Copiado ✓" : "Copiar chave"}
        </Button>
      </div>
      <Button asChild size="sm" className="mt-3 w-full rounded-xl">
        <a
          href={whatsappLink(
            WHATSAPP_CONTACTS[0].number,
            `Oi! Paguei o pedido #${orderNumber} por Pix direto (Mercado Pago não aceitou). Segue o comprovante:`,
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mandar comprovante no WhatsApp
        </a>
      </Button>
    </div>
  );
}
