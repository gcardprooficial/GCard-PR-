import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { money } from "@/lib/pricing";
import { COMPANY } from "@/lib/company";
import { Testimonials } from "@/components/Testimonials";
import { DeliveryTimes, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MERCADO_LIVRE_LINKS, PRODUCT_IMAGES, catalogQuery, minKitPriceCents, plansFrom, productsFrom, resaleLines } from "@/lib/site-catalog";
import { PIX_DISCOUNT_PCT, PIX_DISCOUNT_UNTIL_LABEL, pixDiscountActive } from "@/lib/promo";
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
                text: "Depois do envio, 2 a 3 dias para Sul e Sudeste, cerca de 5 dias para o Centro-Oeste e 7 a 8 dias para Norte e Nordeste. Produzimos e despachamos de segunda a sexta.",
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

      {/* ===== PRODUTOS (uma vez só: escolhe, clica, cai na página do produto) ===== */}
      <section id="precos" className="scroll-mt-28 bg-surface/60 py-12 md:py-16">
        <div className="mx-auto max-w-5xl px-5">
          <div className="text-center">
            <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary-foreground">
              🔥 {pixDiscountActive() ? `${PIX_DISCOUNT_PCT}% OFF no Pix nas placas com arte até ${PIX_DISCOUNT_UNTIL_LABEL}` : "Kits para revendedores"}
            </span>
            <h2 className="mt-3 text-2xl leading-tight sm:text-3xl md:text-4xl">Escolha o seu kit</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Só kits, a partir de {minQty} unidades, com frete grátis. Quanto mais leva, menos paga por unidade.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
            {revendaLines.map((line) => {
              const best = line.tiers[line.tiers.length - 1];
              const first = line.tiers[0];
              return (
                <Link
                  key={line.slug}
                  to="/produtos/$slug"
                  params={{ slug: line.slug }}
                  className="group overflow-hidden rounded-2xl border border-border bg-card card-soft card-soft-hover"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-surface">
                    <img
                      src={PRODUCT_IMAGES[line.slug] ?? produtoCartao}
                      alt={line.label}
                      loading="lazy"
                      draggable={false}
                      className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="text-sm font-bold leading-snug sm:text-base">{line.label}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{line.note}</p>
                    {line.comingSoon || !best ? (
                      <p className="mt-2 text-xs font-semibold text-muted-foreground">Em breve</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        a partir de{" "}
                        <strong className="font-display text-base text-foreground sm:text-lg">{money(best.unit_price_cents)}</strong>
                        <span className="block text-[11px]">kit de {first?.min_quantity ?? minQty}+ un.</span>
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <DeliveryTimes className="mx-auto mt-8 max-w-md" />
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
            ["Receba em casa", "Frete grátis para todo o Brasil. Depois do envio: Sul e Sudeste em 2 a 3 dias, Centro-Oeste em cerca de 5, Norte e Nordeste em 7 a 8."],
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

      {/* ===== MERCADO LIVRE ===== */}
      <section id="mercado-livre" className="mx-auto max-w-7xl px-5 py-14 md:py-16">
        <div className="rounded-3xl border border-border bg-card p-7 card-soft md:p-10">
          <div className="max-w-2xl">
            <Eyebrow>Também no Mercado Livre</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">Prefere comprar pelo Mercado Livre?</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              A GCard-PRÓ também vende lá. Escolha o anúncio da placa e compre com a proteção do Mercado Livre. Os preços e as condições de lá são os do anúncio.
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MERCADO_LIVRE_LINKS.map((ml) => (
              <a
                key={ml.slug}
                href={ml.url}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event="click_marketplace"
                data-analytics-label={`mercado livre ${ml.slug}`}
                className="group flex items-center gap-3 rounded-2xl border-2 border-border bg-background p-3 transition-colors hover:border-primary"
              >
                <img src={PRODUCT_IMAGES[ml.slug] ?? produtoCartao} alt="" loading="lazy" draggable={false} className="size-16 shrink-0 rounded-xl bg-surface object-cover" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight">{ml.label}</span>
                  <span className="block text-xs text-muted-foreground">{ml.note}</span>
                  <span className="mt-1 block text-xs font-black text-primary-foreground/90 group-hover:underline">Ver no Mercado Livre →</span>
                </span>
              </a>
            ))}
          </div>
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
  ["Quanto tempo demora a entrega?", <>Depois do envio: <strong className="text-foreground">Sul e Sudeste, 2 a 3 dias</strong>; <strong className="text-foreground">Centro-Oeste, cerca de 5 dias</strong>; <strong className="text-foreground">Norte e Nordeste, 7 a 8 dias</strong>. Produzimos e despachamos de segunda a sexta.</>],
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
