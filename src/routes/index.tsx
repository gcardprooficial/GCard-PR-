import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { money } from "@/lib/pricing";
import { COMPANY } from "@/lib/company";
import { Testimonials } from "@/components/Testimonials";
import { DeliveryTimes, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Marquee, PhoneMockup } from "@/components/site/Marquee";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MOCKUPS, PRODUCT_IMAGES, catalogQuery, minKitPriceCents, plansFrom, productsFrom, resaleLines } from "@/lib/site-catalog";
import heroCartao from "@/assets/gcard-pro-hero-barbearia.jpeg";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "GCard-PRÓ | Kits de placas e cartões NFC para revenda",
      },
      {
        name: "description",
        content:
          "Kits de cartão NFC e placa com QR Code/NFC para avaliações no Google, só para revendedores: a partir de 10 unidades, preço cai com a quantidade e frete grátis. Gerador de link de avaliação grátis.",
      },
      {
        property: "og:title",
        content: "GCard-PRÓ | Kits de placas NFC para revender avaliações no Google",
      },
      {
        property: "og:description",
        content:
          "Fornecedor direto para revendedores: kits a partir de 10 unidades, frete grátis e zero mensalidade.",
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
                text: "As placas com QR Code e NFC chegam em branco e você ativa cada uma, com o link do seu cliente, em gcardpro.com.br/ativar. Os produtos só NFC (cartão, tags e placas de Instagram, Pix e WhatsApp) chegam com o chip vazio e você grava o link com o app NFC Tools.",
              },
            },
            {
              "@type": "Question",
              name: "Quanto tempo demora a entrega?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Depois do envio, 2 a 3 dias para Sul e Sudeste e 7 a 8 dias para Norte e Nordeste. Produzimos e despachamos de segunda a sexta.",
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

const CHECK = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`text-xs font-black uppercase tracking-[0.2em] ${dark ? "text-primary" : "text-primary-foreground/80"}`}>
      <span className="mr-2 inline-block h-[3px] w-6 -translate-y-0.5 rounded bg-primary align-middle" />
      {children}
    </p>
  );
}

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const { revenda } = plansFrom(data);
  const products = productsFrom(data);
  const revendaLines = resaleLines(revenda, products);
  const minQty = revenda.tiers[0]?.min_quantity ?? 10;
  const fromCents = minKitPriceCents(data);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-foreground text-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-24 size-[520px] rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-10 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:pb-20 md:pt-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-bold tracking-wide text-primary sm:text-sm">
              Fornecedor direto · Só para revendedores · A partir de 10 un.
            </div>
            <h1 className="mt-5 text-[2.4rem] leading-[1.05] tracking-tight sm:text-5xl md:text-[3.3rem]">
              Revenda placas NFC de avaliação do Google <span className="text-primary">direto do fornecedor</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Vendemos <strong className="text-white">só kits, a partir de {minQty} unidades</strong>, de{" "}
              <strong className="text-white">cartão de bolso NFC</strong> e{" "}
              <strong className="text-white">placa de acrílico 10×10 com QR Code e NFC</strong>, com a arte pronta. Você configura o link de cada cliente e troca quando quiser, sem reimprimir.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm font-semibold text-white/85 sm:text-base">
              {[`Kits a partir de ${minQty} unidades, o preço cai com a quantidade`, "Frete grátis para todo o Brasil", "Sem mensalidade: pague uma vez"].map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">{CHECK}</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="btn-press btn-primary-shadow h-14 rounded-xl px-7 text-base font-bold">
                <Link to="/comprar" search={{}}>Comprar meu kit →</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="btn-press h-14 rounded-xl border-white/30 bg-transparent px-7 text-base font-bold text-white hover:bg-white/10 hover:text-white">
                <Link to="/" hash="precos">Ver preços dos kits</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div aria-hidden className="absolute -inset-3 rounded-[2.25rem] bg-gradient-to-br from-primary/30 via-transparent to-transparent blur-xl" />
            <div className="relative -mx-5 overflow-hidden shadow-2xl md:mx-0 md:rounded-[2rem] md:border md:border-white/10">
              <img
                src={heroCartao}
                alt="Cartão GCard-PRÓ sendo aproximado do celular para abrir a avaliação no Google"
                className="aspect-[4/3] w-full object-cover md:aspect-auto md:h-[460px]"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                draggable={false}
              />
            </div>
            <div className="absolute bottom-3 left-3 rounded-2xl border border-border bg-card px-4 py-3 text-foreground shadow-2xl sm:-left-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cartão e placa NFC</p>
              <p className="font-display text-xl font-black leading-tight text-primary-foreground">Pronto para revender</p>
              <p className="text-xs font-semibold text-muted-foreground">você configura para cada cliente</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAIXA DE GARANTIAS ===== */}
      <section className="border-b border-border bg-card">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-5 px-5 py-6 md:grid-cols-4">
          {[
            ["Compra segura", "Stone ou InfinitePay · Pix e cartão"],
            ["Frete grátis", "Todo o Brasil pelos Correios"],
            ["Sem mensalidade", "Você paga uma vez, o cliente usa para sempre"],
            ["Suporte no WhatsApp", "Direto com quem fabrica"],
          ].map(([t, d]) => (
            <li key={t} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-foreground">{CHECK}</span>
              <span>
                <span className="block text-sm font-bold leading-tight">{t}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== PREÇOS DOS KITS ===== */}
      <section id="precos" className="scroll-mt-28 bg-surface/60 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-black uppercase tracking-wider text-primary-foreground">
              🔥 Promoção ativa
            </span>
            <h2 className="mt-4 text-3xl leading-tight sm:text-4xl md:text-5xl">
              Kits a partir de {money(fromCents)} a unidade. <span className="highlight-yellow">Quanto mais leva, menos paga.</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Vendemos só em kit, a partir de {minQty} unidades, com frete grátis para todo o Brasil. O preço por unidade cai a cada faixa de quantidade.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {revendaLines.map((line) => (
              <div key={line.slug} className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card card-soft">
                <div className="aspect-[4/3] overflow-hidden bg-surface">
                  <img
                    src={PRODUCT_IMAGES[line.slug] ?? produtoCartao}
                    alt={line.label}
                    loading="lazy"
                    draggable={false}
                    className={`h-full w-full ${line.slug.startsWith("acrilico") || line.slug === "tag-nfc-adesiva" ? "object-contain p-5" : "object-cover"}`}
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold leading-snug">{line.label}</h3>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{line.note}</p>
                  {line.comingSoon ? (
                    <p className="mt-4 text-sm text-muted-foreground">Em breve</p>
                  ) : (
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {line.tiers.map((tier) => (
                        <li key={tier.min_quantity} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5 last:border-0">
                          <span className="text-muted-foreground">{tier.label ?? `${tier.min_quantity}+ un.`}</span>
                          <span className="font-display text-xl">{money(tier.unit_price_cents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!line.comingSoon && (
                    <Button asChild className="btn-press btn-primary-shadow mt-5 h-12 w-full rounded-xl font-bold">
                      <Link to="/comprar" search={{ produto: line.slug }}>Comprar este kit →</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <DeliveryTimes />
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Como funciona a compra</p>
              <ul className="mt-3 space-y-2 text-sm">
                {[
                  `Mínimo de ${minQty} unidades por kit`,
                  "Frete grátis para todo o Brasil",
                  "Acrílico sem arte nas cores cristal, branco, preto e azul",
                  "Você ativa cada código no seu painel de revendedor",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-foreground/80">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/30">{CHECK}</span>
                    <span className="font-medium">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRODUTOS: CARROSSEL DE BALCÃO ===== */}
      <section id="produtos" className="bg-surface/60 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <Eyebrow>Nossos produtos</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl leading-tight sm:text-4xl md:text-5xl">
            Pronto pra revender, ou acrílico puro pra sua arte.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Duas linhas: a <strong className="text-foreground">com arte</strong>, que chega com a arte impressa e o QR/NFC prontos pra receber o link de cada cliente seu. E o{" "}
            <strong className="text-foreground">acrílico sem impressão</strong>, pra quem já tem a própria arte e quer só o material cortado.
          </p>
        </div>

        <Marquee className="mt-10">
          {MOCKUPS.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Placa GCard-PRÓ no balcão, foto ${i + 1}`}
              loading="lazy"
              draggable={false}
              className="h-36 w-auto rounded-xl object-cover shadow-md sm:h-44"
            />
          ))}
        </Marquee>

        <div className="mx-auto mt-10 grid max-w-7xl gap-5 px-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const soon = product.status !== "ativo";
            return (
              <Link
                key={product.id}
                to="/produtos/$slug"
                params={{ slug: product.slug }}
                className="group overflow-hidden rounded-3xl border border-border bg-card card-soft card-soft-hover"
              >
                <div className="relative aspect-square overflow-hidden bg-surface">
                  <img
                    src={PRODUCT_IMAGES[product.slug] ?? produtoCartao}
                    alt={product.name}
                    loading="lazy"
                    draggable={false}
                    className={`h-full w-full transition-transform duration-700 group-hover:scale-105 ${product.is_blank ? "object-contain p-6" : "object-cover"}`}
                  />
                  {soon && (
                    <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-black text-primary-foreground">Em breve</span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold">{product.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{product.format}</p>
                  <div className="mt-3 flex gap-2">
                    {product.has_nfc && <span className="rounded-lg bg-primary/20 px-2.5 py-1 text-[11px] font-black">NFC</span>}
                    {product.has_qr && <span className="rounded-lg bg-foreground/10 px-2.5 py-1 text-[11px] font-black">QR Code</span>}
                    {product.is_blank && <span className="rounded-lg bg-foreground/10 px-2.5 py-1 text-[11px] font-black">Sem arte</span>}
                  </div>
                  <span className="mt-4 inline-flex text-sm font-bold text-foreground group-hover:underline">Ver produto →</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Button asChild variant="outline" className="h-12 rounded-xl border-2 px-6 font-bold">
            <Link to="/produtos">Ver todos os produtos</Link>
          </Button>
        </div>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section id="como-funciona" className="mx-auto max-w-7xl px-5 py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 className="mt-3 text-3xl leading-tight sm:text-4xl md:text-5xl">
            O link não fica gravado na placa. Dá pra trocar quando quiser.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            O QR Code e o NFC guardam um código, não o endereço. Por isso o destino muda sem reimprimir nada.
          </p>
        </div>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Escolha o kit", `Cartão de bolso, placa 10×10 ou acrílico sem arte, a partir de ${minQty} unidades.`],
            ["Receba em casa", "Frete grátis para todo o Brasil. Sul e Sudeste em 2 a 3 dias, Norte e Nordeste em 7 a 8 dias depois do envio."],
            ["Configure para cada cliente", "Cada placa guarda um código. Você aponta para o link de avaliação do negócio do seu cliente."],
            ["Troque o link quando quiser", "Em gcardpro.com.br/ativar, com o e-mail da compra, você edita o link de cada placa sem reimprimir."],
          ].map(([t, d], i) => (
            <li key={t} className="relative rounded-3xl border border-border bg-card p-6 card-soft">
              <span className="font-display text-5xl font-black text-primary">{i + 1}</span>
              <h3 className="mt-3 text-lg font-bold leading-snug">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== SISTEMA / PAINEL ===== */}
      <section id="painel" className="bg-foreground text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <Eyebrow dark>Seu painel</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">Ative e troque no seu painel.</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70 sm:text-base">
              Cada placa e cada cartão tem o seu código (ex.: GCARD-00001), pra você saber qual é qual. Em gcardpro.com.br/ativar, com o e-mail da compra, você escolhe o link de cada placa e altera a qualquer momento.
            </p>
            <ul className="mt-6 space-y-3 text-sm font-semibold text-white/85">
              {["Um código por placa", "Serve pra qualquer negócio", "Acompanhe os toques e leituras"].map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">{CHECK}</span>
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="btn-press btn-primary-shadow mt-8 h-14 rounded-xl px-7 text-base font-bold">
              <Link to="/ativar">Acessar painel →</Link>
            </Button>
          </div>
          <PhoneMockup />
        </div>
      </section>

      {/* ===== GCARD PLUS (assinatura opcional) ===== */}
      <section id="plus" className="border-y border-border bg-primary/10">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-14 md:grid-cols-[1.2fr_0.8fr] md:py-20">
          <div>
            <Eyebrow>GCard Plus</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight sm:text-4xl md:text-5xl">Quer ir além da placa?</h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Com o Plus você cria QR Codes ilimitados com a sua marca, programa o destino por horário e data, acompanha as leituras num painel e manda relatório para o seu cliente. Opcional, para quem usa os códigos no dia a dia.
            </p>
            <ul className="mt-6 grid gap-2 text-sm font-semibold sm:grid-cols-2">
              {["QR dinâmico: troque o link sem reimprimir", "Destino por horário, dia e data", "Estatísticas por código e relatório em PDF", "Sua placa nunca para, mesmo se cancelar"].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">{CHECK}</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="btn-press btn-primary-shadow h-14 rounded-xl px-7 text-base font-bold">
                <Link to="/plus">Conhecer o GCard Plus →</Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                a partir de <strong className="text-foreground">R$ 15,90/mês</strong> no plano anual
              </p>
            </div>
          </div>
          <div className="rounded-3xl bg-secondary p-6 text-secondary-foreground shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Plus</p>
            <p className="mt-2 font-display text-5xl font-black">R$ 19,90<span className="text-base font-semibold text-white/60">/mês</span></p>
            <p className="mt-1 text-sm text-white/70">ou R$ 190,80 por ano. Cancele quando quiser.</p>
            <p className="mt-4 rounded-2xl bg-white/10 p-3 text-xs leading-relaxed text-white/85">
              <strong>Sua placa nunca para.</strong> Placas e ativação são grátis para sempre.
            </p>
          </div>
        </div>
      </section>

      {/* ===== O QUE É CADA PRODUTO ===== */}
      <section id="o-que-e" className="mx-auto max-w-7xl px-5 py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Quem somos</Eyebrow>
          <h2 className="mt-3 text-3xl leading-tight sm:text-4xl md:text-5xl">
            Somos <span className="highlight-yellow">fornecedores</span> de cartões e placas de avaliação do Google.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Você compra direto de quem fabrica, em kit, pra revender pros seus clientes. Sem mensalidade, sem intermediário.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              tag: "Cartão de bolso",
              title: "PVC · NFC por aproximação",
              specs: ["8,5 × 5,4 cm, em PVC", "Funciona só por aproximação NFC (sem QR Code)"],
              art: "Já vai com a arte “Avaliação do Google” pronta.",
              blank: "O chip NFC é de fábrica em branco: recebe o link de avaliação que você quiser.",
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
              specs: ["Sem impressão, sem QR Code, sem NFC", "Cores: cristal (transparente), branco, preto e azul"],
              art: "Para quem já tem a própria arte ou quer aplicar adesivo.",
              blank: "Vendido em kit a partir de 10 unidades, com frete grátis.",
            },
          ].map((item) => (
            <div key={item.tag} className="rounded-3xl border border-border bg-card p-7 card-soft">
              <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider">{item.tag}</span>
              <h3 className="mt-4 text-xl leading-snug">{item.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-foreground/80">
                {item.specs.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="font-medium">{s}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.art}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground/90">{item.blank}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-3xl border border-dashed border-foreground/20 bg-card p-6">
          <h3 className="text-lg font-bold">Precisa de outra medida?</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Cortamos acrílico em outros tamanhos e formatos sob encomenda. Fala com a gente pelo WhatsApp (botão verde no canto inferior direito) que a gente monta seu orçamento.
          </p>
        </div>
      </section>

      <section id="gerar-link" className="mx-auto max-w-4xl scroll-mt-20 px-5 py-14 text-center md:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ferramenta grátis</p>
        <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">Gerar link de avaliação do Google</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Ache o seu negócio no Google e pegue o link de avaliação. É grátis: basta entrar ou criar a sua conta.
        </p>
        <Button asChild size="lg" className="mt-6 rounded-2xl font-bold">
          <Link to="/gerador">Gerar meu link grátis</Link>
        </Button>
      </section>

      <Testimonials />

      {/* ===== FAQ ===== */}
      <section id="duvidas" className="mx-auto max-w-3xl px-5 py-14 md:py-20">
        <div className="text-center">
          <Eyebrow>Dúvidas rápidas</Eyebrow>
          <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
            Respostas sem <span className="highlight-yellow">enrolação</span>.
          </h2>
        </div>
        <Accordion
          type="single"
          collapsible
          className="mt-10 space-y-3 *:!rounded-2xl *:overflow-hidden *:border *:border-border *:bg-card *:shadow-sm *:!mt-0 *:border-b *:data-[state=open]:border-foreground/20"
        >
          {FAQ.map(([q, a], i) => (
            <AccordionItem key={q} value={String(i)}>
              <AccordionTrigger className="!px-5 !py-5 text-base font-bold hover:no-underline sm:!px-6 sm:text-lg">{q}</AccordionTrigger>
              <AccordionContent className="!px-5 !pb-5 text-sm leading-relaxed text-muted-foreground sm:!px-6 sm:text-base">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ===== CONTATO ===== */}
      <section id="contato" className="bg-foreground text-white">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-5 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">⭐ Comece hoje mesmo</span>
            <h2 className="mt-4 text-3xl leading-[1.1] sm:text-4xl md:text-5xl">
              Pronto para revender <span className="text-primary">5 estrelas</span>?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
              Entre no grupo de lançamento: condição especial para os primeiros, novidades dos novos formatos e uma comunidade de revendedores crescendo juntos.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="btn-press btn-primary-shadow h-14 rounded-xl text-base font-bold">
              <Link to="/comprar" search={{}} data-analytics-event="begin_checkout" data-analytics-label="cta final">Comprar meu kit →</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="btn-press h-14 rounded-xl border-white/30 bg-transparent text-base font-bold text-white hover:bg-white/10 hover:text-white">
              <a href="https://chat.whatsapp.com/EBYX68zzqOICn9mIlqHwQ5" data-analytics-event="generate_lead" data-analytics-label="whatsapp comunidade" target="_blank" rel="noopener noreferrer">
                Entrar no grupo do WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

const FAQ: [string, React.ReactNode][] = [
  ["Tem mensalidade?", <>A placa e o cartão <strong className="text-foreground">não têm mensalidade</strong>: você paga uma vez e usa para sempre, inclusive trocar o link. Existe o <Link to="/plus" className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4">GCard Plus</Link>, uma assinatura <strong className="text-foreground">opcional</strong> com QR dinâmico ilimitado, estatísticas e relatórios. Se você não assinar ou cancelar, nada para de funcionar.</>],
  ["Funciona em qualquer celular?", "O cartão de bolso funciona por NFC em iPhone XS+ e na maioria dos Androids compatíveis."],
  ["Preciso configurar algo?", "As placas com QR Code e NFC chegam em branco e você ativa cada uma, com o link do seu cliente, em gcardpro.com.br/ativar. Os produtos só NFC (cartão, tags e placas de Instagram, Pix e WhatsApp) chegam com o chip vazio e você grava o link com o app NFC Tools."],
  ["Quanto tempo demora a entrega?", <>Depois do envio: <strong className="text-foreground">Sul e Sudeste, 2 a 3 dias</strong>; <strong className="text-foreground">Norte e Nordeste, 7 a 8 dias</strong>. Produzimos e despachamos de segunda a sexta.</>],
  ["Vocês vendem uma unidade só?", "Não. A GCard-PRÓ vende apenas kits para revendedores, a partir de 10 unidades."],
  ["Quanto custa o frete?", <>Frete <strong className="text-foreground">grátis</strong> para todo o território nacional. Enviamos pelos Correios (PAC ou Sedex, conforme o prazo disponível).</>],
  [
    "Posso trocar o link da placa depois?",
    <>
      Sim, a qualquer momento. O QR Code e o NFC guardam um código, não o link, então não precisa reimprimir nada. Entre em <strong className="text-foreground">gcardpro.com.br/ativar</strong> com o e-mail da compra, ache a placa pelo código dela (ex.: GCARD-00001) e edite o link. Se preferir, é só chamar a gente no WhatsApp (botão verde na tela) ou no Instagram{" "}
      <a href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer" className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">@gcardpro.oficial</a>.
    </>,
  ],
];
