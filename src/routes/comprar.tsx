import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { getCatalog, type CatalogProduct } from "@/lib/catalog.functions";
import { searchBusinesses, type BusinessResult } from "@/lib/places.functions";
import { createPendingOrder } from "@/lib/checkout.functions";
import { unitPriceForQuantity, money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import produtoCartao from "@/assets/produto-cartao.jpg";
import produto10x10 from "@/assets/produto-plaquinha-10x10.jpg";
import produto10x15 from "@/assets/produto-plaquinha-10x15.jpg";

const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });

const searchSchema = z.object({
  caminho: z.enum(["lojista", "revenda"]).default("lojista").catch("lojista"),
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
  "plaquinha-10x10": produto10x10,
  "plaquinha-10x15-l": produto10x15,
};

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

  const isResale = caminho === "revenda";
  const plan = data.plans.find((p) => (isResale ? p.slug === "renda-extra" : p.slug === "lojista"));

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

  // Trocar de caminho (meu negócio <-> em quantidade) reinicia o passo a passo:
  // os dois fluxos têm etapas diferentes e não devem compartilhar progresso.
  useEffect(() => {
    setStepIndex(0);
    setProduct(null);
    setTerm("");
    setResults([]);
    setManualLink("");
    setBusiness(null);
    setQuantity(caminho === "revenda" ? 5 : 1);
  }, [caminho]);

  const unitPrice = useMemo(() => {
    if (!plan) return 0;
    return (
      unitPriceForQuantity(plan.tiers, quantity, plan.unit_price_cents) +
      (product?.price_delta_cents ?? 0)
    );
  }, [plan, product, quantity]);
  const total = unitPrice * quantity;

  const go = (delta: number) => setStepIndex((i) => Math.min(steps.length - 1, Math.max(0, i + delta)));

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
          address: { ...address, complement: address.complement || null },
        },
      });
      setOrderNumber(res.orderNumber);
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

  if (orderNumber) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md animate-pop rounded-3xl bg-card p-8 text-center card-soft">
          <h1 className="text-3xl">Pedido registrado</h1>
          <p className="mt-3 text-muted-foreground">
            Número <strong className="text-foreground">#{orderNumber}</strong>. O pagamento pelo
            Mercado Pago entra no ar em breve — vamos te chamar no WhatsApp para concluir.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar ao início</Link>
          </Button>
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
        return quantity >= plan.min_quantity;
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

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-display text-lg">
            GCard<span className="text-primary">-PRÓ</span>
          </Link>
          <div className="flex gap-1 rounded-full bg-secondary p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => navigate({ to: "/comprar", search: { caminho: "lojista" } })}
              className={`rounded-full px-3 py-1.5 transition-colors ${caminho === "lojista" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Meu negócio
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/comprar", search: { caminho: "revenda" } })}
              className={`rounded-full px-3 py-1.5 transition-colors ${caminho === "revenda" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Em quantidade
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <Progress value={((stepIndex + 1) / steps.length) * 100} className="h-2" />
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Passo {stepIndex + 1} de {steps.length} · {plan.name}
        </p>

        <div key={step} className="mt-6 animate-slide-in rounded-3xl bg-card p-6 card-soft sm:p-8">
          {step === "estilo" && (
            <div>
              <h1 className="text-2xl sm:text-3xl">Qual estilo você quer?</h1>
              <p className="mt-2 text-muted-foreground">
                Escolha o formato antes de continuar. Dá para trocar depois.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {data.products.map((item) => {
                  const disabled = item.status !== "ativo";
                  const selected = product?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setProduct(item)}
                      className={`overflow-hidden rounded-2xl border-2 text-left transition-all ${
                        selected ? "border-primary shadow-lg" : "border-border hover:border-primary/60"
                      } ${disabled ? "cursor-not-allowed opacity-55" : "hover:-translate-y-1"}`}
                    >
                      <img
                        src={IMAGES[item.slug] ?? produtoCartao}
                        alt={item.name}
                        className="aspect-4/3 w-full object-cover"
                        loading="lazy"
                      />
                      <div className="p-4">
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.format}</p>
                        {disabled ? (
                          <span className="mt-2 inline-block rounded-full bg-accent px-2 py-0.5 text-xs font-semibold">
                            Em breve
                          </span>
                        ) : (
                          <p className="mt-2 text-sm font-semibold">
                            {money(
                              unitPriceForQuantity(plan.tiers, quantity, plan.unit_price_cents) +
                                item.price_delta_cents,
                            )}{" "}
                            <span className="font-normal text-muted-foreground">/ unidade</span>
                          </p>
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
              <h1 className="text-2xl sm:text-3xl">Qual o nome do seu negócio no Google?</h1>
              <p className="mt-2 text-muted-foreground">
                Digite o nome e escolha na lista. Nós pegamos o link de avaliação por você.
              </p>
              <div className="mt-6 flex gap-2">
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
                  className="h-12"
                />
                <Button className="h-12" onClick={() => void handleSearch()} disabled={searching}>
                  {searching ? "Buscando..." : "Buscar"}
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {results.map((result, index) => (
                  <button
                    key={result.placeId}
                    type="button"
                    onClick={() => {
                      setBusiness(result);
                      go(1);
                    }}
                    style={{ animationDelay: `${index * 45}ms` }}
                    className="w-full animate-rise rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent/40"
                  >
                    <p className="font-semibold">{result.name}</p>
                    <p className="text-sm text-muted-foreground">{result.address}</p>
                    {result.rating !== null && (
                      <p className="mt-1 text-sm">
                        <span className="font-semibold">{result.rating.toFixed(1)}</span>{" "}
                        <span className="text-muted-foreground">
                          ({result.reviews ?? 0} avaliações)
                        </span>
                      </p>
                    )}
                  </button>
                ))}
              </div>

              <details className="mt-6 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Não encontrou? Colar o link de avaliação
                </summary>
                <Input
                  value={manualLink}
                  onChange={(e) => setManualLink(e.target.value)}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="mt-3 h-11"
                />
              </details>
            </div>
          )}

          {step === "confirmar" && (
            <div>
              <h1 className="text-2xl sm:text-3xl">É este o seu negócio?</h1>
              <div className="mt-5 rounded-2xl bg-surface p-5">
                <p className="text-lg font-semibold">{business?.name ?? term ?? "Meu negócio"}</p>
                {business?.address && (
                  <p className="text-sm text-muted-foreground">{business.address}</p>
                )}
                {business?.rating != null && (
                  <p className="mt-2 text-sm">
                    Nota <strong>{business.rating.toFixed(1)}</strong> · {business.reviews ?? 0}{" "}
                    avaliações no Google
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Vamos gravar o link de avaliação deste perfil dentro do seu cartão.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => go(-1)}>
                Trocar negócio
              </Button>
            </div>
          )}

          {step === "quantidade" && (
            <div>
              <h1 className="text-2xl sm:text-3xl">Quantas unidades?</h1>
              <p className="mt-2 text-muted-foreground">
                {isResale
                  ? "Quanto mais unidades, menor o preço por unidade."
                  : "Preço único por unidade, sem limite de quantidade."}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {plan.packages.map((pkg) => {
                  const price =
                    unitPriceForQuantity(plan.tiers, pkg.quantity, plan.unit_price_cents) +
                    (product?.price_delta_cents ?? 0);
                  const selected = quantity === pkg.quantity;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setQuantity(pkg.quantity)}
                      className={`rounded-2xl border-2 p-5 text-left transition-all hover:-translate-y-0.5 ${
                        selected ? "border-primary bg-accent/40" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display text-xl">{pkg.label}</p>
                        {pkg.badge && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{pkg.note}</p>
                      <p className="mt-3 text-lg font-semibold">{money(price * pkg.quantity)}</p>
                      <p className="text-xs text-muted-foreground">{money(price)} por unidade</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 max-w-xs">
                <Label htmlFor="qtd">Outra quantidade</Label>
                <Input
                  id="qtd"
                  type="number"
                  min={plan.min_quantity}
                  max={500}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 h-11"
                />
              </div>

              <div className="mt-6 rounded-2xl bg-surface p-5">
                <p className="text-sm text-muted-foreground">
                  {quantity} × {money(unitPrice)} · frete grátis
                </p>
                <p className="font-display text-3xl">{money(total)}</p>
              </div>
            </div>
          )}

          {step === "dados" && (
            <div>
              <h1 className="text-2xl sm:text-3xl">Seus dados</h1>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nome" value={customer.firstName} onChange={(v) => setCustomer({ ...customer, firstName: v })} />
                <Field label="Sobrenome" value={customer.lastName} onChange={(v) => setCustomer({ ...customer, lastName: v })} />
                <Field label="CPF" value={customer.document} onChange={(v) => setCustomer({ ...customer, document: v })} />
                <Field label="WhatsApp" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} />
                <div className="sm:col-span-2">
                  <Field label="E-mail" type="email" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} />
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Usamos seus dados apenas para emitir e entregar o pedido, conforme a LGPD.
              </p>
            </div>
          )}

          {step === "entrega" && (
            <div>
              <h1 className="text-2xl sm:text-3xl">Endereço de entrega</h1>
              <p className="mt-2 text-muted-foreground">Frete grátis para todo o Brasil.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={address.zip}
                    onChange={(e) => {
                      setAddress({ ...address, zip: e.target.value });
                      void lookupZip(e.target.value);
                    }}
                    className="mt-1 h-11"
                    placeholder="00000-000"
                  />
                </div>
                <Field label="Número" value={address.number} onChange={(v) => setAddress({ ...address, number: v })} />
                <div className="sm:col-span-2">
                  <Field label="Rua" value={address.street} onChange={(v) => setAddress({ ...address, street: v })} />
                </div>
                <Field label="Bairro" value={address.district} onChange={(v) => setAddress({ ...address, district: v })} />
                <Field label="Complemento" value={address.complement} onChange={(v) => setAddress({ ...address, complement: v })} />
                <Field label="Cidade" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} />
                <Field label="Estado" value={address.state} onChange={(v) => setAddress({ ...address, state: v })} />
              </div>
            </div>
          )}

          {step === "revisao" && (
            <div>
              <h1 className="text-2xl sm:text-3xl">Confira e finalize</h1>
              <dl className="mt-6 space-y-3 text-sm">
                <Row label="Modelo" value={product?.name ?? "—"} />
                <Row label="Plano" value={plan.name} />
                {!isResale && <Row label="Negócio" value={business?.name ?? term ?? "Link colado"} />}
                <Row label="Quantidade" value={`${quantity} unidade(s)`} />
                <Row label="Preço por unidade" value={money(unitPrice)} />
                <Row label="Frete" value="Grátis" />
                <Row
                  label="Cliente"
                  value={`${customer.firstName} ${customer.lastName} · ${customer.email}`}
                />
                <Row
                  label="Entrega"
                  value={`${address.street}, ${address.number} — ${address.district}, ${address.city}/${address.state}`}
                />
              </dl>
              <div className="mt-6 rounded-2xl bg-surface p-5">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-display text-3xl">{money(total)}</p>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => go(-1)} disabled={stepIndex === 0}>
              Voltar
            </Button>
            {step === "revisao" ? (
              <Button size="lg" onClick={() => void finish()} disabled={saving}>
                {saving ? "Registrando..." : "Finalizar pedido"}
              </Button>
            ) : (
              <Button size="lg" onClick={() => go(1)} disabled={!canAdvance}>
                Continuar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

