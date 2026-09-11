import { createFileRoute, Link } from "@tanstack/react-router";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

const questions = [
  {
    question: "Cartão NFC e cartão de visita digital são a mesma coisa?",
    answer:
      "Não. NFC é a tecnologia de aproximação que funciona como uma porta de entrada. O cartão de visita digital é a página ou perfil que o contato acessa, com nome, telefone, redes, catálogo e chamadas para ação. Uma solução pode usar NFC para abrir o mesmo perfil digital.",
  },
  {
    question: "O cartão NFC funciona em qualquer celular?",
    answer:
      "Não é seguro prometer compatibilidade universal. O aparelho precisa ter suporte à leitura NFC e o sistema pode aplicar regras próprias de disponibilidade, confirmação e abertura do link. Por isso, mantenha QR Code e URL compartilhável como alternativas.",
  },
  {
    question: "Preciso escolher entre NFC e QR Code?",
    answer:
      "Não necessariamente. Em encontros presenciais, NFC e QR Code podem apontar para o mesmo perfil digital: a aproximação atende quem prefere tocar e o QR Code atende quem prefere usar a câmera ou está com um aparelho que não lê NFC.",
  },
  {
    question: "Um cartão NFC precisa de bateria ou internet?",
    answer:
      "Uma tag NFC passiva pode ser lida sem bateria própria, porque o leitor fornece energia durante a comunicação. Isso não carrega o celular. Para abrir um perfil, catálogo ou formulário hospedado na internet, o aparelho ainda precisa conseguir acessar a rede.",
  },
  {
    question: "Como medir se NFC, QR Code ou link gerou mais acessos?",
    answer:
      "Use destinos identificáveis e, quando a medição estiver configurada, parâmetros UTM padronizados. Por exemplo, NFC pode usar utm_medium=nfc e o QR Code utm_medium=qr, com o mesmo utm_campaign. O Analytics poderá atribuir os acessos conforme a configuração e o relatório adotados; o NFC sozinho não mede conversões.",
  },
] as const;

