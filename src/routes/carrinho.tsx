import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { money, resolveUnitPrice } from "@/lib/pricing";
import { PIX_DISCOUNT_PCT, pixDiscountActive, pixDiscountCents, pixEligible } from "@/lib/promo";
import { PRODUCT_IMAGES, catalogQuery, plansFrom, productsFrom } from "@/lib/site-catalog";
import { removeFromCartAt, setCartOptions, setCartQty, useCartItems } from "@/lib/cart";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";

export const Route = createFileRoute("/carrinho")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({ meta: [{ title: "Carrinho | GCard-PRÓ" }, { name: "robots", content: "noindex" }] }),
  component: Carrinho,
});

type P = {
  slug: string;
  name: string;
  min_quantity?: number | null;
  quantity_step?: number | null;
  is_blank?: boolean | null;
  is_supply?: boolean | null;
  nfc_addon_price_cents?: number | null;
  color_variants?: { slug: string; name: string; delta_cents: number }[] | null;
};

function Carrinho() {
  const { data } = useSuspenseQuery(catalogQuery);
  const { revenda } = plansFrom(data);
  const products = productsFrom(data) as unknown as P[];
  const items = useCartItems();

  const lines = items.map((it, index) => {
    const product = products.find((p) => p.slug === it.slug) ?? null;
    const variant = product?.color_variants?.find((c) => c.slug === it.color) ?? null;
    const unit = product ? resolveUnitPrice(revenda, product as never, it.qty, true, variant?.delta_cents ?? 0) : 0;
    const chip = it.chip && product?.is_blank ? (product.nfc_addon_price_cents ?? 0) * it.qty : 0;
    return { it, index, product, variant, unit, chip, total: unit * it.qty + chip };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const eligible = lines.filter((l) => pixEligible(l.product)).reduce((s, l) => s + l.total, 0);
  const pixOff = pixDiscountActive() && subtotal > 0 ? pixDiscountCents(subtotal, eligible / subtotal) : 0;

  return (
    <div className="v2">
      <div className="lp">
        <div className="lp-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>
        <SiteHeader />
        <main className="lp-col" style={{ padding: "28px 0 72px" }}>
          <div className="mb">
            <div className="lp-label">Carrinho</div>
            <h1>Seu carrinho{lines.length ? <span className="muted" style={{ fontSize: 18 }}> · {lines.length} {lines.length === 1 ? "item" : "itens"}</span> : null}</h1>
          </div>

          {lines.length === 0 ? (
            <div className="card col center" style={{ alignItems: "center", padding: 40, gap: 12 }}>
              <ShoppingBag size={36} color="var(--brand)" />
              <h2>Seu carrinho está vazio</h2>
              <p className="sm muted">Escolha os kits na página de cada produto e adicione aqui.</p>
              <Link to="/produtos" className="btn primary">Ver produtos <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_360px]" style={{ alignItems: "start" }}>
              <div className="col" style={{ gap: 12 }}>
                {lines.map(({ it, index, product, variant, unit, chip, total }) => {
                  const min = Math.max(1, product?.min_quantity ?? 1);
                  const step = Math.max(1, product?.quantity_step ?? 1);
                  return (
                    <div key={`${it.slug}-${it.color}-${it.chip}-${it.qr}-${index}`} className="card" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <img src={PRODUCT_IMAGES[it.slug] ?? produtoCartao} alt="" style={{ width: 96, height: 96, objectFit: "contain", borderRadius: 14, border: "1px solid var(--line)", background: "#fff", padding: 6, flex: "none" }} />
                      <div className="col grow" style={{ gap: 4, minWidth: 220 }}>
                        <Link to="/produtos/$slug" params={{ slug: it.slug }} style={{ textDecoration: "none" }}><b>{product?.name ?? it.slug}</b></Link>
                        {variant && <span className="sm muted">Cor: {variant.name}</span>}
                        {product?.is_blank && (
                          <div className="row wrap" style={{ gap: 14 }}>
                            <label className="row sm" style={{ gap: 6, cursor: "pointer" }}><input type="checkbox" checked={it.qr} onChange={(e) => setCartOptions(index, { qr: e.target.checked })} /> QR Code em cada placa</label>
                            {product.nfc_addon_price_cents ? <label className="row sm" style={{ gap: 6, cursor: "pointer" }}><input type="checkbox" checked={it.chip} onChange={(e) => setCartOptions(index, { chip: e.target.checked })} /> Chip NFC (+ {money(product.nfc_addon_price_cents)} cada)</label> : null}
                          </div>
                        )}
                        <span className="xs muted">{money(unit)} por unidade{chip ? ` · chips ${money(chip)}` : ""} · mínimo {min}</span>
                        <div className="row wrap" style={{ gap: 12, marginTop: 6 }}>
                          <div className="row" style={{ gap: 4, border: "1px solid var(--line)", borderRadius: 999, padding: 3 }}>
                            <button type="button" className="btn" style={{ padding: "4px 10px" }} aria-label="Menos" disabled={it.qty - step < min} onClick={() => setCartQty(index, it.qty - step)}><Minus size={14} /></button>
                            <b style={{ minWidth: 38, textAlign: "center" }}>{it.qty}</b>
                            <button type="button" className="btn" style={{ padding: "4px 10px" }} aria-label="Mais" onClick={() => setCartQty(index, it.qty + step)}><Plus size={14} /></button>
                          </div>
                          <button type="button" className="btn ghost" onClick={() => removeFromCartAt(index)} style={{ color: "var(--danger)" }}><Trash2 size={14} /> Remover</button>
                        </div>
                      </div>
                      <div style={{ marginLeft: "auto", textAlign: "right" }}>
                        <div className="xs muted">Subtotal</div>
                        <b style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{money(total)}</b>
                      </div>
                    </div>
                  );
                })}
                <Link to="/produtos" className="btn" style={{ alignSelf: "flex-start" }}>+ Continuar comprando</Link>
              </div>

              <aside className="card col" style={{ gap: 10, position: "sticky", top: 90 }}>
                <b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Resumo do pedido</b>
                <div className="row sm"><span className="grow muted">Subtotal ({lines.length} {lines.length === 1 ? "item" : "itens"})</span><span>{money(subtotal)}</span></div>
                <div className="row sm"><span className="grow muted">Frete</span><b style={{ color: "var(--brand-text)" }}>Grátis</b></div>
                <div className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}><b className="grow">Total</b><b style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>{money(subtotal)}</b></div>
                {pixOff > 0 && <div className="row sm" style={{ color: "var(--brand-text)" }}><span className="grow">No Pix, com {PIX_DISCOUNT_PCT}% OFF</span><b>{money(subtotal - pixOff)}</b></div>}
                <Link to="/comprar" search={{}} className="btn primary block" data-analytics-event="begin_checkout" data-analytics-label="carrinho">Finalizar compra <ArrowRight size={16} /></Link>
                <div className="col xs muted" style={{ gap: 6, marginTop: 4 }}>
                  <span className="row" style={{ gap: 6 }}><Truck size={14} /> Frete grátis para todo o Brasil</span>
                  <span className="row" style={{ gap: 6 }}><ShieldCheck size={14} /> Pagamento seguro (Pix ou cartão) e 7 dias para desistir</span>
                </div>
              </aside>
            </div>
          )}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
