import { createFileRoute, Link } from "@tanstack/react-router";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

const questions = [
  {
    question: "Qual é o melhor cartão de visita digital para uma empresa?",
    answer:
      "É a solução que combina uma página clara no celular, atualização simples, opção de acesso por link, QR Code ou NFC, métricas relacionadas ao objetivo e uma operação compatível com o tamanho da equipe. O melhor cartão não é necessariamente o que tem mais botões, mas o que facilita a próxima ação e pode ser administrado com segurança.",
  },
  {
    question: "NFC funciona em qualquer celular?",
    answer:
      "Não é seguro tratar a compatibilidade como universal. Ela depende do aparelho, do sistema e da configuração de leitura. Por isso, um QR Code visível e um link compartilhável devem continuar disponíveis como alternativas para quem não consegue ou não quer usar a aproximação.",
  },
  {
    question: "Como medir se os cartões da equipe estão gerando resultado?",
    answer:
      "Defina eventos para as ações importantes, como clique em WhatsApp, salvamento de contato, envio de formulário ou acesso a um catálogo. Depois, compare as ações com o objetivo da campanha e valide a coleta no relatório em tempo real ou no DebugView do Google Analytics.",
  },
  {
    question: "Uma empresa precisa de um perfil para cada colaborador?",
    answer:
      "Nem sempre. Um perfil individual faz sentido quando cada pessoa atende uma carteira, recebe leads ou precisa compartilhar seus próprios contatos. Para uma equipe pequena, uma página institucional com caminhos bem organizados pode bastar. A decisão deve acompanhar o processo comercial, não apenas a quantidade de funcionários.",
  },
  {
    question: "O que observar sobre privacidade antes de contratar?",
    answer:
      "Pergunte quais dados são coletados, para qual finalidade, por quanto tempo ficam disponíveis, quem pode acessá-los e como a empresa exporta ou exclui informações. Se houver cookies, Analytics ou formulários, verifique como o consentimento é apresentado e respeitado. A ANPD mantém materiais de segurança e um checklist para agentes de pequeno porte.",
  },
] as const;

