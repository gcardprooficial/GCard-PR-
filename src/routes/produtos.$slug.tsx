import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { MOCKUPS, PRODUCT_IMAGES, catalogQuery, plansFrom, productsFrom, resaleLines } from "@/lib/site-catalog";
import produtoCartao from "@/assets/gcard-pro-cartoes-stack.jpeg";

export const Route = createFileRoute("/produtos/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug} | GCard-PRÓ` }],
    links: [{ rel: "canonical", href: `https://www.gcardpro.com.br/produtos/${params.slug}` }],
  }),
  component: Produto,
});

function Produto() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(catalogQuery);
  const { lojista, revenda } = plansFrom(data);
  const products = productsFrom(data);
  const p = products.find((x) => x.slug === slug);
  if (!p) throw notFound();
  const soon = p.status !== "ativo";
  const tiers = resaleLines(revenda, products).find((l) => l.slug === slug)?.tiers ?? [];
  const caminho = p.is_blank ? "revenda" : "lojista";
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 pt-6 text-sm text-muted-foreground">
        <Link to="/produtos" className="hover:text-foreground">← Produtos</Link>
      </div>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:grid-cols-2 md:gap-12">
        <div>
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            <img src={PRODUCT_IMAGES[p.slug] ?? produtoCartao} alt={p.name} className={`aspect-square w-full ${p.is_blank ? "object-contain p-8" : "object-cover"}`} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {MOCKUPS.slice(0, 4).map((m, i) => (
              <img key={m} src={m} alt={`${p.name} no balcão ${i + 1}`} loading="lazy" className="aspect-square rounded-xl object-cover" />
            ))}
          </div>
        </div>
        <div>
          <h1 className="text-3xl leading-tight sm:text-4xl">{p.name}</h1>
          <p className="mt-2 text-muted-foreground">{p.format}</p>
          <div className="mt-3 flex gap-2">
            {p.has_nfc && <span className="rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-black">NFC</span>}
            {p.has_qr && <span className="rounded-lg bg-foreground/10 px-2.5 py-1 text-xs font-black">QR Code</span>}
          </div>
          {!p.is_blank && !soon && (
            <p className="mt-6 font-display text-4xl">
              {money(lojista.unit_price_cents + p.price_delta_cents)}
              <span className="ml-2 font-sans text-sm font-semibold text-muted-foreground">por unidade · frete grátis</span>
            </p>
          )}
          {tiers.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-muted/70 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Preço de revenda por quantidade</p>
              <ul className="mt-2 space-y-1 text-sm">
                {tiers.map((t) => (
                  <li key={t.min_quantity} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t.label ?? `${t.min_quantity}+ un.`}</span>
                    <span className="font-display text-lg">{money(t.unit_price_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.is_blank && <p className="mt-4 text-sm text-muted-foreground">Sem impressão. Cores: cristal, branco e preto. Você aplica a sua arte ou adesivo.</p>}
          {soon ? (
            <Button disabled size="lg" className="mt-8 h-14 w-full rounded-xl">Em breve</Button>
          ) : (
            <Button asChild size="lg" className="btn-press btn-primary-shadow mt-8 h-14 w-full rounded-xl text-base font-bold">
              <Link to="/comprar" search={{ caminho }}>Comprar agora →</Link>
            </Button>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
