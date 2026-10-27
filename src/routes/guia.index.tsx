import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const Route = createFileRoute("/guia/")({
  head: () => ({
    meta: [
      { title: "Guia para revendedores de placas e cartões NFC | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Guias práticos para quem revende placas e cartões NFC de avaliação do Google: como funciona o NFC, o que oferecer a cada cliente e como configurar.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: "Guia para revendedores de placas e cartões NFC" },
      {
        property: "og:description",
        content:
          "Como funciona o NFC, o que oferecer a cada cliente e como configurar cada placa.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://www.gcardpro.com.br/guia" }],
  }),
  component: Guide,
});

function Guide() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "GCard-PRÓ",
            url: "https://www.gcardpro.com.br",
            logo: "https://www.gcardpro.com.br/favicon-512.png",
            sameAs: ["https://instagram.com/gcardpro.oficial"],
          }),
        }}
      />
      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
        <section className="mt-4 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Conteúdo para revendedores
          </p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
            Guia para revendedores de placas e cartões NFC
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Tudo o que você precisa para vender, configurar e dar suporte às placas e cartões de
            avaliação do Google.
          </p>
        </section>
        <Link
          to="/guia/como-configurar-placa-gcard"
          className="group mt-12 flex flex-col gap-2 rounded-3xl border-2 border-primary bg-card p-6 transition hover:-translate-y-1 sm:p-8"
        >
          <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Tutorial em vídeo</span>
          <h2 className="text-2xl font-bold group-hover:text-primary">Como configurar e ativar sua placa ou cartão GCard-PRÓ</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Vídeo e passo a passo: entrar no painel, ativar o código, colar o link de avaliação do Google e trocar quando quiser.</p>
          <span className="mt-2 text-sm font-bold text-primary">Assistir e ler →</span>
        </Link>
        <Link
          to="/personalizar"
          className="group mt-5 flex flex-col gap-2 rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-1 sm:p-8"
        >
          <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Passo a passo</span>
          <h2 className="text-xl font-bold group-hover:text-primary">Como personalizar a sua placa</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Compre o acrílico com NFC, baixe o QR do código, coloque na sua arte e teste antes de imprimir.</p>
        </Link>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <ArticleLink
            href="/guia/cartao-nfc-vs-cartao-digital"
            title="NFC, QR Code ou os dois?"
            text="Qual produto oferecer a cada tipo de cliente."
          />
          <ArticleLink
            href="/guia/melhor-cartao-digital-para-empresa"
            title="Como revender placas de avaliação"
            text="Para quem vender, como configurar e quais cuidados ter."
          />
          <ArticleLink
            href="/guia/cartao-de-visita-por-aproximacao"
            title="Como funciona o NFC"
            text="Alcance, compatibilidade e como explicar ao seu cliente."
          />
        </div>
        <section className="mt-14 rounded-3xl border border-border bg-card p-7 sm:p-10">
          <h2 className="text-2xl font-bold">O que explicar ao seu cliente</h2>
          <div className="mt-5 grid gap-5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
            <p>
              <strong className="text-foreground">Uso:</strong> o cliente final aproxima o celular ou
              escaneia o QR Code e cai na tela de avaliar o negócio.
            </p>
            <p>
              <strong className="text-foreground">Resultado:</strong> a placa facilita a avaliação, mas
              não garante mais avaliações nem mais vendas.
            </p>
            <p>
              <strong className="text-foreground">Operação:</strong> você ativa cada placa no painel e
              troca o link quando o cliente precisar.
            </p>
            <p>
              <strong className="text-foreground">Limites:</strong> o NFC precisa de celular
              compatível e ligado, por isso o QR Code fica junto.
            </p>
          </div>
        </section>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ArticleLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      to={href}
      className="group rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/50"
    >
      <h2 className="text-xl font-bold group-hover:text-primary">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
      <span className="mt-5 inline-block text-sm font-bold text-primary">Ler artigo →</span>
    </Link>
  );
}
