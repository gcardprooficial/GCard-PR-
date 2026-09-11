import { createFileRoute, Link } from "@tanstack/react-router";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.png";

const questions = [
  {
    question: "Cartão de visita por aproximação funciona em qualquer celular?",
    answer:
      "Não. O aparelho precisa ter suporte à leitura NFC e a leitura pode depender do sistema, da configuração, do estado da tela e do contexto de uso. Por isso, um QR Code visível e um link compartilhável devem continuar disponíveis como alternativas.",
  },
  {
    question: "O cartão NFC precisa de bateria ou carregamento?",
    answer:
      "Uma tag NFC passiva não precisa de bateria própria para ser lida. O leitor fornece energia por meio do campo de radiofrequência durante a aproximação. Isso não significa que o celular ficará carregado: a energia serve para a comunicação da tag.",
  },
  {
    question: "Por que usar QR Code junto com NFC?",
    answer:
      "NFC e QR Code são portas de entrada diferentes para o mesmo destino. A aproximação é rápida quando o encontro é presencial; o QR Code é visual e funciona como alternativa quando o aparelho não lê NFC, quando o cliente prefere usar a câmera ou quando a distância torna o toque impraticável.",
  },
  {
    question: "O que acontece se o celular estiver sem internet?",
    answer:
      "A tag pode ser detectada e a URL pode aparecer, mas uma página online, catálogo ou formulário não carregará normalmente sem conexão. O NFC não substitui a internet necessária para acessar o conteúdo hospedado.",
  },
  {
    question: "Posso alterar o perfil depois de imprimir ou gravar o cartão?",
    answer:
      "Sim, quando o cartão aponta para uma URL administrável. Nesse modelo, o conteúdo do perfil muda no servidor sem regravar a tag. A possibilidade depende da plataforma e do endereço configurado; não é uma propriedade automática de todo cartão NFC.",
  },
] as const;

