import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/lib/catalog.functions";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroCartao from "@/assets/hero-cartao.jpg";
import produtoCartao from "@/assets/produto-cartao.jpg";
import produto10x10 from "@/assets/produto-plaquinha-10x10.jpg";
import produto10x15 from "@/assets/produto-plaquinha-10x15.jpg";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({
    meta: [
      { title: "GCard-PRÓ | Cartão NFC e QR Code para avaliações no Google" },
      {
        name: "description",
        content:
          "Cartão de bolso e plaquinha de balcão com NFC + QR Code que abrem a avaliação do seu Google em 3 segundos. Chega configurado, sem mensalidade.",
      },
      { property: "og:title", content: "GCard-PRÓ | Mais avaliações no Google em 3 segundos" },
      {
        property: "og:description",
        content:
          "Aproxime o celular e o cliente já está na tela de avaliação do seu negócio. Frete grátis e zero mensalidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const IMAGES: Record<string, string> = {
  "cartao-bolso": produtoCartao,
  "plaquinha-10x10": produto10x10,
  "plaquinha-10x15-l": produto10x15,
};

function Stars() {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className="size-4 fill-primary" aria-hidden="true">
          <path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7-6.2-3.4L5.8 21 7 14.2 2 9.4l7-.9L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="font-display text-lg tracking-tight">
          GCard<span className="text-primary">-PRÓ</span>
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="#caminhos"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Como funciona
          </a>
          <Button asChild size="sm">
            <Link to="/comprar" search={{ caminho: "lojista" }}>
              Quero o meu
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const lojista = data.plans.find((p) => p.slug === "lojista");
  const revenda = data.plans.find((p) => p.slug === "renda-extra");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping-slow rounded-full bg-g-blue" />
              <span className="relative inline-flex size-2 rounded-full bg-g-blue" />
            </span>
            NFC + QR Code · sem mensalidade
          </span>
          <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            Seu cliente <span className="highlight-yellow">avalia no Google</span> em 3 segundos.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Ele aproxima o celular ou aponta a câmera e cai direto na tela de avaliação do seu
            negócio. Chega pronto, configurado, com frete grátis.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/comprar" search={{ caminho: "lojista" }}>
                Quero para o meu negócio
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/comprar" search={{ caminho: "revenda" }}>
                Quero comprar em quantidade
              </Link>
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Stars /> Funciona em iPhone e Android
          </p>
        </div>

        <div className="animate-pop">
          <div className="overflow-hidden rounded-3xl card-soft">
            <img
              src={heroCartao}
              alt="Cartão GCard-PRÓ sendo aproximado do celular para abrir a avaliação no Google"
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* Dois caminhos */}
      <section id="caminhos" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl sm:text-4xl">Escolha o seu caminho</h2>
          <p className="mt-2 text-muted-foreground">
            Dois jeitos de usar o GCard-PRÓ — cada um com o seu preço.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {lojista && (
              <div className="rounded-3xl bg-card p-7 card-soft lift">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {lojista.audience}
                </p>
                <h3 className="mt-2 text-2xl">{lojista.name}</h3>
                <p className="mt-1 text-3xl font-display">
                  {money(lojista.unit_price_cents)}
                  <span className="text-base font-sans font-medium text-muted-foreground">
                    {" "}
                    / unidade
                  </span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  <li>• A partir de 1 unidade, sem limite</li>
                  <li>• Você escolhe cartão de bolso ou plaquinha de balcão</li>
                  <li>• Já vem apontando para a avaliação do seu Google</li>
                </ul>
                <Button asChild className="mt-6 w-full">
                  <Link to="/comprar" search={{ caminho: "lojista" }}>
                    Configurar o meu
                  </Link>
                </Button>
              </div>
            )}

            {revenda && (
              <div className="rounded-3xl bg-card p-7 card-soft lift">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {revenda.audience}
                </p>
                <h3 className="mt-2 text-2xl">{revenda.name}</h3>
                <p className="mt-1 text-3xl font-display">
                  a partir de {money(1990)}
                  <span className="text-base font-sans font-medium text-muted-foreground">
                    {" "}
                    / unidade
                  </span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  {revenda.tiers.map((tier) => (
                    <li key={tier.min_quantity}>
                      • {tier.label ?? `${tier.min_quantity}+ unidades`}:{" "}
                      <strong className="text-foreground">{money(tier.unit_price_cents)}</strong> cada
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-6 w-full">
                  <Link to="/comprar" search={{ caminho: "revenda" }}>
                    Comprar em quantidade
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl sm:text-4xl">Como funciona</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            { n: "1", t: "Aproxima ou escaneia", d: "NFC no celular ou QR Code para quem preferir." },
            { n: "2", t: "Abre a sua avaliação", d: "Direto na tela de estrelas do seu Google." },
            { n: "3", t: "Sua nota sobe", d: "Mais avaliações, mais aparecimento nas buscas." },
          ].map((step) => (
            <div key={step.n} className="rounded-2xl bg-card p-6 card-soft">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary font-display text-primary-foreground">
                {step.n}
              </span>
              <h3 className="mt-4 text-xl">{step.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modelos */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl sm:text-4xl">Modelos</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {data.products.map((product) => (
              <div key={product.id} className="overflow-hidden rounded-2xl bg-card card-soft lift">
                <img
                  src={IMAGES[product.slug] ?? produtoCartao}
                  alt={product.name}
                  className="aspect-4/3 w-full object-cover"
                  loading="lazy"
                />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg">{product.name}</h3>
                    {product.status !== "ativo" && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{product.format}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-3xl sm:text-4xl">Dúvidas rápidas</h2>
        <Accordion type="single" collapsible className="mt-6">
          <AccordionItem value="a">
            <AccordionTrigger>Tem mensalidade?</AccordionTrigger>
            <AccordionContent>
              Não. Você paga uma vez pelo cartão ou plaquinha e usa para sempre.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Funciona em qualquer celular?</AccordionTrigger>
            <AccordionContent>
              Sim. Celulares com NFC abrem só aproximando; os demais usam o QR Code impresso.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="c">
            <AccordionTrigger>Preciso configurar algo?</AccordionTrigger>
            <AccordionContent>
              Não. Você busca o seu negócio pelo nome durante a compra e nós entregamos já
              configurado.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="d">
            <AccordionTrigger>Quanto custa o frete?</AccordionTrigger>
            <AccordionContent>Frete grátis para todo o Brasil.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Pré-venda / grupo de lançamento */}
      <section id="pre-venda" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            Lançamento
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl">Seja um dos primeiros</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Entre no grupo de lançamento no WhatsApp: condição especial para os primeiros pedidos e
            avisos em primeira mão quando novos formatos chegarem.
          </p>
          <Button asChild size="lg" className="mt-6">
            <a
              href="https://chat.whatsapp.com/EBYX68zzqOICn9mIlqHwQ5"
              target="_blank"
              rel="noopener noreferrer"
            >
              Entrar no grupo do WhatsApp
            </a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-base text-foreground">
            GCard<span className="text-primary">-PRÓ</span>
          </span>
          <span>gcardpro.com.br · @gcardpro.oficial</span>
        </div>
      </footer>
    </div>
  );
}
