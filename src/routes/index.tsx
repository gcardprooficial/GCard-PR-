import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { getCatalog } from "@/lib/catalog.functions";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroCartao from "@/assets/gcard-pro-cartao-nfc-mockup-avaliacao-google.webp";
import produtoCartao from "@/assets/gcard-pro-cartao-nfc-arte-frontal.webp";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({
    meta: [
      {
        title: "GCard-PRÓ | Cartão NFC para avaliações no Google",
      },
      {
        name: "description",
        content:
          "Cartão de bolso NFC para avaliações no Google, entregue configurado para o seu negócio.",
      },
      {
        property: "og:title",
        content: "GCard-PRÓ | Mais avaliações no Google com um toque",
      },
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
};

const FALLBACK_PRODUCTS = [
  {
    id: "fallback-cartao",
    slug: "cartao-bolso",
    name: "Cartão de bolso GCard-PRÓ",
    format: "Cartão NFC 8,5 x 5,4 cm",
    status: "ativo",
    has_nfc: true,
    has_qr: false,
  },
] as const;

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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:py-4">
        <Link
          to="/"
          className="group flex items-center gap-2 -m-1 p-1 rounded-xl transition-transform duration-300 hover:scale-[1.01]"
        >
          <img
            src={logoTransparente}
            alt="GCard-PRÓ"
            className="h-8 w-auto sm:h-9 select-none"
            draggable={false}
          />
          <span className="sr-only">GCard-PRÓ</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="#caminhos"
            className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Como funciona
          </a>
          <a
            href="#modelos"
            className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Modelos
          </a>
          <Button
            asChild
            size="sm"
            className="btn-press btn-primary-shadow rounded-2xl px-4 sm:px-5"
          >
            <Link to="/comprar" search={{}}>
              Comprar agora →
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroBadge() {
  return (
    <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3.5 py-1.5">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-2.5 animate-ping-slow rounded-full bg-primary opacity-70" />
        <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
      </span>
      <span className="text-xs font-bold tracking-wide text-foreground/90 sm:text-sm">
        Fornecedor direto · NFC · Sem mensalidade
      </span>
    </div>
  );
}

function ImpactCalculator() {
  const [ticket, setTicket] = useState(80);
  const [customers, setCustomers] = useState(150);
  const potential = Math.round(ticket * customers * 0.14);

  return (
    <section className="border-y border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:items-center md:py-20">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Calculadora de impacto
          </p>
          <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
            Quanto uma boa reputação vale?
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65 sm:text-base">
            Uma experiência simples no balcão ajuda mais clientes satisfeitos a encontrarem a tela
            de avaliação.
          </p>
        </div>
        <div className="grid gap-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 sm:grid-cols-2 sm:p-8">
          <label className="text-sm font-semibold text-white/75">
            Ticket médio (R$)
            <input
              type="number"
              min={1}
              value={ticket}
              onChange={(event) => setTicket(Number(event.target.value) || 0)}
              className="mt-2 h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-lg font-bold text-white outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm font-semibold text-white/75">
            Clientes por mês
            <input
              type="number"
              min={1}
              value={customers}
              onChange={(event) => setCustomers(Number(event.target.value) || 0)}
              className="mt-2 h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-lg font-bold text-white outline-none focus:border-primary"
            />
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">
              Potencial mensal estimado
            </p>
            <p className="mt-1 font-display text-4xl text-primary sm:text-5xl">
              {money(potential * 100)}
            </p>
            <p className="mt-2 text-xs text-white/50">
              Simulação ilustrativa com 14% de potencial adicional.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const lojista = data.plans.find((p) => p.slug === "lojista") ?? {
    name: "Plano Lojista",
    audience: "Para usar no seu próprio balcão",
    unit_price_cents: 5990,
    tiers: [
      { min_quantity: 1, unit_price_cents: 5990, label: "1 a 4 unidades" },
      { min_quantity: 5, unit_price_cents: 4990, label: "5 unidades" },
    ],
  };
  const revenda = data.plans.find((p) => p.slug === "renda-extra") ?? {
    name: "Pack Renda Extra",
    audience: "Comprar em quantidade e revender",
    unit_price_cents: 3790,
    tiers: [
      { min_quantity: 10, unit_price_cents: 3790, label: "10 a 24 unidades" },
      { min_quantity: 25, unit_price_cents: 2790, label: "25 a 99 unidades" },
      { min_quantity: 100, unit_price_cents: 1990, label: "100 unidades ou mais" },
    ],
  };
  const catalogProducts = data.products.filter(
    (product) => product.slug === "cartao-bolso" && product.status === "ativo",
  );
  const products = catalogProducts.length > 0 ? catalogProducts : FALLBACK_PRODUCTS;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background noise-bg">
      {/* Blobs decorativos do fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-[500px] rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-24 size-[460px] rounded-full bg-foreground/5 blur-3xl"
      />

      <Header />

      {/* ===== HERO ===== */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 sm:pt-16 md:grid-cols-2 md:gap-12 md:pt-20 md:pb-24">
        <div className="relative z-10">
          <HeroBadge />

          <h1 className="mt-6 animate-rise delay-1 text-4xl leading-[1.02] tracking-tight sm:text-5xl md:text-[3.35rem] md:leading-[1.03]">
            Mais avaliações no Google{" "}
            <span className="highlight-yellow relative inline-block">com um toque</span>.
          </h1>

          <p className="mt-6 animate-rise delay-2 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            O <strong className="text-foreground/90">cartão de bolso</strong> usa aproximação NFC e
            chega pronto para o seu negócio. Você informa a empresa na compra; nós gravamos o chip e
            enviamos pronto para usar.
          </p>

          <div className="mt-8 flex animate-rise delay-3 flex-wrap gap-3 sm:gap-4">
            <Button
              asChild
              size="lg"
              className="btn-press btn-primary-shadow shine-border h-14 rounded-2xl px-6 text-base font-bold"
            >
              <Link to="/comprar" search={{ caminho: "lojista" }}>
                Quero para o meu negócio
                <svg
                  className="ml-0.5 size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="btn-press h-14 rounded-2xl border-2 px-6 text-base font-bold hover:bg-card"
            >
              <Link to="/comprar" search={{ caminho: "revenda" }}>
                Comprar em quantidade
              </Link>
            </Button>
          </div>

          <div className="mt-8 flex animate-rise delay-4 flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Stars />
              <span className="font-semibold text-foreground/80">+ estrelas no Google</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-g-green/15 text-g-green">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span>iPhone & Android</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/25 text-primary-foreground">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12h2l2-7 10 14 2-7h2" />
                </svg>
              </span>
              <span>Frete grátis no Brasil</span>
            </div>
          </div>
        </div>

        {/* ===== HERO IMAGEM ===== */}
        <div className="relative animate-pop delay-2">
          <div className="absolute -inset-3 rounded-[2.25rem] bg-gradient-to-br from-primary/25 via-transparent to-foreground/5 blur-xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-border card-soft lift shine-border aspect-[4/3] h-64 sm:h-80 md:h-[480px]">
            <img
              src={heroCartao}
              alt="Cartão GCard-PRÓ sendo aproximado do celular para abrir a avaliação no Google"
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              draggable={false}
            />
          </div>

          {/* Card flutuante "funciona com Google" */}
          <div className="absolute -bottom-5 -left-5 animate-float shadow-2xl !animate-rise delay-6 sm:-left-8">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 backdrop-blur shadow-2xl shadow-foreground/10">
              <div className="flex -space-x-1.5">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-g-blue text-[10px] font-black text-white">
                  G
                </span>
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-g-red text-[10px] font-black text-white">
                  o
                </span>
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-g-yellow text-[10px] font-black text-white">
                  o
                </span>
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-g-green text-[10px] font-black text-white">
                  g
                </span>
              </div>
              <div className="text-xs leading-tight">
                <p className="font-bold text-foreground">Google Reviews</p>
                <p className="text-muted-foreground">Integração direta</p>
              </div>
            </div>
          </div>

          {/* Card flutuante "+ 287 avaliações" */}
          <div className="absolute -right-4 top-10 animate-bounce-subtle sm:-right-6 sm:top-14">
            <div className="rounded-2xl border border-border bg-card/95 px-4 py-3 backdrop-blur shadow-2xl shadow-foreground/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cartão NFC
              </p>
              <p className="mt-0.5 font-display text-2xl font-black leading-none">
                <span className="text-primary">Pronto para usar</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                configurado para seu negócio
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DOIS CAMINHOS ===== */}
      <section id="caminhos" className="relative border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="animate-rise text-xs font-black uppercase tracking-[0.2em] text-primary">
              Escolha seu objetivo
            </p>
            <h2 className="mt-3 animate-rise delay-1 text-3xl leading-tight sm:text-4xl md:text-5xl">
              Um cartão para o seu negócio. Um plano para quem revende.
            </h2>
            <p className="mt-4 animate-rise delay-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Compre para sua loja ou em quantidade para revender cartões de bolso NFC.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-7">
            {/* CAMINHO 1 — LOJISTA */}
            {lojista && (
              <div className="group relative animate-rise delay-2 rounded-[1.75rem] border-2 border-transparent bg-card p-7 sm:p-8 card-soft card-soft-hover shine-border">
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.75rem] bg-primary/0 transition-all duration-500 group-hover:bg-primary" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary-foreground">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Loja própria
                    </div>
                    <h3 className="mt-4 text-2xl sm:text-3xl">{lojista.name}</h3>
                    <p className="mt-1 text-muted-foreground text-sm sm:text-base">
                      {lojista.audience}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-primary/15 p-3 text-primary-foreground transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:shadow-lg">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 7h18v12H3z" />
                      <path d="M3 11h18" />
                      <path d="M7 15h4" />
                    </svg>
                  </div>
                </div>

                <div className="mt-6 flex items-end gap-2">
                  <span className="font-display text-4xl font-black leading-none sm:text-5xl">
                    {money(lojista.unit_price_cents)}
                  </span>
                  <span className="pb-1 text-base font-semibold text-muted-foreground sm:text-lg">
                    / unidade
                  </span>
                </div>

                <ul className="mt-6 space-y-3 text-sm sm:text-base">
                  {[
                    "De 1 a 5 cartões por pedido",
                    "Cartão de bolso NFC, pronto para usar",
                    "Entrega apontando para a avaliação do seu Google",
                    "Pronto pra usar: sem configuração nenhuma",
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-foreground/80">
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-g-green/15 text-g-green">
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span className="font-medium">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  className="btn-press btn-primary-shadow mt-8 h-14 w-full rounded-2xl text-base font-bold"
                >
                  <Link to="/comprar" search={{ caminho: "lojista" }}>
                    Comprar meu cartão →
                  </Link>
                </Button>
              </div>
            )}

            {/* CAMINHO 2 — REVENDA */}
            {revenda && (
              <div className="group relative animate-rise delay-3 rounded-[1.75rem] border-2 border-foreground/5 bg-card p-7 sm:p-8 card-soft card-soft-hover shine-border">
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.75rem] bg-foreground/0 transition-all duration-500 group-hover:bg-foreground" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-foreground/90 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Revenda
                    </div>
                    <h3 className="mt-4 text-2xl sm:text-3xl">{revenda.name}</h3>
                    <p className="mt-1 text-muted-foreground text-sm sm:text-base">
                      {revenda.audience}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-foreground/5 p-3 text-foreground transition-all duration-300 group-hover:scale-110 group-hover:bg-foreground group-hover:text-white group-hover:shadow-lg">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="17" cy="17" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M8.59 8.59 14.41 14.41" />
                      <path d="m15 11 6-6" />
                      <path d="m3 21 6-6" />
                    </svg>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Preço por unidade (quanto mais, mais barato)
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {revenda.tiers.slice(0, 3).map((tier) => (
                      <span
                        key={tier.min_quantity}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold sm:text-sm"
                      >
                        <span className="text-muted-foreground">
                          {tier.label ?? `${tier.min_quantity}+`}
                        </span>
                        <span className="text-foreground">{money(tier.unit_price_cents)}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <ul className="mt-6 space-y-3 text-sm sm:text-base">
                  {[
                    "Cartões de bolso NFC em quantidade",
                    "Condição especial para compras maiores",
                    "Margem acima de 100% vendendo pelo preço sugerido",
                    "Atendimento para alinhar seu pedido",
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-foreground/80">
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/30 text-primary-foreground">
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span className="font-medium">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="btn-press mt-8 h-14 w-full rounded-2xl border-2 text-base font-bold hover:bg-card"
                >
                  <Link to="/comprar" search={{ caminho: "revenda" }}>
                    Comprar lote →
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="animate-rise text-xs font-black uppercase tracking-[0.2em] text-primary">
            Simples assim
          </p>
          <h2 className="mt-3 animate-rise delay-1 text-3xl leading-tight sm:text-4xl md:text-5xl">
            Como funciona do <span className="highlight-yellow">nosso lado</span>.
          </h2>
          <p className="mt-4 animate-rise delay-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pedido, produção, envio. Depois é só colar no balcão.
          </p>
        </div>

        <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Linha conectora (desktop) */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 right-0 top-[58px] hidden h-0.5 w-2/3 -translate-x-1/2 rounded-full sm:block"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-foreground) 15%, transparent) 50%, transparent)",
            }}
          />

          {[
            {
              n: "01",
              t: "Você compra",
              d: "Escolhe o modelo, informa o negócio do Google e paga pelo site. 2 minutos.",
              icon: (
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4M4 6v12c0 1.1.9 2 2 2h14v-4" />
              ),
            },
            {
              n: "02",
              t: "Nós produzimos",
              d: "Imprimimos com a sua arte, gravamos o chip NFC e configuramos o QR dinâmico.",
              icon: (
                <>
                  <path d="m7.5 4.27 9 5.15" />
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </>
              ),
            },
            {
              n: "03",
              t: "Aproxime",
              d: "O cliente aproxima o celular ou escaneia o QR e chega à avaliação em segundos.",
              icon: (
                <>
                  <circle cx="8" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                  <path d="M10 18h4M4 18V6a2 2 0 0 1 2-2h11l5 5v9" />
                  <path d="M14 4v6h6" />
                </>
              ),
            },
            {
              n: "04",
              t: "Cresça",
              d: "Mais avaliações positivas, mais confiança e mais oportunidades para o seu negócio.",
              icon: (
                <>
                  <path d="m4 19 6-6 4 4 6-8" />
                  <path d="M14 9h6v6" />
                </>
              ),
            },
          ].map((step, i) => (
            <div
              key={step.n}
              className={`animate-rise delay-${i + 1} relative rounded-3xl border border-border bg-card p-7 sm:p-8 card-soft card-soft-hover`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary font-display text-lg font-black text-primary-foreground shadow-sm transition-transform duration-500 hover:scale-110">
                  {step.n}
                </span>
                <div className="rounded-2xl bg-muted p-2.5 text-foreground">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {step.icon}
                  </svg>
                </div>
              </div>
              <h3 className="mt-5 text-xl sm:text-2xl">{step.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {step.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ImpactCalculator />

      <section id="precos" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Preços transparentes
          </p>
          <h2 className="mt-3 text-3xl leading-tight sm:text-4xl md:text-5xl">
            Compre para você ou revenda.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Sem mensalidade, sem letras miúdas. Pague uma vez e use o cartão no dia a dia.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-[1.75rem] border-2 border-primary bg-card p-7 shadow-xl shadow-primary/10 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="badge-pill bg-primary/15 text-foreground">Lojista</span>
              <span className="text-xs font-bold text-primary">Pronto para uso</span>
            </div>
            <h3 className="mt-5 text-2xl sm:text-3xl">Cartão de bolso já configurado</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Você envia o link do Google e recebe o cartão pronto. Limite de 5 unidades por pedido.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface p-4">
                <p className="text-xs text-muted-foreground">1 a 4 unidades</p>
                <p className="mt-1 font-display text-2xl">R$ 59,90</p>
                <p className="text-xs text-muted-foreground">por unidade</p>
              </div>
              <div className="rounded-xl bg-primary p-4 text-primary-foreground">
                <p className="text-xs opacity-80">5 unidades</p>
                <p className="mt-1 font-display text-2xl">R$ 49,90</p>
                <p className="text-xs opacity-80">por unidade</p>
              </div>
            </div>
            <Button asChild size="lg" className="mt-6 h-12 w-full rounded-xl">
              <Link to="/comprar" search={{ caminho: "lojista" }}>
                Comprar agora
              </Link>
            </Button>
          </div>
          <div className="rounded-[1.75rem] border border-border bg-card p-7 card-soft sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="badge-pill bg-secondary text-secondary-foreground">Revendedor</span>
              <span className="text-xs font-bold text-muted-foreground">Melhor margem</span>
            </div>
            <h3 className="mt-5 text-2xl sm:text-3xl">Cartões em branco em lote</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Cartões de bolso NFC para compras em quantidade e revenda.
            </p>
            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {[
                ["10 a 24", "R$ 37,90"],
                ["25 a 99", "R$ 27,90"],
                ["100+", "R$ 19,90"],
              ].map(([label, price]) => (
                <div key={label} className="rounded-xl bg-surface p-3">
                  <p className="text-xs text-muted-foreground">{label} unidades</p>
                  <p className="mt-1 font-display text-xl">{price}</p>
                  <p className="text-xs text-muted-foreground">por unidade</p>
                </div>
              ))}
            </div>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="mt-6 h-12 w-full rounded-xl border-2"
            >
              <Link to="/comprar" search={{ caminho: "revenda" }}>
                Começar a revender
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ===== MODELOS ===== */}
      <section id="modelos" className="relative border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="animate-rise text-xs font-black uppercase tracking-[0.2em] text-primary">
                Produto disponível agora
              </p>
              <h2 className="mt-3 animate-rise delay-1 text-3xl leading-tight sm:text-4xl md:text-5xl">
                Comece pelo cartão de bolso.
              </h2>
            </div>
            <p className="animate-rise delay-2 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              O cartão de bolso com NFC está disponível agora.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3 md:gap-7">
            {products.map((product, i) => {
              const isSoon = product.status !== "ativo";
              return (
                <div
                  key={product.id}
                  className={`group animate-rise delay-${
                    i + 1
                  } overflow-hidden rounded-3xl border border-border bg-card card-soft card-soft-hover shine-border`}
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-surface">
                    <img
                      src={IMAGES[product.slug] ?? produtoCartao}
                      alt={product.name}
                      className="h-full w-full object-cover transition-all duration-700 group-hover:scale-105"
                      loading="lazy"
                      draggable={false}
                    />
                    {isSoon && (
                      <div className="absolute inset-0 flex items-center justify-center bg-foreground/60 backdrop-blur-[2px]">
                        <span className="badge-pill bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                          Em breve · lançamento
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold sm:text-xl">{product.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{product.format}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {[
                        product.has_nfc && {
                          label: "NFC",
                          color: "bg-primary/20 text-primary-foreground",
                        },
                        product.has_qr && {
                          label: "QR Code",
                          color: "bg-foreground/10 text-foreground",
                        },
                      ]
                        .filter(Boolean)
                        .map((tag) => (
                          <span
                            key={tag!.label}
                            className={`inline-flex items-center rounded-xl px-2.5 py-1 text-[11px] font-black tracking-wide ${tag!.color}`}
                          >
                            {tag!.label}
                          </span>
                        ))}
                    </div>

                    <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dimensões
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground">
                      {product.slug === "cartao-bolso" && "8,5 x 5,4 cm · Cartão"}
                      {product.slug === "plaquinha-10x10" && "10 x 10 cm · Quadrada"}
                      {product.slug === "plaquinha-10x15-l" && "10 x 15 cm · Formato L"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="mx-auto max-w-3xl px-5 py-16 md:py-20">
        <div className="text-center">
          <p className="animate-rise text-xs font-black uppercase tracking-[0.2em] text-primary">
            Dúvidas rápidas
          </p>
          <h2 className="mt-3 animate-rise delay-1 text-3xl leading-tight sm:text-4xl">
            Respostas sem <span className="highlight-yellow">enrolação</span>.
          </h2>
        </div>

        <Accordion
          type="single"
          collapsible
          className="mt-10 animate-rise delay-2 space-y-3 *:!rounded-2xl *:overflow-hidden *:border *:border-border *:bg-card *:shadow-sm *:!mt-0 *:border-b *:data-[state=open]:border-foreground/20"
        >
          <AccordionItem value="a" className="group">
            <AccordionTrigger className="group-hover:bg-surface/50 !px-5 sm:!px-6 !py-5 text-base sm:text-lg font-bold hover:no-underline">
              Tem mensalidade?
            </AccordionTrigger>
            <AccordionContent className="!px-5 sm:!px-6 !pb-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Não. Você paga uma vez pelo cartão e usa para sempre. Nenhum custo recorrente, nenhuma
              assinatura escondida.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="b">
            <AccordionTrigger className="group-hover:bg-surface/50 !px-5 sm:!px-6 !py-5 text-base sm:text-lg font-bold hover:no-underline">
              Funciona em qualquer celular?
            </AccordionTrigger>
            <AccordionContent className="!px-5 sm:!px-6 !pb-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              O cartão de bolso funciona por NFC em iPhone XS+ e na maioria dos Androids
              compatíveis.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="c">
            <AccordionTrigger className="group-hover:bg-surface/50 !px-5 sm:!px-6 !py-5 text-base sm:text-lg font-bold hover:no-underline">
              Preciso configurar algo?
            </AccordionTrigger>
            <AccordionContent className="!px-5 sm:!px-6 !pb-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Não. Você informa o seu negócio durante a compra e nós entregamos o cartão já
              configurado.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="d">
            <AccordionTrigger className="group-hover:bg-surface/50 !px-5 sm:!px-6 !py-5 text-base sm:text-lg font-bold hover:no-underline">
              Quanto custa o frete?
            </AccordionTrigger>
            <AccordionContent className="!px-5 sm:!px-6 !pb-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Frete <strong className="text-foreground">grátis</strong> para todo o território
              nacional. Enviamos pelos Correios (PAC ou Sedex, conforme o prazo disponível).
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="e">
            <AccordionTrigger className="group-hover:bg-surface/50 !px-5 sm:!px-6 !py-5 text-base sm:text-lg font-bold hover:no-underline">
              Posso trocar o link da placa depois?
            </AccordionTrigger>
            <AccordionContent className="!px-5 sm:!px-6 !pb-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Claro. É só mandar uma mensagem pro nosso Instagram{" "}
              <a
                href="https://instagram.com/gcardpro.oficial"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-foreground underline underline-offset-2 hover:text-primary decoration-primary decoration-2"
              >
                @gcardpro.oficial
              </a>{" "}
              que a gente atualiza. Não precisa reimprimir nada, é só o link dinâmico do nosso
              painel.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="border-t border-border bg-surface/60">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-20">
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 sm:p-12 md:p-14 card-soft">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 size-[400px] rounded-full bg-primary/25 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -left-10 size-[360px] rounded-full bg-foreground/5 blur-3xl"
            />

            <div className="relative grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
              <div className="max-w-xl">
                <span className="badge-pill animate-rise bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  ⭐ Comece hoje mesmo
                </span>
                <h2 className="mt-4 animate-rise delay-1 text-3xl leading-[1.1] sm:text-4xl md:text-5xl">
                  Pronto para encher o seu Google de{" "}
                  <span className="highlight-yellow">5 estrelas</span>?
                </h2>
                <p className="mt-4 animate-rise delay-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Entre no grupo de lançamento: condição especial para os primeiros, novidades dos
                  novos formatos e uma comunidade de donos de negócio crescendo juntos.
                </p>
              </div>

              <div className="animate-rise delay-3 flex flex-col gap-3">
                <Button
                  asChild
                  size="lg"
                  className="btn-press btn-primary-shadow shine-border h-14 rounded-2xl text-base font-bold"
                >
                  <Link
                    to="/comprar"
                    search={{}}
                    data-analytics-event="begin_checkout"
                    data-analytics-label="cta final"
                  >
                    Comprar agora →
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="btn-press h-14 rounded-2xl border-2 text-base font-bold hover:bg-background"
                >
                  <a
                    href="https://chat.whatsapp.com/EBYX68zzqOICn9mIlqHwQ5"
                    data-analytics-event="generate_lead"
                    data-analytics-label="whatsapp comunidade"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg
                      className="mr-1 size-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M20.52 3.48A11.9 11.9 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.94L0 24l6.24-1.58A12 12 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.22-1.26-6.26-3.48-8.52zM12 22c-1.95 0-3.84-.5-5.48-1.44l-.39-.24-3.71 1 .99-3.61-.26-.4A9.97 9.97 0 0 1 2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm5.45-7.3c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.11 3.22 5.11 4.52.71.31 1.27.49 1.7.63.71.22 1.36.19 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.18-1.41-.07-.13-.27-.2-.57-.35z" />
                    </svg>
                    Entrar no grupo do WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Link to="/" className="inline-flex -m-1 p-1 rounded-xl">
                <img
                  src={logoTransparente}
                  alt="GCard-PRÓ"
                  className="h-9 w-auto select-none sm:h-10"
                  draggable={false}
                />
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Cartões NFC para levar seus clientes direto à avaliação do Google.
              </p>
              <p className="mt-3 text-xs text-muted-foreground/70">
                © {new Date().getFullYear()} GCard-PRÓ · CNPJ sob consulta
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Produto
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  <li>
                    <Link
                      to="/comprar"
                      search={{ caminho: "lojista" }}
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Para a minha loja
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/comprar"
                      search={{ caminho: "revenda" }}
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Revender lotes
                    </Link>
                  </li>
                  <li>
                    <a
                      href="#modelos"
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Modelos
                    </a>
                  </li>
                  <li>
                    <Link
                      to="/guia"
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Guia NFC e cartão digital
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Suporte
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  <li>
                    <a
                      href="https://instagram.com/gcardpro.oficial"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://chat.whatsapp.com/EBYX68zzqOICn9mIlqHwQ5"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      WhatsApp
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Legal
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  <li>
                    <Link
                      to="/termos"
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Termos de uso
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/privacidade"
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Política de privacidade
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
