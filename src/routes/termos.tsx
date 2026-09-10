import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | GCard-PRÓ" },
      { name: "description", content: "Termos de uso da GCard-PRÓ." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <Link to="/" className="font-display text-lg">
          GCard<span className="text-primary">-PRÓ</span>
        </Link>
        <h1 className="mt-8 text-3xl">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground">1. O que é a GCard-PRÓ</h2>
            <p>
              A GCard-PRÓ vende cartões e plaquinhas físicas com NFC e QR Code que, ao serem
              aproximados ou escaneados, abrem a tela de avaliação do Google do estabelecimento
              indicado pelo comprador. O produto é entregue já configurado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">2. Pedido e pagamento</h2>
            <p>
              O preço de cada pedido é calculado no momento da compra a partir do plano e da
              quantidade escolhidos. O frete é gratuito para todo o Brasil. O pedido é confirmado
              após a aprovação do pagamento pelo provedor de pagamento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">3. Configuração da placa</h2>
            <p>
              A placa é vinculada ao negócio informado pelo comprador durante a compra (busca no
              Google ou link de avaliação colado). É responsabilidade do comprador conferir se o
              negócio selecionado está correto antes de finalizar o pedido.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">4. Entrega</h2>
            <p>
              O prazo de produção e envio é informado por e-mail após a confirmação do pagamento. O
              código de rastreio é enviado assim que o pedido é despachado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">5. Trocas e devoluções</h2>
            <p>
              Para produtos com defeito de fabricação, entre em contato em até 7 dias após o
              recebimento. O direito de arrependimento previsto no Código de Defesa do Consumidor
              (art. 49) se aplica a compras feitas neste site.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">6. Uso correto</h2>
            <p>
              As placas só podem apontar para páginas de avaliação do Google. Qualquer tentativa de
              redirecionar para outros destinos é bloqueada pelo sistema.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">7. Contato</h2>
            <p>
              Dúvidas sobre estes termos: pelo Instagram{" "}
              <a
                className="text-foreground underline"
                href="https://instagram.com/gcardpro.oficial"
                target="_blank"
                rel="noopener noreferrer"
              >
                @gcardpro.oficial
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 flex gap-4 text-sm">
          <Link to="/" className="text-foreground underline">
            Início
          </Link>
          <Link to="/privacidade" className="text-foreground underline">
            Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
