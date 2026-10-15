import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";

// Links dos modelos do Canva, por nicho. Enquanto estiver TODO_LINKS_CANVA a tela mostra "em breve".
const CANVA_TEMPLATES: { label: string; url: string }[] = [
  { label: "Modelo 10x10", url: "TODO_LINKS_CANVA" },
  { label: "Modelo 10x15", url: "TODO_LINKS_CANVA" },
];

const GABARITOS = [
  { label: "Gabarito 10x10 (SVG)", href: "/gabaritos/gabarito-10x10.svg" },
  { label: "Gabarito 10x15 (SVG)", href: "/gabaritos/gabarito-10x15.svg" },
];

export const Route = createFileRoute("/personalizar")({
  head: () => ({
    meta: [
      { title: "Como personalizar sua placa GCard-PRÓ | Passo a passo" },
      {
        name: "description",
        content:
          "Compre o acrílico com NFC, ative o código, baixe o QR e coloque na sua arte. Passo a passo, gabaritos e checklist de teste.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.gcardpro.com.br/personalizar" }],
  }),
  component: Personalizar,
});

const STEPS = [
  {
    title: "Compre o acrílico com NFC e escolha a cor",
    text: "O acrílico + NFC chega sem arte impressa. Cada unidade tem um código próprio, e o NFC já vem gravado com esse código. Cores: cristal, branco, preto e azul.",
  },
  {
    title: "Ative o código e cole o link de destino",
    text: "No painel (gcardpro.com.br/ativar), abra o código da sua placa e cole o link para onde ela deve levar: uma avaliação do Google ou uma página do TOQY. Você pode trocar quando quiser, sem reimprimir.",
  },
  {
    title: "Baixe o QR do código",
    text: "No painel, clique em Baixar QR. SVG e PDF são vetoriais (bons para gráfica); PNG é para colocar no Canva. Se o adesivo for colado por trás do acrílico, baixe a versão espelhada.",
  },
  {
    title: "Coloque o QR na sua arte",
    text: "Use os gabaritos abaixo (10x10 e 10x15) com a área do QR marcada. Mantenha o QR escuro em fundo claro, sem degradê atrás, com pelo menos 2,5 a 3 cm de lado e a margem branca que já vem no arquivo.",
  },
  {
    title: "Imprima, cole o NFC atrás da placa e teste",
    text: "Antes de imprimir um lote, teste a leitura do QR e do NFC em pelo menos dois celulares (um iPhone e um Android) e com pouca luz.",
  },
];

const CHECKLIST = [
  "O QR tem pelo menos 2,5 cm de lado, impresso.",
  "O QR está escuro em fundo claro, sem degradê nem foto atrás.",
  "A margem branca ao redor do QR não foi cortada nem coberta.",
  "Se o adesivo vai por trás do acrílico, usei a versão espelhada.",
  "Li o QR com a câmera de um iPhone e de um Android.",
  "Aproximei o celular do NFC e abriu o destino certo.",
  "Troquei o destino no painel e conferi que o novo link abre (vale na hora).",
];

function Personalizar() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="bg-foreground text-white">
        <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Passo a passo</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">Como personalizar sua placa</h1>
          <p className="mt-3 text-white/70">
            Do acrílico com NFC até a placa pronta com a sua arte. Sem complicação e sem precisar de programa especial.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-12">
        <ol className="space-y-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5 card-soft">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-black text-primary-foreground">{i + 1}</span>
              <div>
                <h2 className="text-lg font-bold">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-2xl border border-border bg-card p-6 card-soft">
          <h2 className="text-xl font-bold">Gabaritos para baixar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Com a área segura e a área do QR marcadas. Importe no Canva e apague as marcações antes de imprimir.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {GABARITOS.map((g) => (
              <Button key={g.href} asChild variant="outline" className="rounded-xl">
                <a href={g.href} download>{g.label}</a>
              </Button>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Modelos no Canva</h3>
          <div className="mt-2 flex flex-wrap gap-3">
            {CANVA_TEMPLATES.map((t) =>
              t.url.startsWith("TODO") ? (
                <span key={t.label} className="rounded-xl border border-dashed border-border px-4 py-2 text-sm text-muted-foreground">{t.label}: em breve</span>
              ) : (
                <Button key={t.label} asChild variant="outline" className="rounded-xl">
                  <a href={t.url} target="_blank" rel="noopener noreferrer">{t.label}</a>
                </Button>
              ),
            )}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-card p-6 card-soft">
          <h2 className="text-xl font-bold">Checklist de teste antes de imprimir</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {CHECKLIST.map((c) => (
              <li key={c} className="flex gap-2"><span aria-hidden>☐</span><span>{c}</span></li>
            ))}
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-xl font-bold"><Link to="/produtos">Ver produtos</Link></Button>
          <Button asChild size="lg" variant="outline" className="rounded-xl font-bold"><Link to="/ativar">Ir para o meu painel</Link></Button>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
