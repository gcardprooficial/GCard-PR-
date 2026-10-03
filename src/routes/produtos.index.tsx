import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { money } from "@/lib/pricing";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { PRODUCT_IMAGES, catalogQuery, plansFrom, productsFrom } from "@/lib/site-catalog";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos | GCard-PRÓ" },
      { name: "description", content: "Cartão NFC, placas com QR Code e NFC e acrílico sem arte para avaliações no Google. Frete grátis e sem mensalidade." },
    ],
    links: [{ rel: "canonical", href: "https://www.gcardpro.com.br/produtos" }],
  }),
  component: Produtos,
});

function Produtos() {
  const { data } = useSuspenseQuery(catalogQuery);
  const { lojista } = plansFrom(data);
  const products = productsFrom(data);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="bg-foreground text-white">
        <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Produtos</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">Todos os produtos GCard-PRÓ</h1>
          <p className="mt-3 max-w-xl text-white/70">Com arte pronta ou acrílico puro. Frete grátis para todo o Brasil e sem mensalidade.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const soon = p.status !== "ativo";
          return (
            <Link key={p.id} to="/produtos/$slug" params={{ slug: p.slug }} className="group overflow-hidden rounded-3xl border border-border bg-card card-soft card-soft-hover">
              <div className="relative aspect-square overflow-hidden bg-surface">
                <img src={PRODUCT_IMAGES[p.slug] ?? produtoCartao} alt={p.name} loading="lazy" draggable={false} className={`h-full w-full transition-transform duration-700 group-hover:scale-105 ${p.is_blank ? "object-contain p-6" : "object-cover"}`} />
                {soon && <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-black text-primary-foreground">Em breve</span>}
              </div>
              <div className="p-5">
                <h2 className="text-lg font-bold">{p.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.format}</p>
                {!p.is_blank && !soon && (
                  <p className="mt-3 font-display text-2xl">
                    <span className="mr-1 font-sans text-xs font-semibold text-muted-foreground">a partir de</span>
                    {money(lojista.unit_price_cents + p.price_delta_cents)}
                  </p>
                )}
                {p.is_blank && <p className="mt-3 text-sm font-semibold text-muted-foreground">Revenda · kit a partir de 10 un.</p>}
              </div>
            </Link>
          );
        })}
      </section>
      <SiteFooter />
    </div>
  );
}
