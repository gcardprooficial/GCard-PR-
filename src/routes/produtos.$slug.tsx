import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackClientEvent } from "@/lib/events.functions";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Minus, Plus, ShieldCheck, Truck, Wallet } from "lucide-react";
import { money } from "@/lib/pricing";
import { DeliveryTimes, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { MERCADO_LIVRE_LINKS, PRODUCT_IMAGES, SHOW_MERCADO_LIVRE, mockupsFor, catalogQuery, plansFrom, productsFrom, resaleLines } from "@/lib/site-catalog";
import { PIX_DISCOUNT_PCT, PIX_DISCOUNT_UNTIL_LABEL, pixDiscountActive, pixDiscountCents } from "@/lib/promo";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";

export const Route = createFileRoute("/produtos/$slug")({
  // Abrir o link direto (sem passar pela home) começava com o catálogo vazio, só o fallback de 3 produtos, e
  // dava 404 em qualquer outro (10x15, Pix, WhatsApp, Instagram, tag). Carrega o catálogo de verdade antes de renderizar.
  loader: ({ context }) => context.queryClient.fetchQuery(catalogQuery).catch(() => null),
  head: ({ params, loaderData }) => {
    // Título com o nome do produto (antes saía o endereço, ex.: "plaquinha-10x10").
    const name = (loaderData as { products?: { slug: string; name: string }[] } | null | undefined)?.products?.find((p) => p.slug === params.slug)?.name;
    return {
      meta: [{ title: `${name ?? params.slug} | GCard-PRÓ` }],
      links: [{ rel: "canonical", href: `https://www.gcardpro.com.br/produtos/${params.slug}` }],
    };
  },
  component: Produto,
});

/** Produto liso que tem atalho de kit em /comprar?kit=. */
const kitParamFor = (slug: string) =>
  slug === "acrilico-10x10-sem-arte" ? ("personalizar" as const) : slug === "acrilico-15x10-l-sem-arte" ? ("personalizar-l" as const) : null;

const FAQ_P: [string, string][] = [
  ["Preciso de aplicativo para ler?", "Não. O NFC abre direto no celular e o QR Code abre pela câmera."],
  ["Posso trocar o link depois?", "Pode, e vale na hora. O endereço fica guardado no sistema, não no chip nem no QR."],
  ["Como ativo cada código?", "Você entra em Ativar meus códigos com o e-mail da compra, informa o negócio e cola o link do seu cliente."],
];

type Tier = { min_quantity: number; unit_price_cents: number; label?: string | null };
export type ProdutoViewProps = {
  name: string;
  format: string;
  slug: string;
  image: string;
  gallery: string[];
  hasNfc: boolean;
  hasQr: boolean;
  isBlank: boolean;
  isSupply: boolean;
  soon: boolean;
  minQty: number;
  step: number;
  tiers: Tier[];
  nfcAddonCents: number | null;
  kitParam: "personalizar" | "personalizar-l" | null;
  mercadoLivreUrl: string | null;
  pixOn: boolean;
  others: { slug: string; name: string; image: string }[];
};

/** Parte visual da página de produto (sem banco), igual ao protótipo. */
export function ProdutoView(p: ProdutoViewProps) {
  const [qty, setQty] = useState(p.minQty);
  const [pic, setPic] = useState(0);
  const [chip, setChip] = useState(false);
  const [wantQr, setWantQr] = useState(false);
  useEffect(() => {
    const els = document.querySelectorAll(".lp .rv");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [p.slug]);

  const tierFor = (n: number) => [...p.tiers].reverse().find((t) => n >= t.min_quantity) ?? p.tiers[0];
  const t = tierFor(qty);
  const unit = t?.unit_price_cents ?? 0;
  const nfcOnly = p.hasNfc && !p.hasQr && !p.isBlank && !p.isSupply;
  const chipCents = p.isBlank && chip && p.nfcAddonCents ? p.nfcAddonCents * qty : 0;
  const total = unit * qty + chipCents;
  const pixOff = p.pixOn && !p.isBlank && !p.isSupply ? pixDiscountCents(total, 1) : 0;
  const stage = pic === 0 ? p.image : (p.gallery[pic - 1] ?? p.image);
  const step = (d: number) => setQty(Math.max(p.minQty, qty + d * Math.max(1, p.step)));
  const quick = (p.step > 1 ? [p.minQty, p.minQty * 2, p.minQty * 4] : [p.minQty, 25, 100]).filter((n) => n >= p.minQty);

  return (
    <div className="v2">
      <div className="lp">
        <div className="lp-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>
        <SiteHeader />
        <main className="lp-col gp">
          <Link to="/produtos" className="btn ghost" style={{ padding: "4px 0", alignSelf: "flex-start" }}><ArrowLeft size={16} /> Todos os produtos</Link>

          <div className="gp-grid">
            <div className="col" style={{ gap: 12 }}>
              <div className="gp-stage">
                <img key={stage} src={stage} alt={p.name} style={p.isBlank || p.isSupply ? { objectFit: "contain", padding: 24 } : undefined} />
                <div className="gp-badges">
                  {p.hasNfc && <span className="gp-badge">NFC</span>}
                  {p.hasQr && <span className="gp-badge">QR Code</span>}
                  {p.soon && <span className="gp-badge">Em breve</span>}
                </div>
              </div>
              {p.gallery.length > 0 && (
                <div className="gp-thumbs">
                  {[p.image, ...p.gallery].map((g, i) => (
                    <button key={`${g}-${i}`} type="button" className={`gp-thumb ${pic === i ? "on" : ""}`} onClick={() => setPic(i)} aria-label={`Foto ${i + 1}`}><img src={g} alt="" /></button>
                  ))}
                </div>
              )}
            </div>

            <div className="gp-info">
              <div className="gp-kicker">Kit para revenda · preço por unidade · frete grátis</div>
              <h1 className="gp-title">{p.name}</h1>
              <p className="gp-official">{p.format}</p>

              {p.pixOn && !p.isBlank && !p.isSupply && <div className="gp-pix"><b>{PIX_DISCOUNT_PCT}% OFF</b> pagando no Pix até {PIX_DISCOUNT_UNTIL_LABEL}</div>}

              {p.tiers.length > 0 && (
                <div className="gp-tiers" role="group" aria-label="Faixas de preço">
                  {p.tiers.map((x) => (
                    <button key={x.min_quantity} type="button" className={`gp-tier ${x.min_quantity === t?.min_quantity ? "on" : ""}`} onClick={() => setQty(Math.max(p.minQty, x.min_quantity))}>
                      <span className="xs">{x.label ?? `${x.min_quantity}+ un.`}</span><b>{money(x.unit_price_cents)}</b><span className="xs">por unidade</span>
                    </button>
                  ))}
                </div>
              )}

              {p.soon ? (
                <button type="button" disabled className="btn block">Em breve</button>
              ) : (
                <div className="gp-buy">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="sm grow"><b>Quantidade</b> <span className="muted">(mínimo {p.minQty}{p.step > 1 ? `, de ${p.step} em ${p.step}` : ""})</span></span>
                    <div className="gp-qty">
                      <button type="button" aria-label="Menos" onClick={() => step(-1)} disabled={qty <= p.minQty}><Minus size={15} /></button>
                      <b>{qty}</b>
                      <button type="button" aria-label="Mais" onClick={() => step(1)}><Plus size={15} /></button>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{quick.map((n) => <button key={n} type="button" className={`chip ${qty === n ? "on" : ""}`} onClick={() => setQty(n)}>{n}</button>)}</div>
                  {p.isBlank && (
                    <div className="col" style={{ gap: 8 }}>
                      {p.nfcAddonCents ? (
                        <label className="row sm" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
                          <input type="checkbox" checked={chip} onChange={(e) => setChip(e.target.checked)} style={{ marginTop: 3 }} />
                          <span className="grow"><b>Chip NFC em cada unidade</b> <span className="muted">(+ {money(p.nfcAddonCents)} cada)</span><br /><span className="xs muted">Enviamos solto, você cola na placa.</span></span>
                        </label>
                      ) : null}
                      <label className="row sm" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
                        <input type="checkbox" checked={wantQr} onChange={(e) => setWantQr(e.target.checked)} style={{ marginTop: 3 }} />
                        <span className="grow"><b>QR Code de cada placa</b> <span className="muted">(grátis)</span><br /><span className="xs muted">Quer trocar o destino depois sem reimprimir? Use o <Link to="/plus" style={{ textDecoration: "underline" }}><b>GCard Plus</b></Link>.</span></span>
                      </label>
                    </div>
                  )}
                  <div className="gp-total">
                    <div className="row sm"><span className="grow muted">{qty} × {money(unit)}{chipCents ? ` + chips ${money(chipCents)}` : ""}</span></div>
                    <div className="row"><b className="grow">Total estimado</b><b className="gp-sum">{money(total)}</b></div>
                    {pixOff > 0 && <div className="row sm" style={{ color: "var(--brand-text)" }}><span className="grow">No Pix, com {PIX_DISCOUNT_PCT}% OFF</span><b>{money(total - pixOff)}</b></div>}
                  </div>
                  <Link to="/comprar" search={{ produto: p.slug, qtd: qty, ...(p.isBlank ? { chip: chip ? 1 : 0, qr: wantQr ? 1 : 0 } : {}) }} className="btn primary block" data-analytics-event="begin_checkout" data-analytics-label={`produto ${p.slug}`}>Comprar este kit</Link>
                  <p className="xs muted" style={{ margin: 0 }}>{p.isBlank || p.isSupply ? `Vendido só para revendedores, a partir de ${p.minQty} unidades. A quantidade escolhida aqui segue para a compra.` : nfcOnly ? "Chega com o chip NFC em branco; você grava o link com o app NFC Tools. A quantidade escolhida aqui segue para a compra." : "Chega com QR/NFC em branco; você ativa cada código com o link do seu cliente. A quantidade escolhida aqui segue para a compra."}</p>
                </div>
              )}

              {p.mercadoLivreUrl && <a href={p.mercadoLivreUrl} target="_blank" rel="noopener noreferrer" className="btn block">Também no Mercado Livre →</a>}
            </div>
          </div>

          {p.isBlank && (
            <section className="gp-sec rv">
              <div className="gp-plus">
                <div className="row" style={{ gap: 8, justifyContent: "center" }}><span className="plustag">GCard Plus</span><b>Vai precisar do QR Code?</b></div>
                <span className="sm muted">Com o Plus o QR da sua placa vira <b>dinâmico</b>: você troca o destino quando quiser, programa por horário e data e acompanha as leituras, sem reimprimir nada. Ideal para quem personaliza a própria arte.</span>
                <div className="row wrap" style={{ gap: 8, justifyContent: "center" }}>
                  <Link to="/plus" className="btn goldbtn">Conhecer o GCard Plus <ArrowRight size={16} /></Link>
                  <span className="xs muted">a partir de R$ 15,90/mês no plano anual</span>
                </div>
              </div>
            </section>
          )}
          {p.isBlank && (
            <section className="gp-sec rv">
              <div className="gp-custom">
                <b>Vai personalizar?</b>
                <span className="sm muted">Sem impressão. Cores: cristal, branco, preto e azul. O QR de cada placa é grátis{p.nfcAddonCents ? ` e o chip custa ${money(p.nfcAddonCents)}` : ""}. Veja o passo a passo, com gabaritos e checklist de teste.</span>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Link to="/personalizar" className="btn">Veja o passo a passo</Link>
                  {p.kitParam && <Link to="/comprar" search={{ kit: p.kitParam }} className="btn primary">Comprar o kit para personalizar</Link>}
                </div>
              </div>
            </section>
          )}

          <section className="gp-sec rv">
            <div className="lp-label">{nfcOnly ? "Como gravar" : "Como funciona"}</div>
            <div className="gp-steps">
              {(nfcOnly
                ? [
                    ["1", "Receba o kit", "As placas chegam com o chip NFC em branco, prontas para gravar. Não precisa de código nem de ativação."],
                    ["2", "Grave com o NFC Tools", "No app NFC Tools (grátis): Escrever, Adicionar registro e escolha o tipo, por exemplo URL para o Instagram ou o Pix. Cole o link e toque em Escrever."],
                    ["3", "Encoste o celular na placa", "Com o app aberto, aproxime o celular do chip para gravar. Depois disso, quem encostar o celular abre o destino sozinho, sem aplicativo."],
                  ]
                : [
                    ["1", "Receba o kit", "As placas chegam com um código cada, em branco, prontas para ativar."],
                    ["2", "Ative com o link do cliente", "Em Ativar meus códigos, informe o negócio e cole o link de avaliação (ou o bio site Toqy)."],
                    ["3", "O cliente encosta o celular", "O NFC abre sozinho; o QR Code abre pela câmera. Sem aplicativo."],
                  ]
              ).map(([n, a, b]) => (
                <div key={n} className="lp-stepitem"><span className="lp-num">{n}</span><b>{a}</b><p className="sm muted">{b}</p></div>
              ))}
            </div>
            {nfcOnly && (
              <p className="sm muted" style={{ marginTop: 12, textAlign: "center" }}>
                Passo a passo com fotos no <Link to="/guia/como-configurar-placa-gcard" style={{ textDecoration: "underline" }}>guia de configuração</Link>.
              </p>
            )}
          </section>

          <section className="gp-sec rv">
            <DeliveryTimes />
          </section>

          <section className="gp-sec rv">
            <div className="gp-trust">
              {[[<Wallet key="a" size={18} />, "Pix, cartão e boleto", "Compra segura: Stone ou InfinitePay"], [<ShieldCheck key="b" size={18} />, "7 dias para desistir", "Direito do consumidor (CDC) e dados protegidos (LGPD)"], [<Truck key="c" size={18} />, "Frete grátis", "Todo o Brasil, pelos Correios"]].map(([i, a, b]) => (
                <div key={String(a)} className="gp-tcard">{i}<b>{a}</b><span className="xs muted">{b}</span></div>
              ))}
            </div>
          </section>

          <section className="gp-sec rv">
            <div className="lp-label">Perguntas</div>
            <div className="lp-faq">{FAQ_P.map(([q, a]) => <details key={q} className="lp-qa"><summary className="lp-q"><b>{q}</b></summary><p className="sm muted" style={{ padding: "0 0 14px" }}>{a}</p></details>)}</div>
          </section>

          {p.others.length > 0 && (
            <section className="gp-sec rv">
              <div className="lp-label">Veja também</div>
              <div className="gl-grid">
                {p.others.map((o) => (
                  <Link key={o.slug} to="/produtos/$slug" params={{ slug: o.slug }} className="gl-card" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="gl-cardimg"><img src={o.image} alt={o.name} loading="lazy" /></div>
                    <div className="col" style={{ gap: 3, padding: "12px 14px 16px" }}><b>{o.name}</b></div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

function Produto() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(catalogQuery);
  const { revenda } = plansFrom(data);
  const products = productsFrom(data);
  const p = products.find((x) => x.slug === slug);
  const track = useServerFn(trackClientEvent);
  // Evento "produto_visto" (sem dado pessoal; origem vem do cookie first-touch).
  useEffect(() => {
    void track({ data: { type: "produto_visto", slug } }).catch(() => {});
  }, [slug, track]);
  // 404 só depois do catálogo carregado: com ele vazio ainda é o fallback, que não tem todos os produtos.
  if (!p) {
    if (data.products.length === 0) return null;
    throw notFound();
  }
  const tiers = resaleLines(revenda, products).find((l) => l.slug === slug)?.tiers ?? [];
  const ml = SHOW_MERCADO_LIVRE ? MERCADO_LIVRE_LINKS.find((m) => m.slug === p.slug) : undefined;
  return (
    <ProdutoView
      key={p.slug}
      name={p.name}
      format={p.format ?? ""}
      slug={p.slug}
      image={PRODUCT_IMAGES[p.slug] ?? produtoCartao}
      gallery={mockupsFor(p.slug)}
      hasNfc={Boolean(p.has_nfc)}
      hasQr={Boolean(p.has_qr)}
      isBlank={Boolean(p.is_blank)}
      isSupply={Boolean(p.is_supply)}
      soon={p.status !== "ativo"}
      minQty={tiers[0]?.min_quantity ?? (p as { min_quantity?: number | null }).min_quantity ?? 10}
      step={(p as { quantity_step?: number | null }).quantity_step ?? 1}
      tiers={tiers.map((t) => ({ min_quantity: t.min_quantity, unit_price_cents: t.unit_price_cents, label: t.label }))}
      nfcAddonCents={(p as { nfc_addon_price_cents?: number | null }).nfc_addon_price_cents ?? null}
      kitParam={kitParamFor(p.slug)}
      mercadoLivreUrl={ml?.url ?? null}
      pixOn={pixDiscountActive()}
      others={products.filter((x) => x.slug !== p.slug && x.status === "ativo").slice(0, 4).map((x) => ({ slug: x.slug, name: x.name, image: PRODUCT_IMAGES[x.slug] ?? produtoCartao }))}
    />
  );
}
