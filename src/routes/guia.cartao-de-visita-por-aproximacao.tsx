import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

// Mantém o endereço (/guia/cartao-de-visita-por-aproximacao) para não perder links nem SEO; o conteúdo agora fala com o revendedor.
const questions = [
  {
    question: "A placa NFC funciona em qualquer celular?",
    answer:
      "Não. O celular precisa ter NFC e a função precisa estar ligada. Funciona em iPhone XS ou mais novo e na maioria dos Androids. Por isso as placas de avaliação têm QR Code junto: quem não tem NFC escaneia com a câmera.",
  },
  {
    question: "A placa ou o cartão precisa de bateria?",
    answer:
      "Não. O chip NFC é passivo: ele recebe energia do próprio celular na hora da aproximação. Não há bateria para trocar nem para carregar.",
  },
  {
    question: "Qual a distância para o celular ler?",
    answer:
      "Poucos centímetros. Segundo o NFC Forum, o alcance típico é de até 2 cm. O cliente precisa encostar o celular na placa, não apontar de longe.",
  },
  {
    question: "Funciona sem internet?",
    answer:
      "O celular lê o chip, mas a tela de avaliação do Google só carrega com internet. O NFC não substitui a conexão do celular.",
  },
  {
    question: "Posso trocar o destino depois de entregar a placa?",
    answer:
      "Nas placas com QR Code e NFC da GCard-PRÓ, sim: o chip guarda um código, não o link, e você troca o destino no painel. Nas placas só NFC, você regrava o chip com o app NFC Tools.",
  },
] as const;

export const Route = createFileRoute("/guia/cartao-de-visita-por-aproximacao")({
  head: () => ({
    meta: [
      { title: "Como funciona o NFC: o que o revendedor precisa saber | GCard-PRÓ" },
      {
        name: "description",
        content:
          "O que é NFC, o que acontece no toque, compatibilidade dos celulares e como explicar isso ao seu cliente antes de vender placas e cartões de avaliação.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: "Como funciona o NFC: o que o revendedor precisa saber" },
      {
        property: "og:description",
        content: "NFC em linguagem simples: alcance, compatibilidade, limites e como explicar ao seu cliente.",
      },
      { property: "og:type", content: "article" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://www.gcardpro.com.br/guia/cartao-de-visita-por-aproximacao",
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
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">Como funciona o NFC: o que o revendedor precisa saber</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Quem revende placas e cartões NFC precisa explicar o produto em poucas frases e saber os limites dele. Este guia reúne o que você precisa para isso: como o toque funciona, em quais celulares funciona, o que pode dar errado e como testar antes de entregar ao cliente.
        </p>

        <h2 className="mt-12 text-2xl font-bold">O que é NFC e o que acontece no toque?</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          NFC é a sigla de <em>Near Field Communication</em>, comunicação por campo de proximidade. Segundo o NFC Forum, a tecnologia opera em 13,56 MHz e foi desenhada para comunicação sem contato a curtíssima distância: o alcance típico é de até 2 cm. “Por aproximação” significa encostar o celular, não apontar de longe.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          O chip da placa é passivo: não tem bateria. O celular emite um campo de radiofrequência que alimenta o chip por um instante e lê a mensagem gravada nele, normalmente um endereço (URL). O celular então oferece abrir esse endereço, que no caso das placas de avaliação é a tela de avaliar o negócio no Google.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Como explicar ao seu cliente em 10 segundos</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>“O cliente encosta o celular nesta placa.”</li>
          <li>“Abre direto a tela para avaliar o seu negócio no Google.”</li>
          <li>“Se o celular dele não tiver NFC, ele escaneia o QR Code com a câmera.”</li>
        </ol>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Faça a demonstração no celular do seu cliente. É o que mais convence.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Compatibilidade e limites</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["iPhone", "Lê NFC no iPhone XS ou mais novo."],
            ["Android", "Lê na maioria dos aparelhos com NFC. O NFC precisa estar ligado nas configurações."],
            ["Sem NFC", "Celular sem NFC não lê a placa. O QR Code resolve."],
            ["Sem internet", "O celular lê o chip, mas a página de avaliação precisa de conexão."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 leading-relaxed text-muted-foreground">
          A posição da antena muda de um celular para outro. Se a primeira tentativa não ler, mova o celular devagar sobre a placa. Não existe um ponto único que sirva para todos os aparelhos.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Checklist antes de entregar ao cliente</h2>
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
            <li>Teste a placa em um iPhone e em um Android.</li>
            <li>Escaneie o QR Code com a câmera e confira se abre o negócio certo.</li>
            <li>Confirme que o link é o de “Avaliar”, não o do perfil.</li>
            <li>Mostre ao cliente onde encostar o celular.</li>
            <li>Deixe a placa em um lugar de fácil acesso, no balcão ou no caixa.</li>
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
          Veja{" "}
          <Link to="/guia/melhor-cartao-digital-para-empresa" className="font-semibold text-primary hover:underline">
            como revender placas de avaliação do Google
          </Link>{" "}
          e quando{" "}
          <Link to="/guia/cartao-nfc-vs-cartao-digital" className="font-semibold text-primary hover:underline">
            usar NFC, QR Code ou os dois
          </Link>
          .
        </p>

        <h2 className="mt-10 text-2xl font-bold">Fontes oficiais para aprofundar</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <a href="https://nfc-forum.org/learn/nfc-technology/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              NFC Forum: visão técnica da tecnologia NFC e das tags NDEF
            </a>
          </li>
          <li>
            <a href="https://developer.android.com/develop/connectivity/nfc/nfc" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Android Developers: leitura de mensagens NDEF e encaminhamento de tags
            </a>
          </li>
          <li>
            <a
              href="https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Apple Developer: leitura de tags em segundo plano no iPhone
            </a>
          </li>
          <li>
            <a href="https://www.qrcode.com/en/about/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              DENSO WAVE: recursos e padrões do QR Code
            </a>
          </li>
        </ul>

        <div className="mt-12 rounded-3xl bg-foreground p-7 text-background">
          <h2 className="text-2xl font-bold">Pronto para revender?</h2>
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
