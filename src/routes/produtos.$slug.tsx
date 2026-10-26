import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackClientEvent } from "@/lib/events.functions";
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

/** Produto liso que tem atalho de kit em /comprar?kit=. */
const kitParamFor = (slug: string) =>
  slug === "acrilico-10x10-sem-arte" ? ("personalizar" as const) : slug === "acrilico-15x10-l-sem-arte" ? ("personalizar-l" as const) : null;

function Produto() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(catalogQuery);
  const { lojista, revenda } = plansFrom(data);
  const products = productsFrom(data);
  const p = products.find((x) => x.slug === slug);
  const track = useServerFn(trackClientEvent);
  // Evento "produto_visto" (sem dado pessoal; origem vem do cookie first-touch).
  useEffect(() => {
    void track({ data: { type: "produto_visto", slug } }).catch(() => {});
  }, [slug, track]);
  const [modo, setModo] = useState<"lojista" | "revenda">(p?.is_blank || p?.is_supply ? "revenda" : "lojista");
  if (!p) throw notFound();
  const soon = p.status !== "ativo";
  const tiers = resaleLines(revenda, products).find((l) => l.slug === slug)?.tiers ?? [];
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 pt-6 text-sm text-muted-foreground">
        <Link to="/produtos" className="hover:text-foreground">← Produtos</Link>
      </div>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:grid-cols-2 md:gap-12">
        <div>
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            <img src={PRODUCT_IMAGES[p.slug] ?? produtoCartao} alt={p.name} className={`aspect-square w-full ${p.is_blank || p.is_supply ? "object-contain p-8" : "object-cover"}`} />
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
          {!p.is_blank && !p.is_supply && !soon && (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" role="tablist" aria-label="Como você vai usar">
              {([
                ["lojista", "Loja própria", "Já configurado pra você"],
                ["revenda", "Revenda", "Em quantidade, a partir de 10"],
              ] as const).map(([k, t, d]) => (
                <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => setModo(k)}
                  className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all active:scale-[0.98] ${modo === k ? "border-primary bg-foreground text-white shadow-lg" : "border-foreground/30 bg-card text-foreground hover:border-foreground hover:shadow-md"}`}>
                  <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${modo === k ? "border-primary bg-primary" : "border-foreground/40"}`}>{modo === k && <span className="size-2 rounded-full bg-foreground" />}</span>
                  <span>
                  <span className="block text-base font-black">{t}</span>
                  <span className={`block text-xs leading-tight ${modo === k ? "text-white/70" : "text-muted-foreground"}`}>{d}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {modo === "lojista" && !p.is_blank && !p.is_supply && !soon && (
            <>
              <p className="mt-6 font-display text-4xl">
                {money(lojista.unit_price_cents + p.price_delta_cents)}
                <span className="ml-2 font-sans text-sm font-semibold text-muted-foreground">por unidade · frete grátis</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Chega pronto, apontando pra avaliação do seu Google. Você informa o seu negócio na compra.</p>
            </>
          )}
          {modo === "revenda" && tiers.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-muted/70 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Preço por unidade · frete grátis</p>
              <ul className="mt-2 space-y-1 text-sm">
                {tiers.map((t) => (
                  <li key={t.min_quantity} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t.label ?? `${t.min_quantity}+ un.`}</span>
                    <span className="font-display text-lg">{money(t.unit_price_cents)}</span>
                  </li>
                ))}
              </ul>
              {!p.is_blank && !p.is_supply && <p className="mt-3 text-xs text-muted-foreground">Chega com QR/NFC em branco; você ativa cada código com o link do seu cliente.</p>}
              {p.is_supply && <p className="mt-3 text-xs text-muted-foreground">Vendido só para revendedores, a partir de {p.min_quantity} unidades{p.quantity_step > 1 ? ` (de ${p.quantity_step} em ${p.quantity_step})` : ""}. O chip NFC chega vazio: você grava o link com o app NFC Tools.</p>}
            </div>
          )}
          {p.is_blank && (
            <>
              <p className="mt-4 text-sm text-muted-foreground">Sem impressão. Cores: cristal, branco, preto e azul. Você aplica a sua arte ou adesivo.</p>
              <div className="mt-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
                <p className="font-bold">Vai personalizar?</p>
                <p className="mt-1 text-muted-foreground">
                  O QR de cada placa é grátis
                  {p.nfc_addon_price_cents ? ` e o chip custa ${money(p.nfc_addon_price_cents)}` : ""}.{" "}
                  <Link to="/personalizar" className="font-semibold text-foreground underline">Veja o passo a passo</Link>
                  {kitParamFor(p.slug) && (
                    <>
                      {" · "}
                      <Link to="/comprar" search={{ kit: kitParamFor(p.slug)! }} className="font-semibold text-foreground underline">Comprar o kit para personalizar</Link>
                    </>
                  )}
                </p>
              </div>
            </>
          )}
          {soon ? (
            <Button disabled size="lg" className="mt-8 h-14 w-full rounded-xl">Em breve</Button>
          ) : (
            <Button asChild size="lg" className="btn-press btn-primary-shadow mt-8 h-14 w-full rounded-xl text-base font-bold">
              <Link to="/comprar" search={{ caminho: modo }}>{modo === "revenda" ? "Comprar para revenda →" : "Comprar para o meu negócio →"}</Link>
            </Button>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
