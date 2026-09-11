import { createFileRoute, Link } from "@tanstack/react-router";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.png";
export const Route = createFileRoute("/guia/cartao-de-visita-por-aproximacao")({
  head: () => ({
    meta: [
      { title: "Como funciona um cartão de visita por aproximação? | GCard-PRÓ" },
      {
        name: "description",
        content:
          "Entenda como funciona um cartão de visita por aproximação, o papel do NFC, do QR Code e o que o cliente vê no celular.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
    ],
  }),
  component: Article,
});
function Article() {
  return (
    <Page>
      <article>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Como funciona</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
          Como funciona um cartão de visita por aproximação?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Um cartão de visita por aproximação usa NFC para abrir um link quando é encostado ou
          aproximado de um celular compatível. O cartão não precisa de bateria: o aparelho fornece a
          energia necessária para ler o chip.
        </p>
        <h2 className="mt-12 text-2xl font-bold">O que acontece na prática?</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-relaxed text-muted-foreground">
          <li>A empresa configura o destino do cartão, como um perfil, catálogo ou avaliação.</li>
          <li>O cliente aproxima o celular do cartão.</li>
          <li>O aparelho reconhece o chip NFC e mostra uma notificação ou abre o link.</li>
          <li>O cliente toca no link e realiza a ação desejada.</li>
        </ol>
        <h2 className="mt-10 text-2xl font-bold">Por que usar QR Code junto?</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          O QR Code oferece uma alternativa visual: o cliente pode apontar a câmera quando a
          aproximação não for conveniente ou quando o aparelho não tiver NFC disponível. A
          combinação torna a experiência mais inclusiva.
        </p>
        <h2 className="mt-10 text-2xl font-bold">O que faz uma boa experiência?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Clareza", "Explique onde aproximar e qual ação será aberta."],
            ["Velocidade", "A página precisa carregar bem no celular."],
            ["Confiança", "Mostre a marca e a finalidade do link."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-3xl bg-foreground p-7 text-background">
          <h2 className="text-2xl font-bold">Leve essa experiência para o seu balcão</h2>
          <p className="mt-2 text-sm opacity-75">
            O GCard-PRÓ é um cartão NFC de bolso entregue configurado para o seu negócio.
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
