import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { getCatalog, type CatalogProduct } from "@/lib/catalog.functions";
import { searchBusinesses, type BusinessResult } from "@/lib/places.functions";
import { createPendingOrder } from "@/lib/checkout.functions";
import { createCheckoutPreference } from "@/lib/payments/createPreference.server";
import { unitPriceForQuantity, money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import produtoCartao from "@/assets/gcard-pro-cartao-nfc-arte-frontal.png";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.png";

const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });

const searchSchema = z.object({
  caminho: z.enum(["lojista", "revenda"]).optional().catch(undefined),
});

export const Route = createFileRoute("/comprar")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({
    meta: [
      { title: "Montar meu GCard-PRÓ | Cartão de avaliação do Google" },
      {
        name: "description",
        content:
          "Escolha o modelo, encontre o seu negócio no Google pelo nome e receba o cartão já configurado. Frete grátis.",
      },
      { property: "og:title", content: "Montar meu GCard-PRÓ" },
      {
        property: "og:description",
        content: "Passo a passo rápido para receber seu cartão de avaliação já configurado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Comprar,
});

const IMAGES: Record<string, string> = {
  "cartao-bolso": produtoCartao,
};

const FALLBACK_PRODUCTS: CatalogProduct[] = [
  {
    id: "fallback-cartao",
    slug: "cartao-bolso",
    name: "Cartão de bolso GCard-PRÓ",
    tagline: "NFC pronto para avaliações no Google",
    description: "Cartão de bolso com chip NFC.",
    format: "Cartão NFC 8,5 x 5,4 cm",
    status: "ativo",
    price_delta_cents: 0,
    has_qr: false,
    has_nfc: true,
  },
];

type Customer = {
  firstName: string;
  lastName: string;
  document: string;
  phone: string;
  email: string;
};

type Address = {
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

function Comprar() {
  const { caminho } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(catalogQuery);
  const runSearch = useServerFn(searchBusinesses);
  const submitOrder = useServerFn(createPendingOrder);
  const createPref = useServerFn(createCheckoutPreference);

  const isResale = caminho === "revenda";
  const plan = data.plans.find((p) =>
    isResale ? p.slug === "renda-extra" : p.slug === "lojista",
  ) ?? {
    id: isResale ? "fallback-renda-extra" : "fallback-lojista",
    slug: isResale ? "renda-extra" : "lojista",
    name: isResale ? "Pack Renda Extra" : "Plano Lojista",
    audience: isResale ? "Comprar em quantidade e revender" : "Para usar no seu próprio balcão",
    description: null,
    unit_price_cents: isResale ? 3790 : 5990,
    min_quantity: isResale ? 10 : 1,
    max_quantity: isResale ? null : 5,
    is_resale: isResale,
    tiers: isResale
      ? [
          { min_quantity: 10, unit_price_cents: 3790, label: "10 a 24 unidades" },
          { min_quantity: 25, unit_price_cents: 2790, label: "25 a 99 unidades" },
          { min_quantity: 100, unit_price_cents: 1990, label: "100 unidades ou mais" },
        ]
      : [
          { min_quantity: 1, unit_price_cents: 5990, label: "1 a 4 unidades" },
          { min_quantity: 5, unit_price_cents: 4990, label: "5 unidades" },
        ],
    packages: [],
  };
  const catalogProducts = data.products.filter(
    (item) => item.slug === "cartao-bolso" && item.status === "ativo",
  );
  // O checkout não pode ficar sem opções quando uma linha antiga do catálogo
  // estiver com status diferente ou quando o catálogo ainda não foi publicado.
  const products = catalogProducts.length > 0 ? catalogProducts : FALLBACK_PRODUCTS;

  const steps = isResale
    ? (["estilo", "quantidade", "dados", "entrega", "revisao"] as const)
    : (["estilo", "negocio", "confirmar", "quantidade", "dados", "entrega", "revisao"] as const);

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const [business, setBusiness] = useState<BusinessResult | null>(null);
  const [quantity, setQuantity] = useState(isResale ? 5 : 1);
  const [customer, setCustomer] = useState<Customer>({
    firstName: "",
    lastName: "",
    document: "",
    phone: "",
    email: "",
  });
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [address, setAddress] = useState<Address>({
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lookingUpZip, setLookingUpZip] = useState(false);

  // Trocar de caminho (meu negócio <-> em quantidade) reinicia o passo a passo:
  // os dois fluxos têm etapas diferentes e não devem compartilhar progresso.
  useEffect(() => {
    setStepIndex(0);
    setProduct(null);
    setTerm("");
    setResults([]);
    setManualLink("");
    setBusiness(null);
    setQuantity(caminho === "revenda" ? 10 : 1);
  }, [caminho]);

  const unitPrice = useMemo(() => {
    if (!plan) return 0;
    return (
      unitPriceForQuantity(plan.tiers, quantity, plan.unit_price_cents) +
      (product?.price_delta_cents ?? 0)
    );
  }, [plan, product, quantity]);
  const total = unitPrice * quantity;
  const maxQuantity = plan?.max_quantity ?? 500;

  const go = (delta: number) => {
    if (isTransitioning) return;
    const nextIndex = Math.min(steps.length - 1, Math.max(0, stepIndex + delta));
    if (nextIndex === stepIndex) return;
    setIsTransitioning(true);
    window.setTimeout(() => {
      setStepIndex(nextIndex);
      setIsTransitioning(false);
    }, 360);
  };

  async function handleSearch() {
    if (term.trim().length < 3) {
      toast.error("Digite pelo menos 3 letras do nome do negócio.");
      return;
    }
    setSearching(true);
    try {
      const res = await runSearch({ data: { query: term.trim() } });
      if (!res.ok) {
        toast.error(res.error);
        setResults([]);
        return;
      }
      setResults(res.results);
      if (res.results.length === 0) toast.info("Nenhum negócio encontrado com esse nome.");
    } catch {
      toast.error("Não conseguimos buscar agora. Tente novamente.");
    } finally {
      setSearching(false);
    }
  }

  async function lookupZip(zip: string) {
    const digits = zip.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLookingUpZip(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (json.erro) return;
      setAddress((prev) => ({
        ...prev,
        street: json.logradouro ?? prev.street,
        district: json.bairro ?? prev.district,
        city: json.localidade ?? prev.city,
        state: json.uf ?? prev.state,
      }));
    } catch {
      /* preenchimento manual continua disponível */
    } finally {
      setLookingUpZip(false);
    }
  }

  async function finish() {
    if (!plan || !product) return;
    setSaving(true);
    try {
      const res = await submitOrder({
        data: {
          business: business
            ? { name: business.name, placeId: business.placeId, address: business.address }
            : manualLink
              ? { name: term || "Meu negócio", link: manualLink }
              : null,
          planSlug: plan.slug,
          productSlug: product.slug,
          quantity,
          customer,
          marketingConsent,
          address: { ...address, complement: address.complement || null },
        },
      });
      setOrderNumber(res.orderNumber);
      // Try to create a checkout preference (only works if provider configured)
      try {
        const pref = await createPref({ data: { orderNumber: res.orderNumber } });
        if (pref?.url) {
          // Redirect the buyer to the hosted checkout
          window.location.href = pref.url;
          return;
        }
      } catch (e) {
        // provider not configured or error — fall back to manual flow
        console.debug("create preference failed", e);
      }
    } catch (error) {
      console.error(error);
      toast.error("Não conseguimos registrar o pedido. Confira os dados e tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="text-muted-foreground">Catálogo indisponível agora.</p>
      </div>
    );
  }

  if (!caminho) {
    const lojista = data.plans.find((p) => p.slug === "lojista");
    const revenda = data.plans.find((p) => p.slug === "renda-extra");
    const revendaFrom = revenda
      ? Math.min(...revenda.tiers.map((t) => t.unit_price_cents), revenda.unit_price_cents)
      : 0;
    return (
      <div className="relative min-h-screen overflow-hidden bg-background noise-bg">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -left-24 size-[500px] rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-40 -right-20 size-[420px] rounded-full bg-foreground/5 blur-3xl"
        />

        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
            <Link
              to="/"
              className="group -m-1 p-1 rounded-xl transition-transform duration-300 hover:scale-[1.02]"
            >
              <img
                src={logoTransparente}
                alt="GCard-PRÓ"
                className="h-8 w-auto sm:h-9 select-none"
                draggable={false}
              />
            </Link>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="btn-press rounded-xl hover:bg-surface"
            >
              <Link to="/">← Voltar</Link>
            </Button>
          </div>
        </header>

        <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-12 sm:pt-16">
          <div className="animate-rise max-w-2xl">
            <span className="badge-pill bg-primary/15 text-primary-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Monte o seu pedido
            </span>
            <h1 className="mt-5 text-3xl leading-[1.05] sm:text-4xl md:text-5xl">
              Como você vai usar o <span className="highlight-yellow">GCard-PRÓ</span>?
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Dois fluxos separados — um para você colocar na sua loja, outro para revender e lucrar
              com donos de negócio.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-7">
            <button
              type="button"
              onClick={() => navigate({ to: "/comprar", search: { caminho: "lojista" } })}
              className="group animate-rise delay-2 relative overflow-hidden rounded-[1.75rem] border-2 border-border bg-card p-7 sm:p-8 text-left card-soft card-soft-hover shine-border"
            >
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.75rem] bg-primary/0 transition-all duration-500 group-hover:bg-primary" />
              <div className="flex items-start justify-between gap-3">
                <div className="badge-pill bg-primary/15 text-primary-foreground">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Loja própria
                </div>
                <span className="rounded-2xl bg-primary/15 p-2.5 text-primary-foreground transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-md">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 7h18v12H3z" />
                    <path d="M3 11h18" />
                  </svg>
                </span>
              </div>

              <h2 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl">
                Quero receber <span className="text-primary">100% configurado</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Você informa o seu negócio no Google e nós entregamos as placas já gravadas com o
                link da sua avaliação. Pronto pra colar no balcão.
              </p>

              <div className="mt-6 flex items-end gap-2">
                <span className="font-display text-4xl font-black leading-none sm:text-5xl">
                  {money(lojista?.unit_price_cents ?? 5990)}
                </span>
                <span className="pb-1 text-sm font-semibold text-muted-foreground sm:text-base">
                  / unidade
                </span>
              </div>

              <div className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all duration-300 group-hover:bg-foreground group-hover:text-white group-hover:shadow-md">
                Começar agora
                <svg
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate({ to: "/comprar", search: { caminho: "revenda" } })}
              className="group animate-rise delay-3 relative overflow-hidden rounded-[1.75rem] border-2 border-foreground/5 bg-card p-7 sm:p-8 text-left card-soft card-soft-hover shine-border"
            >
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.75rem] bg-foreground/0 transition-all duration-500 group-hover:bg-foreground" />
              <div className="flex items-start justify-between gap-3">
                <div className="badge-pill bg-foreground/90 text-white">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Revenda / lote
                </div>
                <span className="rounded-2xl bg-foreground/5 p-2.5 text-foreground transition-all duration-300 group-hover:scale-110 group-hover:bg-foreground group-hover:text-white group-hover:shadow-md">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="17" cy="17" r="3" />
                    <circle cx="6" cy="6" r="3" />
                    <path d="M8.59 8.59 14.41 14.41" />
                    <path d="m15 11 6-6" />
                    <path d="m3 21 6-6" />
                  </svg>
                </span>
              </div>

              <h2 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl">
                Comprar em <span className="font-black">quantidade</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Lote em branco pra revender. Quanto mais unidades, menor o custo por placa — margem
                acima de 100% no preço sugerido.
              </p>

              <div className="mt-6 flex items-end gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  a partir de
                </span>
                <span className="font-display text-4xl font-black leading-none sm:text-5xl">
                  {money(revendaFrom || 1990)}
                </span>
                <span className="pb-1 text-sm font-semibold text-muted-foreground sm:text-base">
                  / unidade
                </span>
              </div>

              <div className="mt-7 inline-flex items-center gap-2 rounded-2xl border-2 border-foreground/10 bg-background px-5 py-3 text-sm font-bold text-foreground transition-all duration-300 group-hover:border-foreground group-hover:bg-foreground group-hover:text-white group-hover:shadow-md">
                Escolher lote
                <svg
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (orderNumber) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background noise-bg">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative flex min-h-screen items-center justify-center px-5 py-16">
          <div className="w-full max-w-lg animate-pop">
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 sm:p-10 text-center card-soft">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-10 right-0 size-40 rounded-full bg-primary/20 blur-2xl"
              />

              <div className="relative mx-auto mb-5 inline-flex size-20 items-center justify-center rounded-3xl bg-primary/15 text-primary-foreground">
                <div className="absolute inline-flex size-20 animate-ping-slow rounded-3xl bg-primary opacity-40" />
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h1 className="relative text-3xl font-bold leading-tight sm:text-4xl">
                Pedido <span className="highlight-yellow">registrado</span>!
              </h1>
              <p className="relative mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg">
                Número{" "}
                <strong className="rounded-xl bg-foreground/5 px-2.5 py-1 font-display text-2xl font-black text-foreground">
                  #{orderNumber}
                </strong>
              </p>
              <p className="relative mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                O pagamento pelo Mercado Pago entra no ar em breve. Vamos te chamar no WhatsApp para
                concluir e enviar o código de rastreio.
              </p>

              <div className="relative mt-8 grid gap-3">
                <Button
                  asChild
                  size="lg"
                  className="btn-press group animate-rise delay-2 rounded-2xl px-6 py-3"
                >
                  <Link to="/">← Voltar ao início</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canAdvance = (() => {
    switch (step) {
      case "estilo":
        return !!product;
      case "negocio":
        return !!business || manualLink.trim().length > 10;
      case "confirmar":
        return !!business || manualLink.trim().length > 10;
      case "quantidade":
        return quantity >= plan.min_quantity && quantity <= maxQuantity;
      case "dados":
        return (
          customer.firstName.length >= 2 &&
          customer.lastName.length >= 1 &&
          customer.document.replace(/\D/g, "").length >= 11 &&
          customer.phone.replace(/\D/g, "").length >= 10 &&
          /.+@.+\..+/.test(customer.email)
        );
      case "entrega":
        return (
          address.zip.replace(/\D/g, "").length === 8 &&
          address.street.length >= 3 &&
          address.number.length >= 1 &&
          address.district.length >= 2 &&
          address.city.length >= 2 &&
          address.state.length >= 2
        );
      default:
        return true;
    }
  })();

  const stepLabels: Record<string, string> = {
    estilo: "Modelo",
    negocio: "Negócio",
    confirmar: "Confirmar",
    quantidade: "Qtd.",
    dados: "Dados",
    entrega: "Entrega",
    revisao: "Finalizar",
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background noise-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-[480px] rounded-full bg-primary/12 blur-3xl"
      />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
          <Link
            to="/"
            className="group -m-1 p-1 rounded-xl transition-transform duration-300 hover:scale-[1.02]"
          >
            <img
              src={logoTransparente}
              alt="GCard-PRÓ"
              className="h-8 w-auto sm:h-9 select-none"
              draggable={false}
            />
          </Link>
          <button
            type="button"
            onClick={() => navigate({ to: "/comprar" })}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Trocar opção
          </button>
        </div>
      </header>

      <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-8 sm:pt-10">
        <div className="mb-7 flex items-center gap-4">
          <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-sm font-black text-primary-foreground shadow-sm">
            {stepIndex + 1}
            <span className="text-primary-foreground/60">/{steps.length}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  {isResale ? "Revenda / lote" : "Loja própria"}
                </p>
                <p className="truncate text-sm font-bold text-foreground">
                  {stepLabels[step] ?? step}
                  <span className="ml-2 font-medium text-muted-foreground">· {plan.name}</span>
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">
                {Math.round(((stepIndex + 1) / steps.length) * 100)}%
              </span>
            </div>
            <div className="flex gap-1.5" aria-hidden>
              {steps.map((s, idx) => (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                    idx <= stepIndex ? "bg-primary" : "bg-surface"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative h-1 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out shadow-sm"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
          />
          <Progress value={((stepIndex + 1) / steps.length) * 100} className="hidden" />
        </div>

        <div
          key={step}
          className="mt-8 animate-rise rounded-[1.75rem] border border-border bg-card p-6 card-soft sm:p-9"
        >
          {step === "estilo" && (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    Qual <span className="highlight-yellow">modelo</span> você quer?
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Escolha o formato. Dá para trocar depois antes de finalizar.
                  </p>
                </div>
                <span className="shrink-0 rounded-2xl bg-primary/15 px-3 py-2 text-primary-foreground">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 7V4h16v3" />
                    <path d="M9 20h6" />
                    <path d="M12 4v16" />
                  </svg>
                </span>
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-3 md:gap-6">
                {products.map((item, i) => {
                  const disabled = item.status !== "ativo";
                  const selected = product?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setProduct(item)}
                      className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-300 card-soft card-soft-hover ${
                        selected
                          ? "border-primary ring-4 ring-primary/20 shadow-xl"
                          : "border-border hover:border-primary/50"
                      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      {selected && (
                        <div className="absolute right-3 top-3 z-10 inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md animate-pop">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}

                      <div
                        className={`relative aspect-4/3 overflow-hidden bg-surface transition-all ${!disabled ? "group-hover:scale-[1.02]" : ""}`}
                      >
                        <img
                          src={IMAGES[item.slug] ?? produtoCartao}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loading="lazy"
                          draggable={false}
                        />
                        {disabled && (
                          <div className="absolute inset-0 flex items-center justify-center bg-foreground/55 backdrop-blur-[1.5px]">
                            <span className="badge-pill bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                              Em breve
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 sm:p-5">
                        <p className="text-base font-bold sm:text-lg">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                          {item.format}
                        </p>

                        <div className="mt-3 flex items-center gap-1.5">
                          {[
                            item.has_nfc && {
                              label: "NFC",
                              color: "bg-primary/20 text-primary-foreground",
                            },
                            item.has_qr && {
                              label: "QR",
                              color: "bg-foreground/10 text-foreground",
                            },
                          ]
                            .filter(Boolean)
                            .map((tag) => (
                              <span
                                key={tag!.label}
                                className={`rounded-lg px-2 py-0.5 text-[11px] font-black tracking-wide ${tag!.color}`}
                              >
                                {tag!.label}
                              </span>
                            ))}
                        </div>

                        {!disabled && (
                          <div className="mt-4 border-t border-border/70 pt-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Por unidade
                            </p>
                            <p className="mt-1 font-display text-xl font-black leading-tight sm:text-2xl">
                              {money(
                                unitPriceForQuantity(plan.tiers, quantity, plan.unit_price_cents) +
                                  item.price_delta_cents,
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "negocio" && (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    Encontre o seu <span className="highlight-yellow">negócio</span>
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Digite o nome igual aparece no Google Maps e escolha na lista. A gente já busca
                    o link de avaliação por você.
                  </p>
                </div>
                <span className="shrink-0 rounded-2xl bg-g-blue/10 px-3 py-2 text-g-blue">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  </svg>
                </span>
              </div>

              <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <Input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSearch();
                      }
                    }}
                    placeholder="Ex.: Padaria Estrela, Curitiba"
                    className="h-12 !pl-11 text-base input-soft rounded-2xl"
                  />
                </div>
                <Button
                  onClick={() => void handleSearch()}
                  disabled={searching}
                  className="btn-press btn-primary-shadow h-12 rounded-2xl px-6 text-base font-bold sm:min-w-[140px]"
                >
                  {searching ? (
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="size-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Buscando
                    </span>
                  ) : (
                    "Buscar 🔎"
                  )}
                </Button>
              </div>

              {results.length > 0 && (
                <p className="mt-6 text-sm font-bold text-foreground/80">
                  Encontramos {results.length} resultado{results.length > 1 ? "s" : ""} · toque no
                  correto
                </p>
              )}
              <div className="mt-3 space-y-3">
                {results.map((result, index) => (
                  <button
                    key={result.placeId}
                    type="button"
                    onClick={() => {
                      setBusiness(result);
                      go(1);
                    }}
                    style={{ animationDelay: `${index * 55}ms` }}
                    className="group w-full animate-rise-sm rounded-2xl border-2 border-border bg-background p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-foreground sm:text-lg">
                          {result.name}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {result.address}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-xl bg-foreground/5 p-2.5 text-foreground/60 transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                    {result.rating !== null && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5">
                        <span className="inline-flex gap-0.5">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <svg
                              key={i}
                              viewBox="0 0 24 24"
                              className="size-3.5 fill-primary"
                              aria-hidden
                            >
                              <path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7-6.2-3.4L5.8 21 7 14.2 2 9.4l7-.9L12 2z" />
                            </svg>
                          ))}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {result.rating.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({result.reviews ?? 0} avaliações)
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <details className="group mt-8 rounded-2xl border border-border bg-surface/50 p-5 [&[open]]:bg-primary/5 [&[open]]:border-primary/40 text-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-bold text-foreground sm:text-base">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-lg bg-foreground/5 text-foreground">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </span>
                    Não encontrou? Colar link direto de avaliação
                  </span>
                  <svg
                    className="size-4 transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
                  Abra o Google Maps → encontre sua empresa → botão "Avaliações" → "Escrever uma
                  avaliação" → copie a URL da barra de endereço e cole aqui.
                </p>
                <Input
                  value={manualLink}
                  onChange={(e) => setManualLink(e.target.value)}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="mt-3 h-12 input-soft rounded-2xl text-sm"
                />
              </details>
            </div>
          )}

          {step === "confirmar" && (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    É <span className="highlight-yellow">este</span> mesmo?
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Confere aí se é o seu negócio que vai ser gravado no chip NFC.
                  </p>
                </div>
                <span className="shrink-0 rounded-2xl bg-g-green/12 px-3 py-2 text-g-green">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
              </div>

              <div className="mt-7 overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-gradient-to-br from-primary/15 via-background to-primary/5 p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 inline-flex size-14 items-center justify-center rounded-2xl bg-card shadow-sm">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary-foreground bg-primary rounded-xl size-11"
                    >
                      <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold leading-tight text-foreground sm:text-2xl">
                      {business?.name ?? term ?? "Meu negócio"}
                    </p>
                    {business?.address && (
                      <p className="mt-1.5 truncate text-sm text-muted-foreground sm:text-base">
                        {business.address}
                      </p>
                    )}
                    {business?.rating != null && (
                      <div className="mt-3 inline-flex items-center gap-2">
                        <span className="inline-flex gap-0.5">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <svg
                              key={i}
                              viewBox="0 0 24 24"
                              className="size-4.5 fill-primary"
                              aria-hidden
                            >
                              <path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7-6.2-3.4L5.8 21 7 14.2 2 9.4l7-.9L12 2z" />
                            </svg>
                          ))}
                        </span>
                        <span className="text-sm font-black">{business.rating.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">
                          · {business.reviews ?? 0} avaliações no Google
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-card/70 p-4">
                  <span className="mt-0.5 shrink-0 inline-flex size-5 items-center justify-center rounded-full bg-primary/30 text-primary-foreground">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {product?.has_qr
                      ? "Vamos gravar o link de avaliação no chip NFC e no QR dinâmico."
                      : "Vamos gravar o link de avaliação no chip NFC do cartão de bolso (sem QR)."}{" "}
                    Se precisar trocar depois, é só mandar mensagem.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => go(-1)}
                className="btn-press mt-6 h-12 rounded-2xl border-2 px-5 font-bold hover:bg-card"
              >
                ← Trocar negócio
              </Button>
            </div>
          )}

          {step === "quantidade" && (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    Quantas <span className="highlight-yellow">unidades</span>?
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {isResale
                      ? "Quanto mais unidades, menor o preço por placa. Escolha um pacote ou digite outro número."
                      : "Preço único por unidade. Dá pra levar quantas quiser."}
                  </p>
                </div>
                <span className="shrink-0 rounded-2xl bg-g-green/12 px-3 py-2 text-g-green">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </span>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2 md:gap-5">
                {plan.packages.map((pkg, i) => {
                  const price =
                    unitPriceForQuantity(plan.tiers, pkg.quantity, plan.unit_price_cents) +
                    (product?.price_delta_cents ?? 0);
                  const selected = quantity === pkg.quantity;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setQuantity(pkg.quantity)}
                      className={`group relative overflow-hidden rounded-2xl border-2 p-5 sm:p-6 text-left transition-all duration-300 card-soft card-soft-hover ${
                        selected
                          ? "border-primary ring-4 ring-primary/15 shadow-xl bg-primary/[0.04]"
                          : "border-border bg-background"
                      }`}
                    >
                      {selected && (
                        <div className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md animate-pop">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pr-10">
                        <p className="font-display text-2xl font-black leading-tight sm:text-3xl">
                          {pkg.label}
                        </p>
                        {pkg.badge && (
                          <span className="badge-pill bg-primary text-primary-foreground shadow-sm">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{pkg.note}</p>

                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border/70 pt-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Total
                          </p>
                          <p className="mt-0.5 font-display text-2xl font-black leading-none sm:text-3xl">
                            {money(price * pkg.quantity)}
                          </p>
                        </div>
                        <p className="pb-1 text-xs font-semibold text-muted-foreground sm:text-sm">
                          {money(price)} por unidade
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 max-w-xs">
                <Label htmlFor="qtd" className="text-sm font-bold">
                  Ou digite outra quantidade
                </Label>
                <div className="mt-2 flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(plan.min_quantity, q - 1))}
                    className="btn-press inline-flex w-12 items-center justify-center rounded-2xl border-2 border-border bg-card text-2xl font-black text-foreground hover:border-primary hover:bg-primary/10"
                    aria-label="Diminuir quantidade"
                  >
                    –
                  </button>
                  <Input
                    id="qtd"
                    type="number"
                    min={plan.min_quantity}
                    max={maxQuantity}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.min(
                          maxQuantity,
                          Math.max(plan.min_quantity, Number(e.target.value) || plan.min_quantity),
                        ),
                      )
                    }
                    className="mt-0 h-12 text-center text-xl font-black input-soft rounded-2xl"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                    className="btn-press inline-flex w-12 items-center justify-center rounded-2xl border-2 border-border bg-card text-2xl font-black text-foreground hover:border-primary hover:bg-primary/10"
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mt-8 relative overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-gradient-to-br from-primary/20 via-primary/5 to-primary/10 p-6 sm:p-7">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-primary/30 blur-3xl"
                />
                <div className="relative flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Total do pedido
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-xl font-black sm:text-2xl">
                        {quantity} unidade{quantity === 1 ? "" : "s"}
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground">
                        × {money(unitPrice)} · frete grátis
                      </span>
                    </div>
                  </div>
                  <p className="font-display text-4xl font-black leading-none sm:text-5xl">
                    {money(total)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === "dados" && (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    Seus <span className="highlight-yellow">dados</span>
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Usamos só pra emitir e entregar o seu pedido — nada de spam.
                  </p>
                </div>
                <span className="shrink-0 rounded-2xl bg-foreground/5 px-3 py-2 text-foreground">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome"
                  value={customer.firstName}
                  onChange={(v) => setCustomer({ ...customer, firstName: v })}
                  placeholder="João"
                />
                <Field
                  label="Sobrenome"
                  value={customer.lastName}
                  onChange={(v) => setCustomer({ ...customer, lastName: v })}
                  placeholder="Silva"
                />
                <Field
                  label="CPF (só números)"
                  value={customer.document}
                  onChange={(v) => setCustomer({ ...customer, document: v })}
                  placeholder="000.000.000-00"
                />
                <Field
                  label="WhatsApp"
                  value={customer.phone}
                  onChange={(v) => setCustomer({ ...customer, phone: v })}
                  placeholder="(41) 90000-0000"
                />
                <div className="sm:col-span-2">
                  <Field
                    label="E-mail"
                    type="email"
                    value={customer.email}
                    onChange={(v) => setCustomer({ ...customer, email: v })}
                    placeholder="joao@email.com"
                  />
                </div>
              </div>
              <div className="mt-6 inline-flex items-start gap-3 rounded-2xl bg-surface/70 p-4">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/25 text-primary-foreground">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Dados protegidos pela LGPD. Nós nunca compartilhamos e nem enviamos mensagem sem
                  necessidade do pedido.
                </p>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-1 size-4 accent-primary"
                />
                <span className="leading-relaxed text-muted-foreground">
                  Quero receber atualizações estratégicas e novidades da GCard-PRÓ por e-mail. Posso
                  me descadastrar a qualquer momento.
                </span>
              </label>
            </div>
          )}

          {step === "entrega" && (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    Onde vamos <span className="highlight-yellow">entregar</span>?
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Preenche o CEP que a gente já busca rua, bairro e cidade.
                  </p>
                </div>
                <span className="shrink-0 rounded-2xl bg-g-green/12 px-3 py-2 text-g-green">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 7h13v10H3z" />
                    <path d="M16 10h4l2 3v4h-6z" />
                    <circle cx="7" cy="19" r="2" />
                    <circle cx="18" cy="19" r="2" />
                  </svg>
                </span>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cep" className="text-sm font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      CEP
                      <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary-foreground">
                        {lookingUpZip ? "Buscando" : "Auto"}
                      </span>
                    </span>
                  </Label>
                  <Input
                    id="cep"
                    value={address.zip}
                    onChange={(e) => {
                      setAddress({ ...address, zip: e.target.value });
                      void lookupZip(e.target.value);
                    }}
                    className="mt-1.5 h-12 input-soft rounded-2xl"
                    placeholder="00000-000"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {lookingUpZip
                      ? "Localizando seu endereço..."
                      : "Rua, bairro e cidade são preenchidos automaticamente."}
                  </p>
                </div>
                <Field
                  label="Número"
                  value={address.number}
                  onChange={(v) => setAddress({ ...address, number: v })}
                  placeholder="123 ou s/n"
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Rua / Avenida"
                    value={address.street}
                    onChange={(v) => setAddress({ ...address, street: v })}
                    placeholder="Rua das Flores"
                  />
                </div>
                <Field
                  label="Bairro"
                  value={address.district}
                  onChange={(v) => setAddress({ ...address, district: v })}
                  placeholder="Centro"
                />
                <Field
                  label="Complemento"
                  value={address.complement}
                  onChange={(v) => setAddress({ ...address, complement: v })}
                  placeholder="Ap 402, casa de fundo, etc."
                />
                <Field
                  label="Cidade"
                  value={address.city}
                  onChange={(v) => setAddress({ ...address, city: v })}
                  placeholder="Curitiba"
                />
                <Field
                  label="Estado (UF)"
                  value={address.state}
                  onChange={(v) => setAddress({ ...address, state: v })}
                  placeholder="PR"
                />
              </div>
              <div className="mt-6 inline-flex items-start gap-3 rounded-2xl bg-primary/10 p-4">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/40 text-primary-foreground">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <p className="text-xs leading-relaxed font-semibold text-foreground sm:text-sm">
                  Frete grátis para todo o Brasil. Produção + envio é de 5 a 10 dias úteis.
                </p>
              </div>
            </div>
          )}

          {step === "revisao" && (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl leading-tight sm:text-3xl">
                    Dá uma <span className="highlight-yellow">checada</span> final
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Tudo certo? Clica em finalizar que a gente te chama no WhatsApp pra concluir o
                    pagamento.
                  </p>
                </div>
                <span className="shrink-0 rounded-2xl bg-primary/15 px-3 py-2 text-primary-foreground">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
              </div>

              <dl className="mt-7 overflow-hidden rounded-2xl border border-border divide-y divide-border bg-card">
                <Row label="Modelo" value={product?.name ?? "—"} />
                <Row label="Plano" value={plan.name} />
                {!isResale && (
                  <Row label="Negócio" value={business?.name ?? term ?? "Link colado"} />
                )}
                <Row label="Quantidade" value={`${quantity} unidade(s)`} />
                <Row label="Preço por unidade" value={money(unitPrice)} />
                <Row
                  label="Frete"
                  value={
                    <span className="inline-flex items-center gap-1 text-g-green font-black">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Grátis
                    </span>
                  }
                />
                <Row
                  label="Cliente"
                  value={`${customer.firstName} ${customer.lastName} · ${customer.email}`}
                />
                <Row
                  label="Entrega"
                  value={`${address.street}, ${address.number} — ${address.district}, ${address.city}/${address.state}`}
                />
              </dl>

              <div className="mt-6 relative overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 sm:p-7 shadow-xl shadow-primary/20">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/20 blur-3xl"
                />
                <div className="relative flex flex-wrap items-end justify-between gap-4">
                  <div className="text-primary-foreground/90">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-foreground/80">
                      Total a pagar
                    </p>
                    <p className="mt-2 text-sm font-semibold">{quantity} un. · frete incluso</p>
                  </div>
                  <p className="font-display text-4xl font-black leading-none text-primary-foreground sm:text-6xl">
                    {money(total)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navegação do wizard */}
          <div className="mt-10 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center">
            <Button
              variant="ghost"
              onClick={() => go(-1)}
              disabled={stepIndex === 0 || isTransitioning}
              className="btn-press h-12 rounded-2xl px-5 font-bold text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar
            </Button>

            <div className="text-center text-xs font-semibold text-muted-foreground sm:hidden">
              Passo {stepIndex + 1} de {steps.length}
            </div>

            {step === "revisao" ? (
              <Button
                size="lg"
                onClick={() => void finish()}
                disabled={saving || isTransitioning}
                className="btn-press btn-primary-shadow shine-border h-14 rounded-2xl px-7 text-base font-black"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="size-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Registrando seu pedido...
                  </span>
                ) : (
                  <>
                    Finalizar pedido
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => go(1)}
                disabled={!canAdvance || isTransitioning}
                className="btn-press btn-primary-shadow shine-border h-14 rounded-2xl px-7 text-base font-black disabled:opacity-60 disabled:shadow-none"
              >
                Continuar
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-g-green/20 bg-g-green/5 px-4 py-3 text-sm">
            <span
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-g-green/15 text-g-green"
              aria-hidden
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <p className="leading-relaxed text-muted-foreground">
              Pagamento processado com segurança pelo{" "}
              <strong className="text-foreground">Mercado Pago</strong>. Seus dados de cartão não
              ficam armazenados na GCard-PRÓ.
            </p>
          </div>
        </div>
      </div>

      {isTransitioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 px-5 backdrop-blur-md">
          <div className="animate-pop rounded-[1.5rem] border border-border bg-card px-7 py-6 text-center shadow-2xl shadow-foreground/10">
            <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary-foreground">
              <svg
                className="size-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-bold text-foreground">Preparando a próxima etapa</p>
            <p className="mt-1 text-xs text-muted-foreground">Só mais um instante</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="group">
      <Label className="text-sm font-bold text-foreground/90 group-hover:text-foreground transition-colors">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-12 input-soft rounded-2xl text-base"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 text-sm first:rounded-t-2xl last:rounded-b-2xl">
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] break-words text-right font-bold text-foreground sm:max-w-md">
        {value}
      </dd>
    </div>
  );
}
