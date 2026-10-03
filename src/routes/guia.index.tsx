import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const Route = createFileRoute("/guia/")({
  head: () => ({
    meta: [
      { title: "Guia de cartão NFC e cartão de visita digital | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Respostas práticas sobre cartão NFC, cartão de visita digital, QR Code e networking para empresas.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: "Guia de cartão NFC e cartão de visita digital" },
      {
        property: "og:description",
        content:
          "Entenda as diferenças, os usos e os critérios para escolher uma solução para sua empresa.",
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
            Conteúdo para empresas
          </p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
            Guia de cartão NFC, cartão digital e networking
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Conteúdo direto para ajudar sua empresa a entender como cartões físicos, perfis
            digitais, QR Code e métricas podem trabalhar juntos.
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
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <ArticleLink
            href="/guia/cartao-nfc-vs-cartao-digital"
            title="Cartão NFC ou cartão de visita digital?"
            text="Veja as diferenças, vantagens e quando combinar as duas soluções."
          />
          <ArticleLink
            href="/guia/melhor-cartao-digital-para-empresa"
            title="Como escolher para sua empresa"
            text="Critérios práticos: objetivo, perfil, equipe, métricas e custo."
          />
          <ArticleLink
            href="/guia/cartao-de-visita-por-aproximacao"
            title="Como funciona a aproximação"
            text="Entenda NFC, QR Code, compatibilidade e a experiência do cliente."
          />
        </div>
        <section className="mt-14 rounded-3xl border border-border bg-card p-7 sm:p-10">
          <h2 className="text-2xl font-bold">O que uma boa solução deve explicar</h2>
          <div className="mt-5 grid gap-5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
            <p>
              <strong className="text-foreground">Uso:</strong> o cliente precisa saber o que
              acontece ao aproximar o celular ou ler o QR Code.
            </p>
            <p>
              <strong className="text-foreground">Resultado:</strong> a empresa deve conseguir medir
              acessos, leads ou avaliações conforme seu objetivo.
            </p>
            <p>
              <strong className="text-foreground">Operação:</strong> equipes precisam de um processo
              simples para atualizar perfis e distribuir cartões.
            </p>
            <p>
              <strong className="text-foreground">Privacidade:</strong> coleta, consentimento e
              finalidade dos dados precisam ser claros.
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
