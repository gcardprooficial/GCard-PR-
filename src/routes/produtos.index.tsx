import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { PRODUCT_IMAGES, catalogQuery, productsFrom } from "@/lib/site-catalog";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos | GCard-PRÓ" },
      { name: "description", content: "Kits de cartão NFC, placas com QR Code e NFC e acrílico sem arte para revenda, a partir de 10 unidades. Frete grátis e sem mensalidade." },
    ],
    links: [{ rel: "canonical", href: "https://www.gcardpro.com.br/produtos" }],
  }),
  component: Produtos,
});

export type ProdutosViewProps = { items: { id: string; slug: string; name: string; format: string; image: string; soon: boolean }[] };

/** Parte visual da lista de produtos (sem banco), no desenho do protótipo. */
export function ProdutosView({ items }: ProdutosViewProps) {
  return (
    <div className="v2">
      <div className="lp">
        <div className="lp-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>
        <SiteHeader />
        <main className="lp-col">
          <section className="lp-sec">
            <div className="lp-head2"><div className="lp-label">Produtos</div><h1 className="lp-h2">Todos os produtos GCard-PRÓ</h1><p className="lp-sub">Só kits para revendedores, a partir de 10 unidades. Com arte pronta ou acrílico puro, frete grátis para todo o Brasil e sem mensalidade.</p></div>
            <div className="gl-grid">
              {items.map((p) => (
                <Link key={p.id} to="/produtos/$slug" params={{ slug: p.slug }} className="gl-card" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="gl-cardimg">
                    <img src={p.image} alt={p.name} loading="lazy" draggable={false} />
                    {p.soon && <div className="gp-badges"><span className="gp-badge">Em breve</span></div>}
                  </div>
                  <div className="col" style={{ gap: 3, padding: "12px 14px 16px", textAlign: "left" }}><b>{p.name}</b><span className="xs muted">{p.format}</span></div>
                </Link>
              ))}
            </div>
          </section>
          <section className="lp-sec">
            <div className="gp-custom">
              <b>Vai colocar a sua própria arte?</b>
              <span className="sm muted">Veja o passo a passo para personalizar a sua placa, com gabaritos e checklist de teste.</span>
              <div><Link to="/personalizar" className="btn primary">Como personalizar</Link></div>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

function Produtos() {
  const { data } = useSuspenseQuery(catalogQuery);
  const products = productsFrom(data);
  return (
    <ProdutosView
      items={products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, format: p.format ?? "", image: PRODUCT_IMAGES[p.slug] ?? produtoCartao, soon: p.status !== "ativo" }))}
    />
  );
}
