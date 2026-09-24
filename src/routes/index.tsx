import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/lib/catalog.functions";
import { money, resolveTiersForProduct } from "@/lib/pricing";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { ReviewLinkGenerator } from "@/components/ReviewLinkGenerator";
import { COMPANY, COMPANY_ADDRESS } from "@/lib/company";
import { VideoTutorialCard } from "@/components/VideoTutorialCard";
import { Testimonials } from "@/components/Testimonials";
import { Menu } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroCartao from "@/assets/gcard-pro-hero-barbearia.jpeg";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";
import produtoPlaquinha10x10 from "@/assets/gcard-pro-plaquinha-10x10-mockup.jpg";
import produtoPlaquinhaL from "@/assets/gcard-pro-plaquinha-l-provisorio.jpg";
import acrilico10x10Cristal from "@/assets/acrilico-10x10-cristal.jpg";
import acrilicoLCristal from "@/assets/acrilico-l-cristal.jpg";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  initialData: { products: [], plans: [] },
  initialDataUpdatedAt: 0,
  staleTime: 60_000,
  refetchOnMount: "always",
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "GCard-PRÓ | Cartão NFC para avaliações no Google",
      },
      {
        name: "description",
        content:
          "Gerador de link de avaliação do Google grátis, cartão de bolso NFC e placa com QR Code para avaliações no Google, entregues configurados para o seu negócio.",
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
    links: [{ rel: "canonical", href: "https://www.gcardpro.com.br/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Tem mensalidade?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Não. Você paga uma vez pelo cartão e usa para sempre. Nenhum custo recorrente, nenhuma assinatura escondida.",
              },
            },
            {
              "@type": "Question",
              name: "Funciona em qualquer celular?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "O cartão de bolso funciona por NFC em iPhone XS+ e na maioria dos Androids compatíveis.",
              },
            },
            {
              "@type": "Question",
              name: "Preciso configurar algo?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Na loja própria, não: você informa o seu negócio durante a compra e nós gravamos o link antes de enviar. Na revenda, as placas chegam com o QR/NFC em branco e você ativa cada uma, com o link do seu cliente, em gcardpro.com.br/ativar.",
              },
            },
            {
              "@type": "Question",
              name: "Quanto custa o frete?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Frete grátis para todo o território nacional. Enviamos pelos Correios (PAC ou Sedex, conforme o prazo disponível).",
              },
            },
            {
              "@type": "Question",
              name: "Posso trocar o link da placa depois?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Sim, a qualquer momento. O QR Code e o NFC guardam um código, não o link, então não precisa reimprimir nada. Entre em gcardpro.com.br/ativar com o e-mail da compra, ache a placa pelo código dela e edite o link, ou chame a gente no WhatsApp.",
              },
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "GCard-PRÓ",
          url: "https://www.gcardpro.com.br/",
          legalName: COMPANY.legalName,
          taxID: COMPANY.cnpj,
          address: {
            "@type": "PostalAddress",
            streetAddress: COMPANY.street,
            addressLocality: COMPANY.city,
            addressRegion: COMPANY.state,
            addressCountry: "BR",
          },
          logo: "https://www.gcardpro.com.br/favicon-512.png",
          sameAs: ["https://instagram.com/gcardpro.oficial"],
        }),
      },
    ],
  }),
  component: Home,
});

