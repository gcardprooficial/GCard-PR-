import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { money } from "@/lib/pricing";
import { COMPANY } from "@/lib/company";
import { Testimonials } from "@/components/Testimonials";
import { DeliveryTimes, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { MERCADO_LIVRE_LINKS, PRODUCT_IMAGES, SHOW_MERCADO_LIVRE, catalogQuery, minKitPriceCents, plansFrom, productsFrom, resaleLines } from "@/lib/site-catalog";
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

const MARQUEE = ["Barbearias", "Clínicas", "Dentistas", "Restaurantes", "Salões", "Pet shops", "Academias", "Oficinas", "Hotéis e pousadas", "Lojas", "Estúdios", "Consultórios"];

/** Palavras que entram uma a uma no título, como no protótipo. */
const Words = ({ text, from = 0 }: { text: string; from?: number }) => (
  <>
    {text.split(" ").map((w, i) => (
      <span key={i}>
        {i > 0 && " "}
        <span className="lp-w" style={{ ["--i" as string]: from + i }}>{w}</span>
      </span>
    ))}
  </>
);

type HomeViewProps = {
  minQty: number;
  lines: { slug: string; label: string; note: string; image: string; fromCents: number | null; minQty: number; comingSoon: boolean }[];
  heroImage: string;
  pixLabel: string | null;
};

/** Parte visual da página inicial (sem dados do banco, para poder testar a aparência com dados de exemplo). */
export function HomeView({ minQty, lines, heroImage, pixLabel }: HomeViewProps) {
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    const els = document.querySelectorAll(".lp .rv");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    els.forEach((el) => io.observe(el));
    const bar = document.querySelector<HTMLElement>(".lp-progress");
    const on = () => { const h = document.documentElement.scrollHeight - innerHeight; if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", on); };
  }, []);

  const move = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", String((e.clientX - r.left) / r.width - 0.5));
    e.currentTarget.style.setProperty("--my", String((e.clientY - r.top) / r.height - 0.5));
    e.currentTarget.style.setProperty("--gx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };
  const leave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.setProperty("--mx", "0"); e.currentTarget.style.setProperty("--my", "0"); };
  const shots = lines.filter((l) => l.image).slice(0, 2);

  return (
    <div className="v2">
      <div className="lp">
        <div className="lp-progress" aria-hidden="true" />
        <div className="lp-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>

        <SiteHeader />

        <main className="lp-col">
          <section className="lp-hero" onMouseMove={move} onMouseLeave={leave}>
            <div className="lp-herogrid">
              <div className="rv">
                <div className="badge green" style={{ marginBottom: 12 }}>Fornecedor direto · Só para revendedores · A partir de {minQty} un.</div>
                <h1 className="lp-h1">
                  <Words text="Revenda placas NFC de avaliação do Google" />{" "}
                  <span className="accent lp-w" style={{ ["--i" as string]: 7 }}>direto do fornecedor</span>.
                </h1>
                <p className="lp-lead">
                  Vendemos <b>só kits, a partir de {minQty} unidades</b>, de cartão de bolso NFC e placa de acrílico 10×10 com QR Code e NFC, com a arte pronta. Você configura o link de cada cliente e troca quando quiser, sem reimprimir.
                </p>
                <div className="row wrap" style={{ gap: 8, marginTop: 20 }}>
                  <Link to="/produtos" className="btn primary" data-analytics-event="begin_checkout" data-analytics-label="hero">Comprar meu kit <ArrowRight size={16} /></Link>
                  <Link to="/" hash="precos" className="btn">Ver preços dos kits</Link>
                </div>
                <p className="xs muted" style={{ marginTop: 12 }}>A partir de {minQty} unidades · Frete grátis · Pix, cartão e boleto · Produção de segunda a sexta</p>
              </div>
              <div className="gl-shots rv" style={{ transitionDelay: ".12s" }} aria-hidden="true">
                <img className="gl-main" src={heroImage} alt="" fetchPriority="high" decoding="async" />
                {shots[0] && <img className="gl-s1" src={shots[0].image} alt="" />}
                {shots[1] && <img className="gl-s2" src={shots[1].image} alt="" />}
              </div>
            </div>
          </section>

          <div className="lp-marquee" aria-hidden="true"><div className="lp-track">{[...MARQUEE, ...MARQUEE].map((t, i) => <span key={i}>{t}</span>)}</div></div>

          <section id="como-funciona" className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Como funciona</div><h2 className="lp-h2">O link não fica gravado na placa. Dá para trocar quando quiser.</h2><p className="lp-sub">O QR Code e o NFC guardam um código, não o endereço. Por isso o destino muda sem reimprimir nada.</p></div>
            <div className="lp-steps rv">
              {[
                ["1", "Escolha o kit", `Cartão de bolso, placa 10×10 ou acrílico sem arte, a partir de ${minQty} unidades.`],
                ["2", "Receba em casa", "Frete grátis para todo o Brasil. Depois do envio: Sul e Sudeste em 2 a 3 dias, Centro-Oeste em cerca de 5, Norte e Nordeste em 7 a 8."],
                ["3", "Configure para cada cliente", "Cada placa guarda um código. Você aponta para o link de avaliação do negócio do seu cliente."],
                ["4", "Troque o link quando quiser", "Em gcardpro.com.br/ativar, com o e-mail da compra, você edita o link de cada placa sem reimprimir."],
              ].map(([n, t, d]) => (
                <div key={n} className="lp-stepitem"><span className="lp-num">{n}</span><b>{t}</b><p className="sm muted">{d}</p></div>
              ))}
            </div>
          </section>

          <section id="precos" className="lp-sec">
            <div className="lp-head2 rv">
              <div className="lp-label">{pixLabel ?? "Kits para revendedores"}</div>
              <h2 className="lp-h2">Escolha o seu kit.</h2>
              <p className="lp-sub">Só kits, a partir de {minQty} unidades, com frete grátis para todo o Brasil e sem mensalidade. Quanto mais leva, menos paga por unidade.</p>
            </div>
            <div className="gl-grid rv">
              {lines.map((l) => (
                <Link key={l.slug} to="/produtos/$slug" params={{ slug: l.slug }} className="gl-card" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="gl-cardimg"><img src={l.image} alt={l.label} loading="lazy" draggable={false} /></div>
                  <div className="col" style={{ gap: 3, padding: "12px 14px 16px", textAlign: "left" }}>
                    <b>{l.label}</b>
                    <span className="xs muted">{l.note}</span>
                    {l.comingSoon || l.fromCents === null ? (
                      <span className="sm muted">Em breve</span>
                    ) : (
                      <span className="sm" style={{ color: "var(--brand-text)", fontWeight: 600 }}>a partir de {money(l.fromCents)} <span className="muted xs" style={{ fontWeight: 400 }}>por unidade · kit de {l.minQty}+ un.</span></span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <div className="rv" style={{ margin: "16px auto 0", maxWidth: 460 }}><DeliveryTimes /></div>
          </section>

          <section id="plus" className="lp-sec">
            <div className="gl-plus rv">
              <div>
                <div className="row" style={{ gap: 8 }}><div className="lp-label" style={{ margin: 0 }}>GCard <span className="goldtext">Plus</span></div><span className="plustag">Opção paga</span></div>
                <h2 className="lp-h2" style={{ marginTop: 8 }}>Quer ir além da placa?</h2>
                <p className="lp-sub">Com o Plus você cria QR Codes ilimitados com a sua marca, programa o destino por horário e data, acompanha as leituras num painel e manda relatório para o seu cliente. Opcional.</p>
                <div className="row wrap" style={{ gap: 10, marginTop: 14 }}>
                  <Link to="/plus" className="btn goldbtn">Conhecer o GCard Plus <ArrowRight size={16} /></Link>
                  <span className="sm muted">a partir de <b>R$ 15,90/mês</b> no plano anual</span>
                </div>
              </div>
              <div className="lp-rows">
                {[["QR dinâmico: troque o link sem reimprimir", "Sem reimprimir a placa."], ["Destino por horário, dia e data", "Muda sozinho conforme a hora."], ["Estatísticas por código e relatório em PDF", "NFC e QR separados."], ["Sua placa nunca para, mesmo se cancelar", "Placas e ativação são grátis para sempre."]].map(([t, d]) => (
                  <div key={t} className="lp-row"><b>{t}</b><span className="muted">{d}</span></div>
                ))}
              </div>
            </div>
          </section>

          {SHOW_MERCADO_LIVRE && (
            <section id="mercado-livre" className="lp-sec">
              <div className="lp-head2 rv"><div className="lp-label">Também no Mercado Livre</div><h2 className="lp-h2">Prefere comprar pelo Mercado Livre?</h2><p className="lp-sub">A GCard-PRÓ também vende lá, com a proteção do Mercado Livre. Os preços e as condições de lá são os do anúncio.</p></div>
              <div className="gl-grid rv">
                {MERCADO_LIVRE_LINKS.map((ml) => (
                  <a key={ml.slug} href={ml.url} target="_blank" rel="noopener noreferrer" data-analytics-event="click_marketplace" data-analytics-label={`mercado livre ${ml.slug}`} className="gl-card" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="gl-cardimg"><img src={PRODUCT_IMAGES[ml.slug] ?? produtoCartao} alt="" loading="lazy" draggable={false} /></div>
                    <div className="col" style={{ gap: 3, padding: "12px 14px 16px" }}>
                      <b>{ml.label}</b><span className="xs muted">{ml.note}</span>
                      <span className="sm" style={{ color: "var(--brand-text)", fontWeight: 600 }}>Ver no Mercado Livre →</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section id="gerar-link" className="lp-sec">
            <div className="card col rv" style={{ gap: 8, alignItems: "center", textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
              <div className="lp-label" style={{ margin: 0 }}>Ferramenta grátis</div>
              <h2 className="lp-h2" style={{ fontSize: 26 }}>Gerar link de avaliação do Google</h2>
              <p className="sm muted">Ache o seu negócio no Google e pegue o link de avaliação. É grátis: basta entrar ou criar a sua conta.</p>
              <Link to="/gerador" className="btn primary">Gerar meu link grátis</Link>
            </div>
          </section>

          <Testimonials />

          <section id="duvidas" className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Dúvidas rápidas</div><h2 className="lp-h2">Respostas sem enrolação.</h2></div>
            <div className="lp-faq rv">
              {FAQ.map(([q, a], i) => (
                <div key={q} className="lp-qa">
                  <button type="button" className="lp-q" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                    <b>{q}</b>
                    <ChevronDown size={17} style={{ transform: open === i ? "rotate(180deg)" : undefined, transition: "transform .2s", flex: "none" }} />
                  </button>
                  {open === i && <div className="sm muted" style={{ padding: "0 0 16px" }}>{a}</div>}
                </div>
              ))}
            </div>
          </section>

          <section id="contato" className="lp-sec lp-final">
            <div className="center rv">
              <h2 className="lp-h2">Pronto para revender 5 estrelas?</h2>
              <p className="lp-sub" style={{ margin: "10px auto 0" }}>Entre no Grupo de Network, gratuito: converse com outras pessoas sobre plaquinhas, bio sites e outros negócios, e fique por dentro das novidades.</p>
              <div className="row wrap" style={{ gap: 8, justifyContent: "center", marginTop: 16 }}>
                <Link to="/produtos" className="btn primary" data-analytics-event="begin_checkout" data-analytics-label="cta final">Comprar meu kit <ArrowRight size={16} /></Link>
                <a href="https://discord.gg/CnxUbdgbNG" data-analytics-event="generate_lead" data-analytics-label="grupo network" target="_blank" rel="noopener noreferrer" className="btn">Entrar no Grupo de Network</a>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const { revenda } = plansFrom(data);
  const products = productsFrom(data);
  const revendaLines = resaleLines(revenda, products);
  const minQty = revenda.tiers[0]?.min_quantity ?? 10;
  const lines = revendaLines.map((line) => {
    const best = line.tiers[line.tiers.length - 1];
    const first = line.tiers[0];
    return {
      slug: line.slug,
      label: line.label,
      note: line.note,
      image: PRODUCT_IMAGES[line.slug] ?? produtoCartao,
      fromCents: line.comingSoon || !best ? null : best.unit_price_cents,
      minQty: first?.min_quantity ?? minQty,
      comingSoon: Boolean(line.comingSoon),
    };
  });
  return (
    <HomeView
      minQty={minQty}
      lines={lines}
      heroImage={heroCartao}
      pixLabel={pixDiscountActive() ? `${PIX_DISCOUNT_PCT}% OFF no Pix nas placas com arte até ${PIX_DISCOUNT_UNTIL_LABEL}` : null}
    />
  );
}

const FAQ: [string, React.ReactNode][] = [
  ["Tem mensalidade?", <>A placa e o cartão <strong>não têm mensalidade</strong>: você paga uma vez e usa para sempre, inclusive trocar o link. Existe o <Link to="/plus" className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4">GCard Plus</Link>, uma assinatura <strong>opcional</strong> com QR dinâmico ilimitado, estatísticas e relatórios. Se você não assinar ou cancelar, nada para de funcionar.</>],
  ["Funciona em qualquer celular?", "O cartão de bolso funciona por NFC em iPhone XS+ e na maioria dos Androids compatíveis."],
  ["Preciso configurar algo?", "As placas com QR Code e NFC chegam em branco e você ativa cada uma, com o link do seu cliente, em gcardpro.com.br/ativar. Os produtos só NFC (cartão, tags e placas de Instagram, Pix e WhatsApp) chegam com o chip vazio e você grava o link com o app NFC Tools."],
  ["Quanto tempo demora a entrega?", <>Depois do envio: <strong>Sul e Sudeste, 2 a 3 dias</strong>; <strong>Centro-Oeste, cerca de 5 dias</strong>; <strong>Norte e Nordeste, 7 a 8 dias</strong>. Produzimos e despachamos de segunda a sexta.</>],
  ["Vocês vendem uma unidade só?", "Não. A GCard-PRÓ vende apenas kits para revendedores, a partir de 10 unidades."],
  ["Quanto custa o frete?", <>Frete <strong>grátis</strong> para todo o território nacional. Enviamos pelos Correios (PAC ou Sedex, conforme o prazo disponível).</>],
  [
    "Posso trocar o link da placa depois?",
    <>
      Sim, a qualquer momento. O QR Code e o NFC guardam um código, não o link, então não precisa reimprimir nada. Entre em <strong>gcardpro.com.br/ativar</strong> com o e-mail da compra, ache a placa pelo código dela (ex.: GCARD-00001) e edite o link. Se preferir, é só chamar a gente no WhatsApp (botão verde na tela) ou no Instagram{" "}
      <a href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer" className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">@gcardpro.oficial</a>.
    </>,
  ],
];
