import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

const VIDEO_ID = "6nDW3OCKcAA";
const TITLE = "Como configurar e ativar sua placa ou cartão GCard-PRÓ (passo a passo)";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Entre no painel com o e-mail da compra",
    body: "Acesse gcardpro.com.br/ativar e entre com o mesmo e-mail usado no pedido. Se o e-mail for diferente, os seus lotes não aparecem.",
  },
  {
    title: "Resgate o lote (se você recebeu um código)",
    body: "No topo do painel, no campo “Recebeu um lote novo? Resgate pelo código”, digite o código do lote (ex.: L-260915-AB12CD) e clique em Resgatar lote.",
  },
  {
    title: "Encontre o código da placa",
    body: "Cada placa e cada cartão tem o seu código (ex.: GCARD-00001). Abra o lote na lista, ou use a busca por código ou nome do negócio. Dá para ordenar por código, data de ativação ou nome do negócio.",
  },
  {
    title: "Pegue o link de avaliação do Google",
    body: "Você precisa do link direto de “Avaliar” do negócio. Se ainda não tem, use o gerador de link de avaliação grátis aqui no site.",
  },
  {
    title: "Informe o negócio, cole o link e clique em Ativar",
    body: "Na placa escolhida, preencha o Nome do negócio, cole o Link de Avaliação do Google e clique em Ativar. A partir daí, o QR Code e o NFC dessa placa abrem a avaliação do cliente.",
  },
  {
    title: "Teste",
    body: "Aponte a câmera para o QR Code, ou aproxime o celular do NFC, e confira se abre a tela de avaliação do negócio certo.",
  },
  {
    title: "Troque o link quando quiser",
    body: "O QR Code e o NFC guardam um código, não o link. Para mudar o destino, edite o link da placa no mesmo painel: não precisa reimprimir nem regravar nada.",
  },
];

export const Route = createFileRoute("/guia/como-configurar-placa-gcard")({
  head: () => ({
    meta: [
      { title: `${TITLE} | GCard-PRÓ` },
      {
        name: "description",
        content:
          "Tutorial em vídeo e passo a passo para ativar sua placa ou cartão GCard-PRÓ, colar o link de avaliação do Google e trocar o destino quando quiser.",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: TITLE },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://www.gcardpro.com.br/guia/como-configurar-placa-gcard" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: TITLE,
          step: STEPS.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.body })),
        }),
      },
    ],
  }),
  component: Tutorial,
});

function Tutorial() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link to="/guia" className="text-sm text-muted-foreground hover:text-foreground">
          ← Guia
        </Link>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-primary-foreground/80">Tutorial</p>
        <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{TITLE}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Em poucos minutos a placa fica apontando para a avaliação do seu cliente. Assista ao vídeo ou siga o passo a passo abaixo.
        </p>

        <div className="mt-8 aspect-video overflow-hidden rounded-3xl bg-foreground shadow-lg">
          <iframe
            className="size-full"
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0&modestbranding=1`}
            title="Aprenda a Configurar o QRCODE"
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>

        <section className="mt-10 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Comprou para o seu próprio negócio?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Na loja própria a placa ou o cartão já chega gravado com o link de avaliação do seu negócio: é só usar. Os passos abaixo valem para quem comprou para revenda (QR/NFC em branco) ou quer trocar o link depois.
          </p>
        </section>

        <h2 className="mt-12 text-2xl font-bold">Passo a passo</h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-black text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-bold leading-snug">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-3xl bg-foreground p-6 text-white">
          <h2 className="text-xl font-bold">Cartão de bolso: gravar a aproximação (NFC)</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            Abra o app <strong className="text-white">NFC Tools</strong> (grátis, Android e iPhone) → <em>Escrever</em> → <em>Adicionar registro</em> → <em>URL</em>. Cole o link do cartão e encoste o celular no chip.
          </p>
        </section>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/ativar" className="inline-flex h-14 items-center justify-center rounded-xl bg-primary px-7 text-base font-bold text-primary-foreground">
            Acessar meu painel →
          </Link>
          <Link to="/" hash="gerar-link" className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-foreground/30 px-7 text-base font-bold">
            Gerar link de avaliação grátis
          </Link>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
