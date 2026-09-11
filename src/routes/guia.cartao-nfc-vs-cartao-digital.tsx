import { createFileRoute, Link } from "@tanstack/react-router";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.png";

const questions = [
  [
    "O cartão NFC substitui um cartão digital?",
    "Não necessariamente. O NFC é uma forma rápida de abrir um destino; o cartão digital é a página ou perfil que aparece depois. Uma solução pode combinar os dois.",
  ],
  [
    "O cartão NFC funciona em qualquer celular?",
    "A compatibilidade depende do aparelho e da configuração. Por isso, QR Code é um complemento útil para oferecer uma segunda forma de acesso.",
  ],
  [
    "Qual escolher para uma empresa?",
    "Depende do objetivo. Para presença física e uma ação rápida no balcão, o cartão NFC ajuda. Para contatos compartilhados à distância, o perfil digital é mais importante.",
  ],
];
export const Route = createFileRoute("/guia/cartao-nfc-vs-cartao-digital")({
  head: () => ({
    meta: [
      { title: "Cartão NFC ou cartão de visita digital: qual a diferença? | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Entenda a diferença entre cartão NFC e cartão de visita digital, quando usar cada um e por que NFC e QR Code podem ser complementares.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
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
            mainEntity: questions.map(([name, text]) => ({
              "@type": "Question",
              name,
              acceptedAnswer: { "@type": "Answer", text },
            })),
          }),
        }}
      />
      <article>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Guia GCard-PRÓ</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
          Cartão NFC ou cartão de visita digital: qual é a diferença?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Cartão NFC e cartão de visita digital são conceitos relacionados, mas não são a mesma
          coisa. O NFC é uma tecnologia de aproximação; o cartão digital é o conteúdo ou perfil que
          o contato acessa.
        </p>
        <h2 className="mt-12 text-2xl font-bold">A diferença em uma frase</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          <strong className="text-foreground">NFC é o caminho.</strong> O celular detecta o chip e
          abre um link. <strong className="text-foreground">O cartão digital é o destino.</strong>{" "}
          Ele reúne informações como nome, telefone, redes sociais, site, catálogo ou formas de
          contato.
        </p>
        <h2 className="mt-10 text-2xl font-bold">Quando combinar NFC e QR Code?</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Em situações presenciais, o NFC cria uma experiência rápida. O QR Code funciona como
          alternativa visível e também atende celulares que não detectam aproximação. Para uma
          empresa, oferecer os dois reduz atrito e deixa a ação mais clara.
        </p>
        <h2 className="mt-10 text-2xl font-bold">Como escolher</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>Escolha NFC quando o contato acontece frente a frente.</li>
          <li>Priorize um perfil digital quando o objetivo é compartilhar dados remotamente.</li>
          <li>
            Procure edição simples, boa experiência móvel e métricas compatíveis com seu objetivo.
          </li>
          <li>Explique ao cliente o que fazer e qual resultado esperar.</li>
        </ul>
        <section className="mt-12 space-y-4">
          {questions.map(([q, a]) => (
            <div key={q} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </div>
          ))}
        </section>
        <div className="mt-12 rounded-3xl bg-primary p-7 text-primary-foreground">
          <h2 className="text-2xl font-bold">Quer um cartão NFC pronto para o seu negócio?</h2>
          <p className="mt-2 text-sm opacity-85">
            A GCard-PRÓ entrega o cartão de bolso configurado para o seu objetivo.
          </p>
          <Link
            to="/comprar"
            search={{ caminho: "lojista" }}
            className="mt-5 inline-block rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-background"
          >
            Montar meu cartão
          </Link>
        </div>
      </article>
    </Page>
  );
}
function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background noise-bg">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <header>
          <Link to="/">
            <img src={logoTransparente} alt="GCard-PRÓ" className="h-8 w-auto" />
          </Link>
        </header>
        <div className="mt-14">{children}</div>
        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/guia" className="hover:text-foreground">
            ← Voltar ao guia
          </Link>
        </footer>
      </div>
    </main>
  );
}
