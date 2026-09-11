import { createFileRoute, Link } from "@tanstack/react-router";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.png";
export const Route = createFileRoute("/guia/melhor-cartao-digital-para-empresa")({
  head: () => ({
    meta: [
      { title: "Qual o melhor cartão de visita digital para uma empresa? | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Veja os critérios para escolher um cartão de visita digital para empresa: objetivo, equipe, edição, métricas, NFC, QR Code e privacidade.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
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
      <article>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          Guia para empresas
        </p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
          Qual é o melhor cartão de visita digital para uma empresa?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          A melhor solução não é a que tem mais recursos no papel. É a que torna o próximo passo
          claro para o cliente e simples para a equipe operar.
        </p>
        <h2 className="mt-12 text-2xl font-bold">1. Comece pelo objetivo</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Uma empresa pode querer compartilhar contatos, receber mensagens, divulgar um catálogo,
          gerar leads ou aumentar avaliações. Definir o objetivo evita escolher uma ferramenta que
          só acumula funções.
        </p>
        <h2 className="mt-10 text-2xl font-bold">2. Avalie a experiência presencial</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Se vendedores, recepcionistas ou atendentes encontram clientes presencialmente, NFC e QR
          Code podem reduzir o tempo entre a conversa e o acesso ao perfil, formulário ou avaliação.
        </p>
        <h2 className="mt-10 text-2xl font-bold">3. Confira a operação da equipe</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>É possível atualizar os dados sem reimprimir o cartão?</li>
          <li>Cada colaborador pode ter um perfil ou destino próprio?</li>
          <li>Há métricas úteis, e não apenas números decorativos?</li>
          <li>O processo de saída de um colaborador é seguro?</li>
        </ul>
        <h2 className="mt-10 text-2xl font-bold">4. Considere custo e privacidade</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Compare custo inicial, mensalidade, limites de uso e exportação de dados. Verifique também
          quais dados são coletados, para qual finalidade e como o consentimento é tratado.
        </p>
        <h2 className="mt-10 text-2xl font-bold">Checklist rápido</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            "Página rápida no celular",
            "NFC e QR Code",
            "Edição simples",
            "Métricas compreensíveis",
            "Suporte para equipe",
            "Política de privacidade clara",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-border bg-card p-4 text-sm font-semibold"
            >
              {item}
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-3xl border border-primary/30 bg-primary/10 p-7">
          <h2 className="text-2xl font-bold">Para começar com um cartão físico configurado</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Conheça o cartão de bolso GCard-PRÓ para aproximar do celular e levar o cliente ao
            destino correto.
          </p>
          <Link
            to="/comprar"
            search={{ caminho: "lojista" }}
            className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Ver opções
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
