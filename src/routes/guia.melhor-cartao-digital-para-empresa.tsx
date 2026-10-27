import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

// Mantém o endereço (/guia/melhor-cartao-digital-para-empresa) para não perder links nem SEO; o conteúdo agora fala com o revendedor.
const questions = [
  {
    question: "Preciso comprar uma placa por cliente?",
    answer:
      "Não. Você compra em kit, a partir de 10 unidades, e usa cada placa para um cliente diferente. O preço por unidade cai conforme a quantidade do kit.",
  },
  {
    question: "Como cada placa aponta para o Google do meu cliente?",
    answer:
      "Nas placas com QR Code e NFC, cada uma tem um código. Em gcardpro.com.br/ativar você escolhe a placa, informa o nome do negócio e cola o link de avaliação do Google do seu cliente. Nas placas só NFC (cartão, tags e placas de Instagram, Pix e WhatsApp), o chip chega vazio e você grava o link com o app gratuito NFC Tools.",
  },
  {
    question: "Se o link do meu cliente mudar, preciso reimprimir?",
    answer:
      "Nas placas com QR Code e NFC, não: o QR e o NFC guardam um código, não o link, então você troca o destino no painel. Nas placas só NFC, você regrava o chip.",
  },
  {
    question: "Posso prometer mais avaliações ou mais vendas ao meu cliente?",
    answer:
      "Não. A placa reduz os passos para o cliente final deixar a avaliação, mas o resultado depende do atendimento e de o cliente pedir. Prometa a facilidade, não o resultado.",
  },
  {
    question: "Posso oferecer brinde em troca da avaliação?",
    answer:
      "Evite. As políticas de conteúdo do Google não permitem avaliações incentivadas. Peça a avaliação de forma natural, no fim do atendimento.",
  },
] as const;

export const Route = createFileRoute("/guia/melhor-cartao-digital-para-empresa")({
  head: () => ({
    meta: [
      { title: "Como revender placas de avaliação do Google: passo a passo | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Para quem quer revender placas e cartões NFC de avaliação do Google: para quem vender, como configurar cada placa, o que oferecer e os cuidados para não prometer demais.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: "Como revender placas de avaliação do Google: passo a passo" },
      {
        property: "og:description",
        content:
          "Do kit ao balcão do seu cliente: para quem vender, como ativar cada placa e o que oferecer em cada caso.",
      },
      { property: "og:type", content: "article" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://www.gcardpro.com.br/guia/melhor-cartao-digital-para-empresa",
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
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">Como revender placas de avaliação do Google</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          A placa de avaliação leva o cliente direto à tela de avaliar o negócio no Google: ele aproxima o celular (NFC) ou escaneia o QR Code e já está no lugar certo. É um produto fácil de mostrar em cinco segundos, e você vende para qualquer negócio que atende pessoas e tem perfil no Google. Este guia mostra o caminho do kit até o balcão do seu cliente.
        </p>

        <h2 className="mt-12 text-2xl font-bold">1. Para quem vender</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          O cliente ideal atende pessoas de forma presencial e depende de ser encontrado no Google: restaurantes, clínicas, salões e barbearias, oficinas, academias, lojas e prestadores de serviço. Quem já pede avaliação de forma manual (“procura a gente no Google”) entende o valor na hora.
        </p>

        <h2 className="mt-10 text-2xl font-bold">2. Do kit ao balcão, em seis passos</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">Escolha o kit.</strong> A partir de 10 unidades, com frete grátis. Veja os modelos e preços em{" "}
            <Link to="/" hash="precos" className="font-semibold text-primary hover:underline">
              Escolha o seu kit
            </Link>
            .
          </li>
          <li>
            <strong className="text-foreground">Pegue o link de avaliação do seu cliente.</strong> Use o{" "}
            <Link to="/gerador" className="font-semibold text-primary hover:underline">
              gerador de link grátis
            </Link>
            : você busca o negócio pelo nome e copia o link de “Avaliar”.
          </li>
          <li>
            <strong className="text-foreground">Configure a placa.</strong> Placas com QR Code e NFC: entre em gcardpro.com.br/ativar, resgate o lote, ache a placa pelo código (ex.: GCARD-00001), informe o nome do negócio e cole o link. Placas só NFC: grave o link no chip com o app NFC Tools.
          </li>
          <li>
            <strong className="text-foreground">Teste.</strong> Aproxime um iPhone e um Android e escaneie o QR Code com a câmera. Confira se abre a avaliação do negócio certo.
          </li>
          <li>
            <strong className="text-foreground">Entregue e oriente.</strong> Mostre onde aproximar e deixe a placa no balcão, no caixa ou na mesa.
          </li>
          <li>
            <strong className="text-foreground">Troque o link quando precisar.</strong> Nas placas com QR e NFC, o destino muda no painel, sem reimprimir.
          </li>
        </ol>

        <h2 className="mt-10 text-2xl font-bold">3. O que oferecer a cada cliente</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["Placa Avaliação do Google 10×10", "QR Code + NFC na mesma placa de acrílico. Serve para quem quer cobrir todos os celulares."],
            ["Placa em L 10×15", "Formato de mesa, para balcão e mesa de restaurante, bar e cafeteria."],
            ["Cartão de bolso", "PVC só com NFC, para entregar na mão ou deixar no caixa. Não tem QR Code."],
            ["Placas de Instagram, Pix e WhatsApp", "Arte pronta com chip NFC. O cliente aproxima e abre o perfil, o pagamento ou a conversa."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-2xl font-bold">4. Como montar o seu preço</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          O preço final ao seu cliente é seu. A conta é simples: o custo da placa no seu kit, mais o seu trabalho de configurar e testar, mais a margem que você quer. Como o preço por unidade cai com a quantidade, comprar kits maiores melhora a margem quando você já tem clientes para as placas. Comece com um kit pequeno para validar a oferta e aumente depois.
        </p>

        <h2 className="mt-10 text-2xl font-bold">5. Cuidados para vender sem prometer demais</h2>
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
            <li>Não prometa mais avaliações ou mais vendas. Prometa a facilidade de avaliar.</li>
            <li>Mantenha o QR Code junto do NFC. Celular sem NFC, ou com ele desligado, não lê a placa.</li>
            <li>NFC lê a poucos centímetros: o cliente precisa encostar o celular, não apontar de longe.</li>
            <li>Peça a avaliação de forma natural. Não ofereça brinde em troca: as políticas do Google não permitem avaliações incentivadas.</li>
            <li>Confira o link antes de entregar, para o cliente não avaliar o negócio errado.</li>
          </ul>
        </div>

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
          e quando{" "}
          <Link to="/guia/cartao-nfc-vs-cartao-digital" className="font-semibold text-primary hover:underline">
            usar NFC, QR Code ou os dois
          </Link>
          . Para configurar uma placa passo a passo, veja{" "}
          <Link to="/guia/como-configurar-placa-gcard" className="font-semibold text-primary hover:underline">
            como configurar e ativar sua placa
          </Link>
          .
        </p>

        <div className="mt-12 rounded-3xl bg-foreground p-7 text-background">
          <h2 className="text-2xl font-bold">Pronto para começar a revender?</h2>
          <p className="mt-2 text-sm opacity-75">Kits a partir de 10 unidades, com frete grátis para todo o Brasil.</p>
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