export const Route = createFileRoute("/guia/melhor-cartao-digital-para-empresa")({
  head: () => ({
    meta: [
      { title: "Melhor cartão de visita digital para empresa: como escolher | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Aprenda a escolher o melhor cartão de visita digital para empresa considerando equipe, leads, métricas, NFC, QR Code, operação e privacidade.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      {
        property: "og:title",
        content: "Melhor cartão de visita digital para empresa: como escolher",
      },
      {
        property: "og:description",
        content:
          "Um guia prático para avaliar cartões digitais por objetivo, experiência, equipe, métricas, operação e privacidade.",
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
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          Guia para empresas
        </p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
          Melhor cartão de visita digital para empresa: como escolher
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          O melhor cartão de visita digital para uma empresa é o que transforma uma conversa em uma
          próxima ação sem criar trabalho desnecessário para a equipe. Antes de comparar recursos,
          defina se o objetivo é compartilhar contatos, receber leads, apresentar um catálogo,
          encaminhar clientes ao WhatsApp ou medir uma campanha. A partir daí, avalie experiência no
          celular, gestão de perfis, métricas, custo, compatibilidade e privacidade.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Este guia não trata NFC, QR Code e cartão digital como sinônimos. O NFC é um caminho de
          aproximação; o QR Code é uma alternativa visual; e o perfil digital é o destino que reúne
          informações e chamadas para ação. Para entender essa diferença, leia também o artigo
          <Link
            to="/guia/cartao-nfc-vs-cartao-digital"
            className="font-semibold text-primary hover:underline"
          >
            sobre cartão NFC ou cartão de visita digital
          </Link>
          .
        </p>

        <h2 className="mt-12 text-2xl font-bold">1. Comece pelo objetivo comercial</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Uma solução para uma imobiliária, uma clínica, um restaurante e uma equipe de vendas pode
          ter a mesma base, mas não deve conduzir o visitante para o mesmo lugar. Liste a ação que
          precisa acontecer depois do contato: salvar o telefone, iniciar uma conversa, solicitar um
          orçamento, consultar o menu, agendar um atendimento ou avaliar a empresa. Essa escolha
          orienta o texto da página, a ordem dos botões e a métrica principal.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Evite medir apenas visualizações. Uma página pode receber acessos e ainda assim não ajudar
          o negócio se o botão principal estiver escondido, se o formulário for longo ou se o
          visitante não entender qual será o próximo passo. Faça um teste simples: alguém que
          conheceu a marca há poucos segundos consegue saber o que fazer sem explicação adicional?
        </p>

        <h2 className="mt-10 text-2xl font-bold">2. Avalie a experiência presencial e remota</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Em uma reunião, feira, recepção ou balcão, o cartão físico pode abrir rapidamente um
          perfil quando aproximado do celular. Segundo o NFC Forum, NFC é uma comunicação sem
          contato de curtíssimo alcance, normalmente de até 2 cm; a organização também explica que
          tags podem carregar uma mensagem NDEF, inclusive um endereço da web. Isso ajuda a entender
          o limite: aproximação não é uma transmissão a longa distância nem substitui a página que o
          cliente vai consultar.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Na prática, não dependa de um único gesto. Deixe o QR Code visível, ofereça um link que
          possa ser copiado e descreva a ação com clareza. O QR Code atende situações em que o
          celular não lê a tag, o cliente prefere usar a câmera ou a conversa acontece a distância.
          No artigo
          <Link
            to="/guia/cartao-de-visita-por-aproximacao"
            className="font-semibold text-primary hover:underline"
          >
            como funciona um cartão de visita por aproximação
          </Link>
          , você encontra o passo a passo dessa experiência.
        </p>

        <h3 className="mt-8 text-xl font-bold">
          Limites e compatibilidade que precisam aparecer no briefing
        </h3>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>
            NFC exige que o aparelho tenha suporte e que a leitura seja possível naquele contexto;
            não prometa funcionamento em qualquer celular.
          </li>
          <li>
            A distância é curta por definição. O NFC Forum descreve a tecnologia na faixa de 13,56
            MHz e destaca o uso de um toque ou aproximação, não de uma conexão de vários metros.
          </li>
          <li>
            O cliente precisa de conexão para carregar um destino online, salvo quando a solução
            tiver outro fluxo previamente planejado. Teste a página em redes móveis diferentes.
          </li>
          <li>
            QR Code não elimina a necessidade de uma boa página: ele somente oferece outra porta de
            entrada para o mesmo conteúdo.
          </li>
        </ul>

        <h2 className="mt-10 text-2xl font-bold">3. Compare a solução pela operação da equipe</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Para uma pessoa, editar um único perfil é simples. Para uma empresa, o ponto decisivo é o
          processo: quem cria os perfis, quem aprova alterações, como a marca é padronizada e o que
          acontece quando alguém muda de função ou deixa a organização. Uma boa contratação deve
          reduzir retrabalho, não criar uma planilha paralela difícil de manter.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-card">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-bold">Critério</th>
                <th className="px-4 py-3 font-bold">Pergunta para a empresa</th>
                <th className="px-4 py-3 font-bold">Sinal de maturidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Perfis</td>
                <td className="px-4 py-3">Cada colaborador precisa de um link próprio?</td>
                <td className="px-4 py-3">A estrutura acompanha equipes, unidades e funções.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Atualização</td>
                <td className="px-4 py-3">Quem altera telefone, cargo e links?</td>
                <td className="px-4 py-3">Há responsável, revisão e mudança sem reimpressão.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Leads</td>
                <td className="px-4 py-3">Para onde vai um formulário ou clique de contato?</td>
                <td className="px-4 py-3">
                  O destino, a responsabilidade e o retorno estão claros.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Desligamento</td>
                <td className="px-4 py-3">O acesso e o destino podem ser revogados?</td>
                <td className="px-4 py-3">Existe rotina de saída e revisão dos links ativos.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground">Marca</td>
                <td className="px-4 py-3">A identidade visual fica consistente?</td>
                <td className="px-4 py-3">Modelos e campos obrigatórios reduzem erros.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-2xl font-bold">4. Escolha métricas que respondem a decisões</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          No Google Analytics, eventos servem para medir uma interação específica, como carregar uma
          página, clicar em um link ou concluir uma compra. Para um cartão empresarial, é mais útil
          começar com poucas ações bem definidas do que instalar dezenas de eventos sem uso.
          Exemplos de eventos a configurar, conforme o objetivo, são clique no WhatsApp, clique para
          ligar, salvamento de contato, envio de lead e acesso ao catálogo.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          O próprio Google diferencia eventos recomendados de eventos personalizados e alerta que os
          personalizados exigem relatórios ou análises adequadas para gerar significado. Portanto,
          combine um nome consistente, um responsável e uma pergunta de negócio: qual perfil gerou
          mais contatos qualificados? Qual unidade recebe mais acessos? Qual campanha leva a mais
          pedidos? Valide os eventos no relatório em tempo real e no DebugView antes de comparar
          resultados.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Métrica também precisa respeitar privacidade. Se o site usa Google Analytics ou outras
          tags, não trate consentimento como um detalhe visual. A documentação do Google Tag Manager
          explica que o modo de consentimento comunica o status escolhido pelo visitante e ajusta o
          comportamento das tags. Ele não cria sozinho um banner: a implementação precisa conectar a
          ferramenta de consentimento às tags e testar os estados permitido e negado.
        </p>

        <h2 className="mt-10 text-2xl font-bold">
          5. Faça uma verificação de privacidade e controle
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Um cartão de visita costuma expor dados profissionais, mas a operação pode envolver nomes,
          telefones, mensagens, formulários, identificadores e dados de navegação. Antes de
          contratar, peça uma explicação objetiva sobre coleta, finalidade, retenção, acesso
          administrativo, provedores e exclusão. Evite enviar para a plataforma dados que não sejam
          necessários para o objetivo definido.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A ANPD disponibiliza um Guia Orientativo sobre Segurança da Informação para Agentes de
          Tratamento de Pequeno Porte, um checklist de medidas e um modelo de registro das
          operações. Esses materiais são bons pontos de partida para organizar responsáveis, acessos
          e riscos; eles não substituem uma avaliação jurídica da operação concreta. Se houver
          tratamento de dados de clientes, alinhe a solução à política de privacidade da empresa e
          mantenha uma rotina para revisar permissões quando alguém muda de função.
        </p>

        <h2 className="mt-10 text-2xl font-bold">Checklist antes de decidir</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            "Objetivo e chamada para ação definidos",
            "Página rápida e legível no celular",
            "Link, QR Code e NFC usados como entradas complementares",
            "Perfis, permissões e desligamentos planejados",
            "Eventos ligados a leads, contatos ou vendas",
            "Relatório validado em tempo real e no DebugView",
            "Coleta, finalidade e consentimento explicados",
            "Exportação, suporte, limites e custo documentados",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-border bg-card p-4 text-sm font-semibold"
            >
              {item}
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold">Exemplos de uso empresarial</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            [
              "Equipe comercial",
              "Cada vendedor compartilha seu perfil, catálogo e canal de atendimento. A empresa compara cliques e contatos por campanha, sem depender apenas de cartões impressos.",
            ],
            [
              "Recepção e eventos",
              "Um cartão físico com NFC e QR Code leva a uma página institucional, agenda ou formulário. A sinalização explica a ação para reduzir dúvidas na fila.",
            ],
            [
              "Unidades e franquias",
              "O visitante escolhe a unidade correta, consulta o canal local e encontra a equipe responsável. A administração mantém a identidade e revisa os destinos.",
            ],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold">Perguntas frequentes</h2>
        <section className="mt-5 space-y-4">
          {questions.map(({ question, answer }) => (
            <div key={question} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-3xl border border-border bg-card p-7">
          <h2 className="text-2xl font-bold">Fontes de referência</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Este guia foi elaborado a partir de documentação oficial do NFC Forum, Google Search
            Central, Google Analytics, Google Tag Manager e ANPD. Consulte as orientações completas
            antes de definir sua implementação.
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed">
            <li>
              <a
                href="https://nfc-forum.org/learn/nfc-technology/"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                NFC Forum: NFC Technology
              </a>
            </li>
            <li>
              <a
                href="https://developers.google.com/search/docs/appearance/title-link"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Google Search Central: title links
              </a>
            </li>
            <li>
              <a
                href="https://support.google.com/analytics/answer/9322688?hl=pt-BR"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Google Analytics: eventos
              </a>
            </li>
            <li>
              <a
                href="https://support.google.com/tagmanager/answer/10000067?hl=pt-BR"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Google Tag Manager: modo de consentimento
              </a>
            </li>
            <li>
              <a
                href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                ANPD: segurança da informação para pequeno porte
              </a>
            </li>
          </ul>
        </section>

        <div className="mt-12 rounded-3xl border border-primary/30 bg-primary/10 p-7">
          <h2 className="text-2xl font-bold">Pronto para levar essa experiência para a equipe?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Conheça o cartão de bolso GCard-PRÓ e escolha um destino que faça sentido para o seu
            negócio. Comece com um objetivo claro e evolua a operação conforme a equipe aprende.
          </p>
          <Link
            to="/comprar"
            search={{ caminho: "lojista" }}
            className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Ver opções para empresas
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
