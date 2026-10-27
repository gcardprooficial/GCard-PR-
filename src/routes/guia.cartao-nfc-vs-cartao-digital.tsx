import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

// Mantém o endereço (/guia/cartao-nfc-vs-cartao-digital) para não perder links nem SEO; o conteúdo agora fala com o revendedor.
const questions = [
  {
    question: "Qual é melhor para o meu cliente: NFC ou QR Code?",
    answer:
      "Os dois levam ao mesmo destino. O NFC é mais rápido para quem tem o recurso; o QR Code funciona em qualquer celular com câmera. Por isso a placa com os dois é a escolha mais segura para quem atende o público em geral.",
  },
  {
    question: "Quando faz sentido oferecer o cartão de bolso?",
    answer:
      "Quando o cliente quer entregar o item na mão, no caixa ou junto da nota. O cartão da GCard-PRÓ é só NFC, sem QR Code, então o cliente final precisa de um celular com NFC.",
  },
  {
    question: "O que são as placas de Instagram, Pix e WhatsApp?",
    answer:
      "Placas de acrílico 10x10 com a arte pronta e chip NFC. O cliente aproxima o celular e abre o perfil, o pagamento ou a conversa. O chip chega vazio e você grava o link do seu cliente com o app NFC Tools.",
  },
  {
    question: "Posso gravar o NFC e esquecer o QR Code?",
    answer:
      "Pode, mas você perde quem não tem NFC. Em negócios que atendem muita gente, mantenha o QR Code visível junto do NFC.",
  },
] as const;

export const Route = createFileRoute("/guia/cartao-nfc-vs-cartao-digital")({
  head: () => ({
    meta: [
      { title: "NFC, QR Code ou os dois: o que oferecer a cada cliente | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Compare placa com QR Code e NFC, cartão de bolso NFC, tag adesiva e placas de Instagram, Pix e WhatsApp, e saiba qual oferecer a cada tipo de cliente.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: "NFC, QR Code ou os dois: o que oferecer a cada cliente" },
      {
        property: "og:description",
        content: "Guia rápido para o revendedor escolher o produto certo para cada cliente.",
      },
      { property: "og:type", content: "article" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://www.gcardpro.com.br/guia/cartao-nfc-vs-cartao-digital",
      },
    ],
  }),
  component: Article,
});

function Article() {
  return (
    <Page>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: questions.map(({ question, answer }) => ({
              "@type": "Question",
              name: question,
              acceptedAnswer: { "@type": "Answer", text: answer },
            })),
          }),
        }}
      />
      <article>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Guia para revendedores</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">NFC, QR Code ou os dois: o que oferecer a cada cliente</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          NFC e QR Code são duas portas de entrada para o mesmo destino. O NFC é um toque; o QR Code é uma foto com a câmera. Saber quando usar cada um evita devolução e ajuda você a vender o produto certo na primeira conversa.
        </p>

        <h2 className="mt-12 text-2xl font-bold">A diferença em uma frase</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          NFC é mais rápido, mas exige um celular compatível com o recurso ligado. O QR Code funciona em qualquer celular com câmera, mas pede um passo a mais. A placa com os dois cobre todo mundo.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Qual produto para qual cliente</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["Placa Avaliação do Google 10×10", "QR Code + NFC. Para balcão e caixa de qualquer negócio que atenda o público em geral."],
            ["Placa em L 10×15", "QR Code + NFC em formato de mesa. Para restaurantes, bares e cafeterias."],
            ["Cartão de bolso (PVC)", "Só NFC. Para entregar na mão ou deixar junto da nota. O cliente final precisa de celular com NFC."],
            ["Placas de Instagram, Pix e WhatsApp", "Só NFC, com arte pronta. Para quem quer levar o cliente ao perfil, ao pagamento ou à conversa."],
            ["Tag NFC adesiva", "Só o chip, em kits de 50 em 50. Para quem já tem a própria peça e quer colar o NFC."],
            ["Acrílico sem arte", "Só o material, nas cores cristal, branco, preto e azul. Para quem aplica a própria arte."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-2xl font-bold">Como cada um é configurado</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">Placas com QR Code e NFC:</strong> você ativa cada placa em gcardpro.com.br/ativar e cola o link de avaliação. O destino muda no painel, sem reimprimir.
          </li>
          <li>
            <strong className="text-foreground">Cartão, tags e placas de Instagram, Pix e WhatsApp:</strong> o chip chega vazio. Você grava o link com o app gratuito NFC Tools e pode regravar quando quiser.
          </li>
        </ul>

        <h2 className="mt-10 text-2xl font-bold">Perguntas frequentes</h2>
        <section className="mt-5 space-y-4">
          {questions.map(({ question, answer }) => (
            <div key={question} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
            </div>
          ))}
        </section>

        <h2 className="mt-10 text-2xl font-bold">Leia também</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Entenda{" "}
          <Link to="/guia/cartao-de-visita-por-aproximacao" className="font-semibold text-primary hover:underline">
            como o NFC funciona
          </Link>{" "}
          e veja{" "}
          <Link to="/guia/melhor-cartao-digital-para-empresa" className="font-semibold text-primary hover:underline">
            como revender placas de avaliação do Google
          </Link>
          .
        </p>

        <h2 className="mt-10 text-2xl font-bold">Fontes oficiais</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <a href="https://nfc-forum.org/learn/nfc-technology/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              NFC Forum: visão técnica da tecnologia NFC
            </a>
          </li>
          <li>
            <a href="https://www.qrcode.com/en/about/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              DENSO WAVE: recursos e padrões do QR Code
            </a>
          </li>
        </ul>

        <div className="mt-12 rounded-3xl bg-foreground p-7 text-background">
          <h2 className="text-2xl font-bold">Escolha o seu kit</h2>
          <p className="mt-2 text-sm opacity-85">A partir de 10 unidades, com frete grátis para todo o Brasil.</p>
          <Link
            to="/comprar"
            search={{}}
            className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Ver kits para revenda
          </Link>
        </div>
      </article>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link to="/guia" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao guia
        </Link>
        <div className="mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