const IMAGES: Record<string, string> = {
  "cartao-bolso": produtoCartao,
  "plaquinha-10x10": produtoPlaquinha10x10,
  "plaquinha-10x15-l": produtoPlaquinhaL,
  "acrilico-10x10-sem-arte": acrilico10x10Cristal,
  "acrilico-15x10-l-sem-arte": acrilicoLCristal,
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
    is_blank: false,
    price_delta_cents: 0,
    resale_delta_cents: 0,
    resale_tiers: [],
  },
  {
    id: "fallback-plaquinha",
    slug: "plaquinha-10x10",
    name: "Plaquinha GCard-PRÓ 10x10",
    format: "Acrílico 10 x 10 cm",
    status: "ativo",
    has_nfc: true,
    has_qr: true,
    is_blank: false,
    price_delta_cents: 2000,
    resale_delta_cents: 2000,
    resale_tiers: [],
  },
  {
    id: "fallback-acrilico-sem-arte",
    slug: "acrilico-10x10-sem-arte",
    name: "Acrílico 10x10 sem arte",
    format: "Acrílico 2mm 10 x 10 cm",
    status: "ativo",
    has_nfc: false,
    has_qr: false,
    is_blank: true,
    price_delta_cents: 0,
    resale_delta_cents: 0,
    // Última tabela real conhecida (migração 20260916160000) — só usada se o catálogo não carregar.
    resale_tiers: [
      { min_quantity: 10, unit_price_cents: 1050, label: "10 a 19 unidades" },
      { min_quantity: 20, unit_price_cents: 920, label: "20 a 49 unidades" },
      { min_quantity: 50, unit_price_cents: 850, label: "50 unidades ou mais" },
    ],
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
            Preços
          </a>
          <a
            href="#modelos"
            className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Modelos
          </a>
          <a
            href="#gerar-link"
            data-analytics-event="menu_gerar_link"
            className="hidden text-sm font-bold text-foreground transition-colors hover:text-primary sm:block"
          >
            Gerar link grátis
          </a>
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menu"
                className="flex size-10 items-center justify-center rounded-xl hover:bg-muted sm:hidden"
              >
                <Menu className="size-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1">
                {[
                  ["#gerar-link", "Gerar link grátis"],
                  ["#caminhos", "Preços"],
                  ["#modelos", "Modelos"],
                  ["#o-que-e", "Quem somos"],
                ].map(([href, label]) => (
                  <SheetClose asChild key={href}>
                    <a
                      href={href}
                      className="rounded-xl px-3 py-3 text-base font-semibold hover:bg-muted"
                    >
                      {label}
                    </a>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link
                    to="/comprar"
                    search={{}}
                    className="mt-3 rounded-2xl bg-primary px-4 py-3 text-center font-bold text-primary-foreground"
                  >
                    Comprar agora →
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
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

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const lojistaCatalog = data.plans.find((p) => p.slug === "lojista");
  const lojista = lojistaCatalog
    ? { ...lojistaCatalog, name: "Cartão Individual" }
    : {
        name: "Cartão Individual",
        audience: "Para usar no seu próprio balcão",
        unit_price_cents: 5990,
        tiers: [
          { min_quantity: 1, unit_price_cents: 5990, label: "1 a 4 unidades" },
          { min_quantity: 5, unit_price_cents: 4990, label: "5 unidades" },
        ],
      };
  const revendaCatalog = data.plans.find((p) => p.slug === "renda-extra");
  const revenda = revendaCatalog
    ? { ...revendaCatalog, name: "Kit para Revenda" }
    : {
        name: "Pack Renda Extra",
        audience: "Comprar em quantidade e revender",
        unit_price_cents: 3790,
        tiers: [
          { min_quantity: 10, unit_price_cents: 3790, label: "10 a 24 unidades" },
          { min_quantity: 25, unit_price_cents: 2790, label: "25 a 99 unidades" },
          { min_quantity: 100, unit_price_cents: 1990, label: "100 unidades ou mais" },
        ],
      };
  // Mostra todo produto não oculto (ativo ou em_breve); o card já trata "em_breve"
  // com o overlay "Em breve". Isso travava em só cartão-bolso antes.
  const catalogProducts = data.products.filter((product) => product.status !== "oculto");
  const products = catalogProducts.length > 0 ? catalogProducts : FALLBACK_PRODUCTS;

  // Preço de revenda POR PRODUTO — nunca misturar cartão com placa/acrílico num preço só,
  // cada um tem sua própria tabela real (plano + delta, ou faixa própria pro acrílico sem arte).
  const revendaLines = [
    { slug: "cartao-bolso", label: "Cartão de bolso", note: "PVC, só NFC" },
    { slug: "plaquinha-10x10", label: "Placa 10×10", note: "Acrílico, QR Code + NFC" },
    { slug: "acrilico-10x10-sem-arte", label: "Acrílico sem arte 10×10", note: "Só o material, sem QR/NFC" },
  ]
    .map((line) => {
      const product = products.find((p) => p.slug === line.slug);
      if (!product || product.status === "oculto") return null;
      const tiers = resolveTiersForProduct(revenda, product, true);
      return { ...line, tiers, comingSoon: product.status === "em_breve" };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null && l.tiers.length > 0);

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
            Somos <strong className="text-foreground/90">fornecedores</strong> de{" "}
            <strong className="text-foreground/90">cartão de bolso NFC (PVC)</strong> e{" "}
            <strong className="text-foreground/90">placa de acrílico 10×10 com QR Code e NFC</strong>,
            já com a arte “Avaliação do Google” pronta. O link é dinâmico: você troca quando quiser,
            sem reimprimir.
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

        {/* ===== HERO IMAGEM + VÍDEO ===== */}
        <div className="flex flex-col gap-9">
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
          <div className="absolute -bottom-5 left-2 animate-float shadow-2xl !animate-rise delay-6 sm:-left-8">
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
          <div className="absolute right-2 top-4 animate-bounce-subtle sm:-right-6 sm:top-14">
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
        <VideoTutorialCard />
        </div>
      </section>

      <ReviewLinkGenerator />

      {/* ===== DOIS CAMINHOS (sem preço aqui — só a decisão) ===== */}
      <section id="caminhos" className="relative border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="animate-rise text-xs font-black uppercase tracking-[0.2em] text-primary">
              Escolha seu objetivo
            </p>
            <h2 className="mt-3 animate-rise delay-1 text-3xl leading-tight sm:text-4xl md:text-5xl">
              É pra usar no seu negócio ou pra revender?
            </h2>
            <p className="mt-4 animate-rise delay-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Lojista paga um preço fixo por unidade. Revenda compra a partir de 10 unidades e o
              preço vai caindo com a quantidade. Frete grátis para todo o Brasil nos dois casos.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-7">
            {/* CAMINHO 1 — LOJISTA */}
            <div className="group relative animate-rise delay-2 rounded-[1.75rem] border-2 border-transparent bg-card p-7 sm:p-8 card-soft card-soft-hover shine-border">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.75rem] bg-primary/0 transition-all duration-500 group-hover:bg-primary" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary-foreground">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Loja própria
                  </div>
                  <h3 className="mt-4 text-2xl sm:text-3xl">Pra usar no meu negócio</h3>
                  <p className="mt-1 text-muted-foreground text-sm sm:text-base">
                    Cartão ou plaquinha, já configurados com a avaliação do seu Google
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

              <div className="mt-6 rounded-2xl border border-border bg-muted/70 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Preço por unidade · frete grátis
                </p>
                <p className="mt-1 font-display text-3xl leading-none">
                  {money(lojista.unit_price_cents)}
                  <span className="ml-2 text-sm font-sans font-semibold text-muted-foreground">
                    cartão de bolso
                  </span>
                </p>
                {(() => {
                  const plaquinha = products.find(
                    (p) => p.slug === "plaquinha-10x10" && p.status === "ativo",
                  );
                  return plaquinha ? (
                    <p className="mt-1 text-sm font-semibold">
                      {money(lojista.unit_price_cents + plaquinha.price_delta_cents)}
                      <span className="ml-2 font-normal text-muted-foreground">placa 10×10</span>
                    </p>
                  ) : null;
                })()}
                <p className="mt-2 text-xs text-muted-foreground">
                  Preço fixo, sem letras miúdas.
                  {lojista.tiers.length > 1
                    ? ` Pedindo ${lojista.tiers[lojista.tiers.length - 1]!.min_quantity} de uma vez, sai ${money(lojista.tiers[lojista.tiers.length - 1]!.unit_price_cents)} cada.`
                    : ""}
                </p>
              </div>

              <ul className="mt-5 space-y-3 text-sm sm:text-base">
                {[
                  "Você escolhe o modelo no próximo passo",
                  "Chega pronto, apontando pra avaliação do seu Google",
                  "Sem configuração nenhuma da sua parte",
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
                  Ver modelos e preços →
                </Link>
              </Button>
            </div>

            {/* CAMINHO 2 — REVENDA */}
            <div className="group relative animate-rise delay-3 rounded-[1.75rem] border-2 border-foreground/5 bg-card p-7 sm:p-8 card-soft card-soft-hover shine-border">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.75rem] bg-foreground/0 transition-all duration-500 group-hover:bg-foreground" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-foreground/90 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Revenda
                  </div>
                  <h3 className="mt-4 text-2xl sm:text-3xl">Pra revender</h3>
                  <p className="mt-1 text-muted-foreground text-sm sm:text-base">
                    Cartões e placas em lote, com a arte pronta e QR/NFC em branco pra você configurar
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

              <p className="mt-6 text-xs font-black uppercase tracking-wider text-muted-foreground">
                A partir de {revenda.tiers[0]?.min_quantity ?? 10} unidades · frete grátis · preço por produto
              </p>
              <div className="mt-2 space-y-3">
                {revendaLines.map((line) => (
                  <div key={line.slug} className="rounded-2xl border border-border bg-muted/70 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold">{line.label}</span>
                      <span className="text-xs text-muted-foreground">{line.note}</span>
                    </div>
                    {line.comingSoon ? (
                      <p className="mt-2 text-sm text-muted-foreground">Em breve</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm">
                        {line.tiers.map((t) => (
                          <li key={t.min_quantity} className="flex items-baseline justify-between gap-3">
                            <span className="text-muted-foreground">
                              {t.label ?? `${t.min_quantity}+ un.`}
                            </span>
                            <span className="font-display text-lg">{money(t.unit_price_cents)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              <ul className="mt-5 space-y-3 text-sm sm:text-base">
                {[
                  "Mínimo de 10 unidades por pedido, frete grátis",
                  "Preço cai conforme a quantidade — cada produto tem sua própria tabela",
                  "Acrílico sem arte disponível nas cores cristal, branco e preto",
                  "Você ativa cada código no seu painel de revendedor",
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
                  Ver preços de revenda →
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== O QUE SOMOS + O QUE É CADA PRODUTO ===== */}
      <section id="o-que-e" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-rise text-xs font-black uppercase tracking-[0.2em] text-primary">
            Quem somos
          </p>
          <h2 className="mt-3 animate-rise delay-1 text-3xl leading-tight sm:text-4xl md:text-5xl">
            Somos <span className="highlight-yellow">fornecedores</span> de cartões e placas de
            avaliação do Google.
          </h2>
          <p className="mt-4 animate-rise delay-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Você compra direto de quem fabrica: pra usar no seu balcão, ou em quantidade pra revender
            pros seus clientes. Sem mensalidade, sem intermediário.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              tag: "Cartão de bolso",
              title: "PVC · NFC por aproximação",
              specs: ["8,5 × 5,4 cm, em PVC", "Funciona só por aproximação NFC (sem QR Code)"],
              art: "Já vai com a arte “Avaliação do Google” pronta.",
              blank:
                "O chip NFC é de fábrica em branco: recebe o link de avaliação que você quiser.",
            },
            {
              tag: "Placa 10×10",
              title: "Acrílico puro · QR Code + NFC",
              specs: ["10 × 10 cm, em acrílico puro", "QR Code e NFC na mesma placa"],
              art: "Já vai com a arte “Avaliação do Google” pronta (adesivo retroverso, aplicado por trás do acrílico).",
              blank: "O QR Code e o NFC são de fábrica em branco: recebem o link que você quiser.",
            },
            {
              tag: "Acrílico sem arte",
              title: "Só o material, pra você personalizar",
              specs: [
                "Sem impressão, sem QR Code, sem NFC",
                "Cores: cristal (transparente), branco e preto",
              ],
              art: "Para quem já tem a própria arte ou quer aplicar adesivo.",
              blank: "Vendido em kit a partir de 10 unidades, com frete grátis (revenda).",
            },
          ].map((item, i) => (
            <div
              key={item.tag}
              className={`animate-rise delay-${i + 1} rounded-3xl border border-border bg-card p-7 card-soft card-soft-hover`}
            >
              <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary-foreground">
                {item.tag}
              </span>
              <h3 className="mt-4 text-xl leading-snug sm:text-2xl">{item.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-foreground/80 sm:text-base">
                {item.specs.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="font-medium">{s}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.art}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground/90">
                {item.blank}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== QR DINÂMICO ===== */}
      <section id="qr-dinamico" className="border-y border-border bg-secondary text-secondary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:items-center md:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              QR Code dinâmico
            </p>
            <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
              O link não fica gravado na placa. Dá pra trocar quando quiser.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
              O QR Code e o NFC guardam um código, não o endereço. Por isso o destino muda sem
              reimprimir nada.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-1">
            {[
              [
                "Um código por placa",
                "Cada placa e cada cartão tem o seu código (ex.: GCARD-00001), pra você saber qual é qual.",
              ],
              [
                "Ative e troque no seu painel",
                "Em gcardpro.com.br/ativar, com o e-mail da compra, você escolhe o link de cada placa e altera a qualquer momento.",
              ],
              [
                "Serve pra qualquer negócio",
                "Na revenda, cada placa vai pro cliente que você quiser. Na loja própria, já vai gravada com a avaliação do seu negócio.",
              ],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="font-bold">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== COMPRA SEGURA ===== */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Compra segura", "Pagamento processado pelo Mercado Pago (Pix, cartão e boleto)"],
            ["Sem precisar de conta", "Pague como convidado, sem criar conta no Mercado Pago"],
            ["Dados protegidos", "Conexão criptografada (HTTPS) e tratamento conforme a LGPD"],
            ["Suporte de verdade", "Atendimento direto pelo WhatsApp, com quem fabrica"],
            ["Empresa registrada", `${COMPANY.legalName} · CNPJ ${COMPANY.cnpj} · ${COMPANY_ADDRESS}`],
            ["7 dias para desistir", "Direito de arrependimento (CDC, art. 49) em todas as compras"],
          ].map(([t, d]) => (
            <li
              key={t}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 card-soft"
            >
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-g-green/15 text-g-green">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold">{t}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== MODELOS ===== */}
      <section id="modelos" className="relative border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="animate-rise text-xs font-black uppercase tracking-[0.2em] text-primary">
              Modelos disponíveis
            </p>
            <h2 className="mt-3 animate-rise delay-1 text-3xl leading-tight sm:text-4xl md:text-5xl">
              Pronto pra usar, ou acrílico puro pra sua arte.
            </h2>
            <p className="mt-4 animate-rise delay-2 text-base leading-relaxed text-muted-foreground">
              Duas linhas: a <strong className="text-foreground">com arte</strong>, que chega com a
              arte “Avaliação do Google” impressa e o QR/NFC prontos pra receber o seu link (na loja
              própria, já gravamos o do seu negócio). E o{" "}
              <strong className="text-foreground">acrílico sem impressão</strong>, pra quem já tem
              a própria arte e quer só o material cortado.
            </p>
          </div>

          <p className="mt-10 animate-rise text-xs font-black uppercase tracking-[0.18em] text-foreground/70">
            Com arte · chega configurado e funcionando
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 md:gap-7">
            {products
              .filter((p) => !p.is_blank)
              .map((product, i) => {
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
                      className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-105 ${
                        product.slug === "plaquinha-10x15-l" ? "blur-sm scale-110" : ""
                      }`}
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
                      {product.slug === "plaquinha-10x15-l" && "10 x 15 cm"}
                    </p>
                    {product.slug === "plaquinha-10x10" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Arte aplicada em adesivo retroverso (espelhado, colado por trás do acrílico).
                      </p>
                    )}

                    {isSoon ? (
                      <Button disabled size="sm" className="mt-4 w-full rounded-xl" variant="outline">
                        Em breve
                      </Button>
                    ) : (
                      <Button asChild size="sm" className="mt-4 w-full rounded-xl">
                        <Link to="/comprar" search={{}}>
                          Escolher {product.name.toLowerCase()}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== ACRÍLICO SEM ARTE ===== */}
          {products.some((p) => p.is_blank) && (
            <>
              <div className="mt-14 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-foreground/70">
                  Sem arte · acrílico puro pra você personalizar
                </p>
                <span className="badge-pill bg-g-green/15 text-foreground">
                  Revenda · frete grátis · kit a partir de 10 un.
                </span>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2 md:gap-7">
                {products
                  .filter((p) => p.is_blank)
                  .map((product) => (
                    <div
                      key={product.id}
                      className="group animate-rise overflow-hidden rounded-3xl border border-border bg-card card-soft card-soft-hover"
                    >
                      <div className="relative aspect-4/3 overflow-hidden bg-surface">
                        <img
                          src={IMAGES[product.slug] ?? produtoCartao}
                          alt={product.name}
                          className="h-full w-full object-contain p-6 transition-all duration-700 group-hover:scale-105"
                          loading="lazy"
                          draggable={false}
                        />
                      </div>
                      <div className="p-5 sm:p-6">
                        <h3 className="text-lg font-bold sm:text-xl">{product.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{product.format}</p>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          Sem impressão nenhuma. Disponível em{" "}
                          <strong className="text-foreground">cristal, branco e preto</strong> — você
                          aplica a sua arte ou adesivo.
                        </p>
                        <Button asChild size="sm" className="mt-4 w-full rounded-xl" variant="outline">
                          <Link to="/comprar" search={{ caminho: "revenda" }}>
                            Ver preços e cores (revenda)
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* ===== SOB MEDIDA + MERCADO LIVRE ===== */}
          <div className="mt-12">
            <div className="rounded-3xl border border-dashed border-foreground/20 bg-card p-6 sm:p-7">
              <h3 className="text-lg font-bold">Precisa de outra medida?</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Cortamos acrílico em outros tamanhos e formatos sob encomenda. Fala com a gente pelo
                WhatsApp (botão verde no canto inferior direito) que a gente monta seu orçamento.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Testimonials />

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
              Na loja própria, não: você informa o seu negócio durante a compra e nós gravamos o
              link antes de enviar. Na revenda, as placas chegam com o QR/NFC em branco e você
              ativa cada uma, com o link do seu cliente, em gcardpro.com.br/ativar.
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
              Sim, a qualquer momento. O QR Code e o NFC guardam um código, não o link, então não
              precisa reimprimir nada. Entre em{" "}
              <strong className="text-foreground">gcardpro.com.br/ativar</strong> com o e-mail da
              compra, ache a placa pelo código dela (ex.: GCARD-00001) e edite o link. Se preferir,
              é só chamar a gente no WhatsApp (botão verde na tela) ou no Instagram{" "}
              <a
                href="https://instagram.com/gcardpro.oficial"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-foreground underline underline-offset-2 hover:text-primary decoration-primary decoration-2"
              >
                @gcardpro.oficial
              </a>
              .
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
                Fornecedor de cartões NFC e placas QR Code/NFC que levam seus clientes direto à
                avaliação do Google.
              </p>
              <p className="mt-3 text-xs text-muted-foreground/70">
                © {new Date().getFullYear()} GCard-PRÓ
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground/80">
                {COMPANY.legalName} · CNPJ {COMPANY.cnpj}
                <br />
                {COMPANY_ADDRESS}
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
                  {WHATSAPP_CONTACTS.map((c) => (
                    <li key={c.number}>
                      <a
                        href={whatsappLink(c.number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                      >
                        WhatsApp {c.name} · {c.display}
                      </a>
                    </li>
                  ))}
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
                  <li>
                    <Link
                      to="/ativar"
                      className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                    >
                      Ativar meus códigos (revendedor)
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-xs font-semibold text-muted-foreground">
            {[
              "Compra segura pelo Mercado Pago",
              "Site protegido por HTTPS",
              "Seus dados protegidos (LGPD)",
              "7 dias para desistir (CDC)",
              `CNPJ ${COMPANY.cnpj}`,
              "Frete grátis para todo o Brasil",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-g-green"
                  aria-hidden
                >
                  <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
