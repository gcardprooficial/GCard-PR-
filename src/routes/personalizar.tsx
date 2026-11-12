import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { useEffect } from "react";
import { ArrowRight, Download } from "lucide-react";
import { money, resolveUnitPrice } from "@/lib/pricing";
import { catalogQuery, plansFrom } from "@/lib/site-catalog";

// Links dos modelos do Canva, por nicho. Enquanto estiver TODO_LINKS_CANVA a tela mostra "em breve".
const CANVA_TEMPLATES: { label: string; url: string }[] = [
  { label: "Modelo 10x10", url: "TODO_LINKS_CANVA" },
  { label: "Modelo 10x15", url: "TODO_LINKS_CANVA" },
];

const GABARITOS = [
  { label: "Gabarito 10x10 (SVG)", href: "/gabaritos/gabarito-10x10.svg" },
  { label: "Gabarito 10x15 (SVG)", href: "/gabaritos/gabarito-10x15.svg" },
];

const KITS = [
  { slug: "acrilico-10x10-sem-arte", label: "Acrílico 10x10 (quadrado)", kit: "personalizar" },
  { slug: "acrilico-15x10-l-sem-arte", label: "Acrílico 15x10 (em L)", kit: "personalizar-l" },
] as const;
const KIT_QUANTITY = 10;

export const Route = createFileRoute("/personalizar")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
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
    title: "Compre o acrílico liso e escolha receber o QR Code",
    text: "Na compra do acrílico liso (10x10 quadrado ou 15x10 em L), responda Sim em “Quer o QR Code?”. É grátis e cada unidade recebe um código. Se quiser NFC, marque também o chip (ele vai vazio). Cores: cristal, branco, preto e azul.",
  },
  {
    title: "Ative o código e cole o link de destino",
    text: "No painel (gcardpro.com.br/ativar), abra o código da sua placa e cole o link para onde ela deve levar: qualquer link https (avaliação do Google, TOQY, Instagram, seu site). Você pode trocar quando quiser, sem reimprimir.",
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
    title: "Imprima, grave o chip NFC e teste",
    text: "O chip NFC chega vazio. No painel, use “Copiar URL NFC” do código e grave no chip com o app NFC Tools. Cole o chip atrás da placa e teste a leitura do QR e do NFC em pelo menos dois celulares (um iPhone e um Android).",
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

function KitPrices() {
  const { data } = useSuspenseQuery(catalogQuery);
  const { revenda } = plansFrom(data);
  const rows = KITS.map((k) => {
    const product = data.products.find((p) => p.slug === k.slug && p.status === "ativo");
    if (!product) return null;
    // Mesma conta do checkout: preço por unidade na quantidade do kit, cor cristal (sem adicional).
    const unit = resolveUnitPrice(revenda, product, KIT_QUANTITY, true, 0);
    const chip = product.nfc_addon_price_cents ?? 0;
    return { ...k, unit, chip, total: unit * KIT_QUANTITY + chip * KIT_QUANTITY };
  }).filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return null;
  return (
    <section className="lp-sec">
      <div className="lp-head2 rv"><div className="lp-label">Kit para personalizar</div><h2 className="lp-h2">Comece pelo acrílico liso.</h2>
        <p className="lp-sub">O QR de cada placa é grátis; o chip NFC é opcional. O kit já abre com {KIT_QUANTITY} unidades, QR e chip marcados; você muda quantidade, cor e chip na compra.</p></div>
      <div className="gl-grid rv">
        {rows.map((r) => (
          <div key={r.slug} className="card col" style={{ gap: 6, flex: "1 1 300px", maxWidth: 420 }}>
            <b>{r.label}</b>
            <span className="sm muted">{money(r.unit)} por unidade (a partir de {KIT_QUANTITY} un.) · cor cristal</span>
            <span className="sm muted">QR grátis{r.chip > 0 ? ` · chip NFC ${money(r.chip)} por unidade` : ""}</span>
            <span className="sm">Kit de {KIT_QUANTITY}{r.chip > 0 ? " com chip" : ""}: <b>{money(r.total)}</b></span>
            <Link to="/comprar" search={{ kit: r.kit }} className="btn primary" style={{ marginTop: 6, alignSelf: "flex-start" }}>Montar este kit <ArrowRight size={16} /></Link>
          </div>
        ))}
      </div>
      <p className="xs muted center" style={{ marginTop: 12 }}>Cores como branco, preto e azul podem ter pequeno adicional por unidade. O total final aparece na compra.</p>
    </section>
  );
}

function Personalizar() {
  useEffect(() => {
    const els = document.querySelectorAll(".lp .rv");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="v2">
      <div className="lp">
        <div className="lp-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>
        <SiteHeader />
        <main className="lp-col">
          <section className="lp-hero" style={{ textAlign: "center" }}>
            <div className="rv" style={{ maxWidth: 760, margin: "0 auto" }}>
              <div className="lp-label">Passo a passo</div>
              <h1 className="lp-h1">Como <span className="accent">personalizar</span> sua placa</h1>
              <p className="lp-lead">Do acrílico com NFC até a placa pronta com a sua arte. Sem complicação e sem precisar de programa especial.</p>
            </div>
          </section>

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Em 5 passos</div><h2 className="lp-h2">Da compra à placa pronta.</h2></div>
            <div className="col rv" style={{ maxWidth: 820, margin: "0 auto", gap: 12 }}>
              {STEPS.map((s, i) => (
                <div key={s.title} className="card row" style={{ gap: 16, alignItems: "flex-start" }}>
                  <span className="lp-num">{i + 1}</span>
                  <div><b>{s.title}</b><p className="sm muted" style={{ marginTop: 4 }}>{s.text}</p></div>
                </div>
              ))}
            </div>
          </section>

          <KitPrices />

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Arquivos</div><h2 className="lp-h2">Gabaritos para baixar.</h2>
              <p className="lp-sub">Com a área segura e a área do QR marcadas. Importe no Canva e apague as marcações antes de imprimir.</p></div>
            <div className="row wrap rv" style={{ gap: 10, justifyContent: "center" }}>
              {GABARITOS.map((g) => (
                <a key={g.href} href={g.href} download className="btn"><Download size={15} /> {g.label}</a>
              ))}
              {CANVA_TEMPLATES.map((t) =>
                t.url.startsWith("TODO") ? (
                  <span key={t.label} className="badge">{t.label} no Canva: em breve</span>
                ) : (
                  <a key={t.label} href={t.url} target="_blank" rel="noopener noreferrer" className="btn">{t.label} no Canva</a>
                ),
              )}
            </div>
          </section>

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Antes de imprimir</div><h2 className="lp-h2">Checklist de teste.</h2></div>
            <div className="card col rv" style={{ maxWidth: 820, margin: "0 auto", gap: 10 }}>
              {CHECKLIST.map((c) => (
                <label key={c} className="row sm" style={{ gap: 10, alignItems: "flex-start" }}><input type="checkbox" style={{ marginTop: 3 }} /><span>{c}</span></label>
              ))}
            </div>
          </section>

          <section className="lp-sec lp-final">
            <div className="center rv">
              <div className="row wrap" style={{ gap: 8, justifyContent: "center" }}>
                <Link to="/produtos" className="btn primary">Ver produtos <ArrowRight size={16} /></Link>
                <Link to="/ativar" className="btn">Ir para o meu painel</Link>
              </div>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
