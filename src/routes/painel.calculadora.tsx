import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/calculadora")({ component: Calculadora });

type Assumptions = {
  unit_cost_cents: number;
  packaging_cents: number;
  shipping_cents: number;
  gateway_pct: number;
  fixed_monthly_cents: number;
  min_margin_pct: number;
};
const DEFAULTS: Assumptions = {
  unit_cost_cents: 0,
  packaging_cents: 0,
  shipping_cents: 0,
  gateway_pct: 4.99,
  fixed_monthly_cents: 0,
  min_margin_pct: 30,
};

const reais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const toCents = (s: string) => Math.round((Number.parseFloat(s.replace(",", ".")) || 0) * 100);

function Calculadora() {
  const [a, setA] = useState<Assumptions>(DEFAULTS);
  const [salePrice, setSalePrice] = useState("59,90");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "pricing").maybeSingle();
    if (data?.value) setA({ ...DEFAULTS, ...(data.value as Partial<Assumptions>) });
    setLoaded(true);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "pricing", value: a as unknown as Record<string, unknown> }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Premissas salvas.");
  }

  const r = useMemo(() => {
    const price = toCents(salePrice);
    const gatewayFee = Math.round((price * a.gateway_pct) / 100);
    const variable = a.unit_cost_cents + a.packaging_cents + a.shipping_cents + gatewayFee;
    const marginCents = price - variable;
    const marginPct = price > 0 ? (marginCents / price) * 100 : 0;
    const markup = variable > 0 ? price / variable : 0;
    const breakeven = marginCents > 0 ? Math.ceil(a.fixed_monthly_cents / marginCents) : null;
    return { price, gatewayFee, variable, marginCents, marginPct, markup, breakeven };
  }, [salePrice, a]);

  // Preço mínimo teórico para respeitar a margem mínima, resolvendo a equação
  // considerando que a taxa do gateway é percentual sobre o preço de venda.
  const minPrice = useMemo(() => {
    const fixedVar = a.unit_cost_cents + a.packaging_cents + a.shipping_cents; // sem gateway
    const g = a.gateway_pct / 100;
    const m = a.min_margin_pct / 100;
    const denom = 1 - g - m; // derivado de: P*(1-g) - fixedVar = m*P
    if (denom <= 0) return null;
    const p = Math.ceil(fixedVar / denom);
    return p;
  }, [a.unit_cost_cents, a.packaging_cents, a.shipping_cents, a.gateway_pct, a.min_margin_pct]);

  const viavel = r.marginPct >= a.min_margin_pct && r.marginCents > 0;

  const field = (key: keyof Assumptions, label: string, isPct = false) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="decimal"
        value={isPct ? String(a[key]) : reais(a[key])}
        onChange={(e) =>
          setA((prev) => ({
            ...prev,
            [key]: isPct ? Number.parseFloat(e.target.value.replace(",", ".")) || 0 : toCents(e.target.value),
          }))
        }
        className="mt-1 h-10"
      />
    </div>
  );

  if (!loaded) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <>
      <h1 className="text-2xl">Calculadora de margem</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Premissas compartilhadas entre os sócios. Ajuste, salve e veja se o preço fecha.
      </p>

      <div className="mt-6 rounded-2xl bg-card p-5 card-soft">
        <p className="text-sm font-semibold">Custos e premissas</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {field("unit_cost_cents", "Custo da placa (un.)")}
          {field("packaging_cents", "Embalagem (un.)")}
          {field("shipping_cents", "Frete pago pela empresa (un.)")}
          {field("gateway_pct", "Taxa do gateway %", true)}
          {field("fixed_monthly_cents", "Custo fixo mensal")}
          {field("min_margin_pct", "Margem mínima aceitável %", true)}
        </div>
        <Button className="mt-4" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar premissas"}
        </Button>
      </div>

      <div className="mt-5 rounded-2xl bg-card p-5 card-soft">
        <div>
          <Label className="text-xs font-bold">Preço de venda (un.)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: "Lojista (1-4 un) R$ 59,90", val: "59,90" },
              { label: "Lojista (5 un) R$ 49,90", val: "49,90" },
              { label: "Revenda (10-24 un) R$ 37,90", val: "37,90" },
              { label: "Revenda (25-99 un) R$ 27,90", val: "27,90" },
              { label: "Revenda (100+ un) R$ 19,90", val: "19,90" },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setSalePrice(p.val)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  salePrice === p.val
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface border border-border text-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <Input
              inputMode="decimal"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="h-11 font-bold text-lg rounded-xl input-soft"
              placeholder="Digite outro valor..."
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Result label="Custo variável / un." value={money(r.variable)} />
          <Result label="Margem / un." value={money(r.marginCents)} tone={r.marginCents >= 0 ? "pos" : "neg"} />
          <Result label="Margem %" value={`${r.marginPct.toFixed(1)}%`} tone={viavel ? "pos" : "neg"} />
          <Result label="Markup" value={`${r.markup.toFixed(2)}x`} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Result
            label="Taxa do gateway nesse preço"
            value={money(r.gatewayFee)}
          />
          <Result
            label="Ponto de equilíbrio"
            value={r.breakeven === null ? "—" : `${r.breakeven} un./mês`}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Result
            label="Preço mínimo de venda (un.)"
            value={
              minPrice === null
                ? "— (margem impossível com esta taxa/min)"
                : money(minPrice)
            }
            tone={minPrice !== null && r.price >= minPrice ? "pos" : "neg"}
          />
        </div>

        <div
          className={`mt-4 rounded-xl p-4 text-sm font-semibold ${
            viavel ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {viavel
            ? `Viável: margem ${r.marginPct.toFixed(1)}% ≥ mínimo de ${a.min_margin_pct}%.`
            : `Atenção: margem ${r.marginPct.toFixed(1)}% abaixo do mínimo de ${a.min_margin_pct}%.`}
        </div>
      </div>

      <ContasReais />
    </>
  );
}

type ProductCost = {
  label: string;
  unit_cost_cents: number;
  sticker_cents: number;
  packaging_cents: number;
  shipping_in_cents: number;
  labor_cents: number;
  loss_pct: number;
  note?: string;
};
type ProductRow = { slug: string; price_delta_cents: number; status: string };
type PlanRow = {
  slug: string;
  name: string;
  unit_price_cents: number;
  tiers: { min_quantity: number; unit_price_cents: number; label: string | null }[];
};

/** Contas reais (custo real x preço real no site), sempre visível pros dois sócios. */
function ContasReais() {
  const [costs, setCosts] = useState<Record<string, ProductCost>>({});
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [s, p, pl, t] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "pricing_products").maybeSingle(),
        supabase.from("products").select("slug, price_delta_cents, status"),
        supabase.from("plans").select("id, slug, name, unit_price_cents").eq("is_active", true),
        supabase.from("plan_price_tiers").select("plan_id, min_quantity, unit_price_cents, label"),
      ]);
      setCosts((s.data?.value as Record<string, ProductCost>) ?? {});
      setProducts((p.data ?? []) as ProductRow[]);
      const tiers = t.data ?? [];
      setPlans(
        ((pl.data ?? []) as { id: string; slug: string; name: string; unit_price_cents: number }[]).map((x) => ({
          slug: x.slug,
          name: x.name,
          unit_price_cents: x.unit_price_cents,
          tiers: tiers
            .filter((tt) => tt.plan_id === x.id)
            .sort((a2, b2) => a2.min_quantity - b2.min_quantity),
        })),
      );
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;

  const rows: { product: string; plan: string; price: number; cost: number }[] = [];
  for (const prod of products) {
    if (prod.status !== "ativo") continue;
    const cost = costs[prod.slug];
    if (!cost) continue;
    const baseCost =
      cost.unit_cost_cents + cost.sticker_cents + cost.packaging_cents + cost.shipping_in_cents + cost.labor_cents;
    const withLoss = Math.round(baseCost * (1 + cost.loss_pct / 100));
    for (const plan of plans) {
      const tierList = plan.tiers.length ? plan.tiers : [{ min_quantity: 1, unit_price_cents: plan.unit_price_cents, label: null }];
      for (const tier of tierList) {
        rows.push({
          product: cost.label,
          plan: `${plan.name}${tier.label ? ` — ${tier.label}` : ""}`,
          price: tier.unit_price_cents + prod.price_delta_cents,
          cost: withLoss,
        });
      }
    }
  }

  return (
    <div className="mt-5 rounded-2xl bg-card p-5 card-soft">
      <p className="text-sm font-semibold">Contas reais — custo x preço no site agora</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Custo de cada peça pronta (material + adesivo + embalagem + frete de produção + mão de obra + 3%
        perdas) contra o preço ativo no catálogo. Atualiza sozinho quando o preço do site muda.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Produto</th>
              <th className="py-2 pr-3">Faixa</th>
              <th className="py-2 pr-3 text-right">Custo</th>
              <th className="py-2 pr-3 text-right">Preço</th>
              <th className="py-2 pr-3 text-right">Margem</th>
              <th className="py-2 text-right">Margem %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const margin = r.price - r.cost;
              const pct = r.price > 0 ? (margin / r.price) * 100 : 0;
              return (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3">{r.product}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.plan}</td>
                  <td className="py-2 pr-3 text-right">{money(r.cost)}</td>
                  <td className="py-2 pr-3 text-right">{money(r.price)}</td>
                  <td className={`py-2 pr-3 text-right ${margin >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {money(margin)}
                  </td>
                  <td className={`py-2 text-right font-semibold ${pct >= 30 ? "text-green-700" : "text-red-700"}`}>
                    {pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Result({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-xl bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-xl ${
          tone === "neg" ? "text-red-700" : tone === "pos" ? "text-green-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