export const Route = createFileRoute("/guia/cartao-de-visita-por-aproximacao")({
  head: () => ({
    meta: [
      { title: "Cartão de visita por aproximação: como funciona o NFC | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Entenda como funciona o cartão de visita por aproximação, o papel do NFC e do QR Code, a compatibilidade dos celulares e os limites práticos.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      {
        property: "og:title",
        content: "Cartão de visita por aproximação: como funciona o NFC",
      },
      {
        property: "og:description",
        content:
          "Um guia prático sobre NFC, QR Code, compatibilidade, experiência do usuário e limites do cartão de visita por aproximação.",
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
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Guia GCard-PRÓ</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
          Cartão de visita por aproximação: como funciona o NFC?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Um cartão de visita por aproximação usa uma tag NFC para levar o celular a um endereço
          digital, geralmente um perfil profissional, catálogo, WhatsApp ou formulário. O gesto é
          simples: o cliente aproxima um aparelho compatível, recebe a indicação do conteúdo e toca
          para continuar. A tecnologia reduz etapas em um encontro presencial, mas não elimina a
          necessidade de uma página clara, de internet para carregar o destino ou de uma alternativa
          para outros celulares.
        </p>

        <h2 className="mt-12 text-2xl font-bold">O que é NFC e o que acontece no toque?</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          NFC é a sigla de <em>Near Field Communication</em>, ou comunicação por campo de
          proximidade. Segundo o NFC Forum, a tecnologia opera na frequência de 13,56 MHz e foi
          desenhada para comunicação sem contato a curtíssima distância. O alcance típico descrito
          pela organização é de até 2 cm, enquanto a faixa de conformidade certificada é de 5 mm.
          Portanto, “por aproximação” não significa funcionar a vários metros: o gesto precisa ser
          intencional e acontecer perto da antena do aparelho e da tag.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Em uma tag passiva, como a usada em muitos cartões, não há bateria para trocar ou
          recarregar. O leitor fornece energia por meio do campo de radiofrequência durante a
          comunicação. Essa energia é suficiente para a tag responder, mas não serve para carregar o
          celular. O NFC Forum também destaca que a tecnologia foi projetada para iniciar
          rapidamente, lidar com pequenas cargas de dados e encerrar a conexão em pouco tempo.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A tag normalmente guarda uma mensagem no formato NDEF, padrão do NFC Forum. Um registro
          NDEF pode conter uma URL, texto, contato ou outro tipo de dado. Para um cartão de visita,
          a opção mais prática costuma ser uma URL HTTPS: o sistema lê o endereço e encaminha o
          visitante para uma página que pode reunir nome, telefone, redes sociais, localização e
          chamadas para ação.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Passo a passo da experiência do usuário</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>
            A empresa define um destino, como um perfil digital, uma página de agendamento ou um
            catálogo, e grava esse endereço na tag NFC.
          </li>
          <li>
            O profissional explica o gesto e aproxima o cartão da área de leitura do celular do
            cliente. Como as antenas variam entre aparelhos, é melhor orientar a aproximação sem
            prometer uma posição universal.
          </li>
          <li>
            O sistema identifica a tag e interpreta a mensagem NDEF. Em aparelhos compatíveis, uma
            notificação, sugestão ou ação de abertura de link pode aparecer conforme o sistema e
            suas configurações.
          </li>
          <li>
            O cliente confirma ou toca no endereço, acessa a página no navegador e escolhe a ação:
            salvar contato, chamar no WhatsApp, ligar, ver o mapa, pedir orçamento ou conhecer o
            portfólio.
          </li>
        </ol>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          No Android, a documentação oficial descreve um sistema que analisa a tag, interpreta o
          tipo MIME ou a URI e encaminha o conteúdo à atividade apropriada. No iPhone, a Apple
          informa que aparelhos compatíveis com leitura em segundo plano podem mostrar uma
          notificação após identificar uma URI NDEF; a pessoa toca na notificação para continuar.
          Nem todos os dispositivos oferecem esse mesmo fluxo, e fatores como tela, câmera, Apple
          Pay, modo avião e uma sessão NFC em andamento podem alterar a disponibilidade da leitura
          em segundo plano.
        </p>

        <h2 className="mt-10 text-2xl font-bold">NFC, QR Code e link: qual é a diferença?</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          NFC é o meio de aproximação. QR Code é uma representação visual que a câmera pode ler. O
          link é o endereço que o visitante pode abrir, copiar ou compartilhar. Eles não são três
          versões do mesmo recurso: são entradas complementares para um destino digital.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-bold">Entrada</th>
                <th className="px-4 py-3 font-bold">Melhor contexto</th>
                <th className="px-4 py-3 font-bold">Limite prático</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">NFC</td>
                <td className="px-4 py-3">Encontro presencial, balcão, reunião ou evento.</td>
                <td className="px-4 py-3">
                  Exige aparelho e leitura compatíveis; funciona a curtíssima distância.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">QR Code</td>
                <td className="px-4 py-3">Material impresso, vitrine, embalagem, mesa ou tela.</td>
                <td className="px-4 py-3">
                  Depende de câmera, enquadramento, foco e boa apresentação visual.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Link</td>
                <td className="px-4 py-3">
                  Mensagem, e-mail, redes sociais e compartilhamento remoto.
                </td>
                <td className="px-4 py-3">
                  Precisa ser digitado, copiado ou recebido; uma URL confusa aumenta o atrito.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          O QR Code também tem limites próprios. A DENSO WAVE, criadora do padrão, descreve leitura
          em 360 graus e recursos de correção de erro, mas isso não dispensa contraste, tamanho
          adequado e uma superfície que a câmera consiga enquadrar. Na operação real, mantenha o
          código visível e teste a leitura em diferentes condições de luz. Se NFC ou QR Code
          apontarem para a mesma URL, o visitante terá uma experiência coerente independentemente da
          porta de entrada.
        </p>

        <h2 className="mt-10 text-2xl font-bold">
          Como criar uma experiência que não depende de explicação?
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A tecnologia pode ser rápida e ainda assim gerar dúvida. O cartão precisa mostrar que
          existe uma ação, indicar onde aproximar e deixar claro o resultado esperado. Uma frase
          como “Aproxime para salvar nossos contatos” é mais útil do que apenas o símbolo NFC. Ao
          lado, “Ou escaneie o QR Code” oferece uma rota alternativa sem constranger quem prefere a
          câmera.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["Clareza", "Use uma instrução curta e diga o que será aberto depois do toque."],
            [
              "Velocidade",
              "Faça a página carregar bem no celular e coloque a ação principal no início.",
            ],
            ["Confiança", "Exiba a marca, o nome do profissional e um domínio reconhecível."],
            [
              "Acessibilidade",
              "Mantenha link e QR Code para quem não consegue ou não quer usar NFC.",
            ],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-2xl font-bold">Exemplos de uso empresarial</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Em uma feira, uma pessoa vendedora pode compartilhar o perfil e o catálogo sem procurar o
          nome da empresa em uma rede social. Em uma recepção de clínica, a tag pode levar à página
          de agendamento, enquanto o QR Code atende quem prefere escanear. Em um restaurante, o
          mesmo princípio pode conduzir ao menu digital e aos canais de atendimento. Em uma
          imobiliária, cada corretor pode ter uma URL própria com telefone, áreas de atuação e
          imóveis em destaque.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Esses exemplos não significam que NFC, sozinho, gera vendas ou agendamentos. O resultado
          depende do destino, da oferta, da conexão e do processo de atendimento. Para medir
          campanhas, uma empresa pode usar parâmetros UTM na URL. O Google Analytics recomenda
          padronizar, no mínimo, <code>utm_source</code>,<code>utm_medium</code> e{" "}
          <code>utm_campaign</code>, para identificar de onde veio o acesso. Faça isso somente se a
          análise estiver configurada e se a política de privacidade explicar a medição aplicável.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Limites e checklist antes de escolher</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          NFC não é uma conexão de longo alcance, não é pagamento por aproximação por si só e não
          substitui uma página digital. Também não é correto prometer que todo celular abrirá o link
          automaticamente. A tag pode ser compatível com o padrão e, ainda assim, o telefone estar
          sem NFC, com a função desativada, em uma situação que impede a leitura ou sem internet
          para carregar o destino.
        </p>
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold">Checklist de implantação</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
            <li>
              Defina uma única ação principal para a página, como contato, orçamento ou agendamento.
            </li>
            <li>
              Teste a tag em mais de um aparelho e mantenha o QR Code e o link como alternativas.
            </li>
            <li>
              Use uma URL estável e administrável quando houver necessidade de atualizar o perfil.
            </li>
            <li>
              Verifique carregamento, contraste, legibilidade, botões e funcionamento da página no
              celular.
            </li>
            <li>
              Explique quais dados são coletados por formulários, Analytics ou outras ferramentas de
              medição.
            </li>
            <li>
              Treine a equipe para orientar o gesto sem tratar a aproximação como obrigatória ou
              universal.
            </li>
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
          Para continuar a pesquisa, veja o{" "}
          <Link to="/guia" className="font-semibold text-primary hover:underline">
            guia completo da GCard-PRÓ
          </Link>
          , compare{" "}
          <Link
            to="/guia/cartao-nfc-vs-cartao-digital"
            className="font-semibold text-primary hover:underline"
          >
            cartão NFC e cartão de visita digital
          </Link>
          e confira como escolher o{" "}
          <Link
            to="/guia/melhor-cartao-digital-para-empresa"
            className="font-semibold text-primary hover:underline"
          >
            melhor cartão digital para empresa
          </Link>
          . Se a solução fizer sentido para o seu negócio, conheça as opções em{" "}
          <Link
            to="/comprar"
            search={{ caminho: "lojista" }}
            className="font-semibold text-primary hover:underline"
          >
            comprar
          </Link>
          .
        </p>

        <h2 className="mt-10 text-2xl font-bold">Fontes oficiais para aprofundar</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <a
              href="https://nfc-forum.org/learn/nfc-technology/"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              NFC Forum: visão técnica da tecnologia NFC e das tags NDEF
            </a>
          </li>
          <li>
            <a
              href="https://developer.android.com/develop/connectivity/nfc/nfc"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
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
            <a
              href="https://www.qrcode.com/en/about/"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              DENSO WAVE: recursos e padrões do QR Code
            </a>
          </li>
          <li>
            <a
              href="https://support.google.com/analytics/answer/10917952?hl=pt-BR"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Google Analytics: parâmetros UTM e URLs de campanha
            </a>
          </li>
          <li>
            <a
              href="https://developers.google.com/search/docs/crawling-indexing/canonicalization"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Google Search Central: como funciona a URL canônica
            </a>
          </li>
        </ul>

        <div className="mt-12 rounded-3xl bg-foreground p-7 text-background">
          <h2 className="text-2xl font-bold">Leve essa experiência para o seu negócio</h2>
          <p className="mt-2 text-sm opacity-75">
            A GCard-PRÓ ajuda sua empresa a combinar aproximação, QR Code e um perfil digital em uma
            experiência simples.
          </p>
          <Link
            to="/comprar"
            search={{ caminho: "lojista" }}
            className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Começar pedido
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