export const Route = createFileRoute("/guia/cartao-nfc-vs-cartao-digital")({
  head: () => ({
    meta: [
      {
        title: "Cartão NFC ou cartão de visita digital: diferenças e usos | GCard-PRÓ",
      },
      {
        name: "description",
        content:
          "Entenda a diferença entre cartão NFC e cartão de visita digital, os limites de compatibilidade e quando combinar NFC, QR Code e perfil digital.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      {
        property: "og:title",
        content: "Cartão NFC ou cartão de visita digital: diferenças e usos",
      },
      {
        property: "og:description",
        content:
          "Guia prático para escolher entre NFC, QR Code, link e perfil digital em situações pessoais e empresariais.",
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
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Guia GCard-PRÓ</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
          Cartão NFC ou cartão de visita digital: qual é a diferença?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Cartão NFC e cartão de visita digital não são sinônimos. O NFC é uma tecnologia de
          comunicação de curtíssimo alcance que pode abrir um endereço no celular. O cartão de
          visita digital é o perfil ou a página que apresenta os dados profissionais e orienta a
          próxima ação. Em vez de escolher uma tecnologia contra a outra, empresas podem combinar
          NFC, QR Code e um perfil digital para criar mais de uma porta de entrada para o mesmo
          conteúdo.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A decisão correta depende do contexto: uma conversa frente a frente pede uma entrada
          rápida; uma mensagem à distância pede um link; uma vitrine, embalagem ou balcão pode
          precisar de um QR Code visível. Este guia explica a diferença, os limites de
          compatibilidade e um caminho prático para montar essa experiência sem prometer o que o
          hardware ou o celular não garantem.
        </p>

        <h2 className="mt-12 text-2xl font-bold">A diferença em uma frase</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          <strong className="text-foreground">NFC é o caminho.</strong> A aproximação permite que um
          aparelho compatível leia uma tag e interprete os dados armazenados nela. O NFC Forum
          descreve a tecnologia como uma comunicação sem contato na faixa de 13,56 MHz, adequada a
          distâncias muito curtas e a pequenas cargas de dados. Em sua visão técnica, o alcance
          típico chega a cerca de 2 cm, portanto “por aproximação” não significa funcionar a vários
          metros.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          <strong className="text-foreground">O perfil digital é o destino.</strong> Ele é uma
          página acessada no navegador e pode reunir nome, cargo, telefone, e-mail, WhatsApp, redes
          sociais, localização, portfólio, catálogo ou formulário. O cartão físico não precisa
          guardar todos esses dados: uma tag pode carregar uma URL em formato NDEF, e a página pode
          ser atualizada no servidor quando a plataforma permitir. Assim, NFC e perfil digital
          cumprem funções diferentes e complementares.
        </p>

        <h2 className="mt-10 text-2xl font-bold">
          NFC, QR Code, link e perfil digital: o papel de cada um
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Pense em quatro camadas. O <strong className="text-foreground">NFC</strong> atende ao
          gesto presencial de aproximar. O <strong className="text-foreground">QR Code</strong>{" "}
          oferece uma representação visual que a câmera pode ler. O{" "}
          <strong className="text-foreground">link</strong>
          pode ser copiado e enviado por WhatsApp, e-mail ou rede social. O
          <strong className="text-foreground"> perfil digital</strong> organiza a informação e
          conduz a pessoa para a ação que interessa ao negócio. Nenhuma das três primeiras entradas
          substitui o conteúdo do destino.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-bold">Recurso</th>
                <th className="px-4 py-3 font-bold">Melhor contexto</th>
                <th className="px-4 py-3 font-bold">Limite que deve ser considerado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">NFC</td>
                <td className="px-4 py-3">
                  Reunião, balcão, evento ou atendimento frente a frente.
                </td>
                <td className="px-4 py-3">
                  Exige leitura compatível e funciona a curtíssima distância.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">QR Code</td>
                <td className="px-4 py-3">
                  Vitrine, embalagem, mesa, impresso, tela ou sinalização.
                </td>
                <td className="px-4 py-3">
                  Depende de câmera, enquadramento, contraste e luz suficientes.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Link</td>
                <td className="px-4 py-3">
                  WhatsApp, e-mail, assinatura, proposta e compartilhamento remoto.
                </td>
                <td className="px-4 py-3">Precisa ser recebido, copiado ou digitado sem erros.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Perfil digital</td>
                <td className="px-4 py-3">
                  Apresentar a marca e orientar contato, orçamento ou agendamento.
                </td>
                <td className="px-4 py-3">
                  Precisa de conteúdo atualizado, boa leitura no celular e conexão.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-2xl font-bold">Quando combinar NFC, QR Code e perfil digital?</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A combinação faz mais sentido quando o encontro é presencial, mas o público tem aparelhos,
          preferências e condições diferentes. Grave no NFC uma URL HTTPS curta e estável. Mostre ao
          lado um QR Code que leve ao mesmo endereço. Inclua uma instrução objetiva, como “Aproxime
          para abrir nosso perfil” e “ou escaneie o QR Code”. Depois, deixe no perfil apenas as
          ações relevantes: salvar contato, chamar no WhatsApp, ligar, pedir orçamento ou agendar.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Essa arquitetura evita tratar uma porta de entrada como solução completa. Se o telefone
          não tiver NFC, a câmera e o QR Code continuam disponíveis. Se a conversa ocorrer a
          distância, o link pode ser enviado sem depender do cartão físico. Se o contato chegar pelo
          NFC, a mesma página mantém a marca e a chamada para ação. O objetivo não é adicionar
          recursos por aparência, mas reduzir etapas para a pessoa certa, no momento certo.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Exemplos de uso empresarial</h2>
        <h3 className="mt-7 text-xl font-bold">Equipe comercial em feira ou reunião</h3>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          A pessoa vendedora pode usar um cartão NFC para abrir seu perfil durante uma conversa. O
          QR Code impresso atende quem prefere escanear. O perfil pode apresentar a especialidade,
          os canais de contato e um botão de orçamento. Após a reunião, o mesmo endereço pode ser
          enviado por mensagem. A equipe deve revisar o telefone, o cargo e o destino dos leads
          quando alguém mudar de função.
        </p>
        <h3 className="mt-7 text-xl font-bold">Clínica, salão ou consultório</h3>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Na recepção, o NFC pode abrir a página de agendamento e o QR Code pode ficar na mesa ou na
          sinalização. O perfil digital deve explicar a ação principal, sem esconder horários,
          telefone ou localização atrás de muitos botões. O cartão não substitui informações
          obrigatórias, canais de atendimento ou a segurança necessária no tratamento de dados
          enviados em formulários.
        </p>
        <h3 className="mt-7 text-xl font-bold">Restaurante, loja ou imobiliária</h3>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Um restaurante pode apontar para menu e atendimento; uma loja, para catálogo ou campanha;
          uma imobiliária, para o perfil de cada corretor e seus imóveis. Em todos os casos, o
          destino deve ser administrável e responsivo. O NFC não cria o catálogo, não garante venda
          e não substitui o processo comercial: ele apenas facilita a entrada no conteúdo escolhido.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Compatibilidade, limites e medição</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          O Android documenta NFC como um conjunto de tecnologias de curto alcance, normalmente até
          4 cm para iniciar uma conexão, e descreve modos de leitura e escrita de tags. O aparelho
          precisa ter o recurso e a leitura pode depender do sistema e da configuração. Em outros
          dispositivos, o fluxo de notificação e abertura também varia. Por isso, teste a tag em
          modelos diferentes e não prometa que qualquer celular abrirá a página automaticamente.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Uma tag passiva não precisa de bateria própria para responder ao leitor, mas isso não
          significa que ela carregue o telefone. A tag também não elimina a internet: se o destino
          for uma página hospedada online, o navegador precisará de conexão. QR Code tem seus
          próprios requisitos de impressão, contraste, tamanho, foco e enquadramento. Mantenha o
          código visível e teste em luz real, não apenas na tela do computador.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Para analisar origens, o Google Analytics recomenda usar <code>utm_source</code>,
          <code>utm_medium</code> e <code>utm_campaign</code> nas URLs de campanha. Uma empresa pode
          diferenciar NFC e QR Code com meios consistentes, como <code>utm_medium=nfc</code> e
          <code>utm_medium=qr</code>. Isso identifica acessos conforme a implementação do Analytics;
          não mede sozinho leitura física, intenção ou conversão. Defina também eventos para cliques
          em WhatsApp, telefone, formulário ou agendamento, respeitando a política de privacidade
          aplicável.
        </p>

        <h2 className="mt-10 text-2xl font-bold">
          Checklist para escolher sem exagerar na tecnologia
        </h2>
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <ul className="list-disc space-y-3 pl-5 leading-relaxed text-muted-foreground">
            <li>
              Defina uma ação principal: contato, orçamento, catálogo, localização ou agendamento.
            </li>
            <li>
              Use um perfil digital mobile-first, com marca reconhecível e conteúdo atualizado.
            </li>
            <li>Se o contato for presencial, ofereça NFC e QR Code para o mesmo destino.</li>
            <li>Mantenha um link compartilhável para conversas remotas e mensagens posteriores.</li>
            <li>Teste leitura NFC, câmera, botões e carregamento em mais de um aparelho e rede.</li>
            <li>
              Use UTMs somente quando houver Analytics configurado e uma pergunta de negócio
              definida.
            </li>
            <li>Explique a coleta de dados de formulários, cookies e ferramentas de medição.</li>
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
          Para aprofundar a parte técnica, veja o guia sobre
          <Link
            to="/guia/cartao-de-visita-por-aproximacao"
            className="font-semibold text-primary hover:underline"
          >
            cartão de visita por aproximação
          </Link>
          . Se a prioridade for organizar uma solução para equipe, consulte o artigo sobre o
          <Link
            to="/guia/melhor-cartao-digital-para-empresa"
            className="font-semibold text-primary hover:underline"
          >
            melhor cartão de visita digital para empresa
          </Link>
          . Você também pode voltar ao
          <Link to="/guia" className="font-semibold text-primary hover:underline">
            guia completo da GCard-PRÓ
          </Link>
          .
        </p>

        <section className="mt-10 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Fontes oficiais consultadas</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            As definições técnicas e recomendações de medição deste artigo foram conferidas nas
            documentações do
            <a
              href="https://nfc-forum.org/learn/nfc-technology/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              NFC Forum
            </a>
            , do
            <a
              href="https://developer.android.com/develop/connectivity/nfc"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Android Developers
            </a>
            , do
            <a
              href="https://support.google.com/analytics/answer/10917952?hl=pt-BR"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Google Analytics
            </a>
            e do
            <a
              href="https://developers.google.com/search/docs/crawling-indexing/canonicalization"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Google Search Central
            </a>
            .
          </p>
        </section>

        <div className="mt-12 rounded-3xl bg-primary p-7 text-primary-foreground">
          <h2 className="text-2xl font-bold">Quer combinar cartão NFC e perfil digital?</h2>
          <p className="mt-2 text-sm opacity-85">
            Configure uma experiência com aproximação, QR Code e um destino claro para o seu
            negócio.
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
