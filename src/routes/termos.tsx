import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

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
    <div className="relative min-h-screen bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 noise-bg opacity-40" />
      <div className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute top-60 -left-32 size-[24rem] rounded-full bg-secondary/5 blur-3xl" />

      <SiteHeader />
      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <div className="mt-14 sm:mt-16 animate-rise-sm delay-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Documento oficial
          </span>
          <h1 className="mt-4 font-display text-3xl sm:text-4xl leading-tight text-foreground">
            Termos de Uso
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Última atualização: setembro de 2026.
          </p>
        </div>

        <div className="mt-10 space-y-7 animate-rise-sm delay-2">
          <Section n="1" title="O que é a GCard-PRÓ">
            <p>
              A GCard-PRÓ vende cartões físicos com NFC que, ao serem aproximados de um celular
              compatível, abrem a tela de avaliação do Google do estabelecimento indicado pelo
              comprador. O cartão de bolso é entregue configurado.
            </p>
            <p>
              A GCard-PRÓ é operada por <strong>Marusso Produções</strong>, CNPJ 68.194.199/0001-70,
              com sede em Romeu Ferigati, Indaiatuba/SP.
            </p>
          </Section>

          <Section n="2" title="Pedido e pagamento">
            <p>
              O preço de cada pedido é calculado no momento da compra a partir do produto e da
              quantidade escolhidos. O frete é gratuito para todo o Brasil. O pedido é confirmado
              após a aprovação do pagamento pelo provedor de pagamento.
            </p>
          </Section>

          <Section n="3" title="Configuração da placa">
            <p>
              A placa é vinculada ao negócio informado pelo comprador durante a compra (busca no
              Google ou link de avaliação colado). É responsabilidade do comprador conferir se o
              negócio selecionado está correto antes de finalizar o pedido.
            </p>
          </Section>

          <Section n="4" title="Entrega">
            <p>
              O prazo de produção e envio é informado por e-mail após a confirmação do pagamento. O
              código de rastreio é enviado assim que o pedido é despachado.
            </p>
          </Section>

          <Section n="5" title="Trocas e devoluções">
            <p>
              Para produtos com defeito de fabricação, entre em contato em até 7 dias após o
              recebimento. O direito de arrependimento previsto no Código de Defesa do Consumidor
              (art. 49) se aplica a compras feitas neste site.
            </p>
          </Section>

          <Section n="6" title="Uso correto">
            <p>
              As placas só podem apontar para páginas de avaliação do Google. Qualquer tentativa de
              redirecionar para outros destinos é bloqueada pelo sistema.
            </p>
          </Section>

          <Section n="7" title="Contato">
            <p>
              Dúvidas sobre estes termos: pelo Instagram{" "}
              <a
                className="text-foreground underline underline-offset-2 decoration-primary/60 hover:decoration-primary"
                href="https://instagram.com/gcardpro.oficial"
                target="_blank"
                rel="noopener noreferrer"
              >
                @gcardpro.oficial
              </a>
              .
            </p>
          </Section>
        </div>

      </div>
      <SiteFooter />
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="relative rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-5 sm:p-6 card-soft hover:border-primary/25 transition-colors">
      <div className="flex items-start gap-4">
        <div className="shrink-0 flex items-center justify-center size-9 rounded-xl bg-primary/15 font-display text-sm font-bold text-primary border border-primary/20">
          {n}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-3 text-[14.5px] leading-[1.85] text-muted-foreground">{children}</div>
        </div>
      </div>
    </section>
  );
}
