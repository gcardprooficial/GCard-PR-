import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { payAffiliateCommissions } from "@/lib/panel.functions";
import { money } from "@/lib/pricing";
import { COUPON_RE } from "@/lib/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/afiliados")({ component: Afiliados });

// Tabelas novas ainda fora dos tipos gerados do Supabase.
const db = supabase as unknown as SupabaseClient;

type Affiliate = {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  instagram: string | null;
  pix_key: string | null;
  discount_pct: number;
  commission_pct: number;
  is_active: boolean;
  access_token: string;
  clicks: number;
  created_at: string;
};

type Commission = {
  affiliate_id: string;
  amount_cents: number;
  base_cents: number;
  status: "pendente" | "paga" | "cancelada";
};

const EMPTY_FORM = {
  name: "",
  code: "",
  instagram: "",
  phone: "",
  email: "",
  document: "",
  pix_key: "",
  discount_pct: "5",
  commission_pct: "5",
};

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function Afiliados() {
  const runPay = useServerFn(payAffiliateCommissions);
  const [affiliates, setAffiliates] = useState<Affiliate[] | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([
      db.from("affiliates").select("*").order("created_at", { ascending: false }),
      db
        .from("affiliate_commissions")
        .select("affiliate_id, amount_cents, base_cents, status")
        .limit(5000),
    ]);
    if (a.error || c.error) {
      toast.error("Não foi possível carregar os parceiros.");
      return;
    }
    setAffiliates((a.data ?? []) as Affiliate[]);
    setCommissions((c.data ?? []) as Commission[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statsById = useMemo(() => {
    const m = new Map<string, { sales: number; revenue: number; pending: number; paid: number }>();
    for (const c of commissions) {
      const cur = m.get(c.affiliate_id) ?? { sales: 0, revenue: 0, pending: 0, paid: 0 };
      if (c.status !== "cancelada") {
        cur.sales += 1;
        cur.revenue += c.base_cents;
      }
      if (c.status === "pendente") cur.pending += c.amount_cents;
      if (c.status === "paga") cur.paid += c.amount_cents;
      m.set(c.affiliate_id, cur);
    }
    return m;
  }, [commissions]);

  const totalPending = commissions
    .filter((c) => c.status === "pendente")
    .reduce((s, c) => s + c.amount_cents, 0);

  async function create(e: FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toLowerCase();
    if (!COUPON_RE.test(code)) {
      toast.error("Código: 3 a 30 letras minúsculas, números, - ou _.");
      return;
    }
    const discount = Number(form.discount_pct);
    const commission = Number(form.commission_pct);
    if (![discount, commission].every((n) => Number.isInteger(n) && n >= 0 && n <= 50)) {
      toast.error("Desconto e comissão: número inteiro de 0 a 50.");
      return;
    }
    setSaving(true);
    const { error } = await db.from("affiliates").insert({
      name: form.name.trim(),
      code,
      instagram: form.instagram.trim().replace(/^@/, "") || null,
      phone: form.phone.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      document: form.document.trim() || null,
      pix_key: form.pix_key.trim() || null,
      discount_pct: discount,
      commission_pct: commission,
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "Esse código já está em uso." : "Não foi possível cadastrar.",
      );
      return;
    }
    toast.success("Parceiro cadastrado.");
    setForm(EMPTY_FORM);
    setCodeTouched(false);
    void load();
  }

  async function toggleActive(a: Affiliate) {
    const { error } = await db
      .from("affiliates")
      .update({ is_active: !a.is_active, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    setAffiliates(
      (prev) => prev?.map((x) => (x.id === a.id ? { ...x, is_active: !a.is_active } : x)) ?? null,
    );
  }

  async function pay(a: Affiliate, pendingCents: number) {
    if (
      !confirm(
        `Confirmar que você pagou ${money(pendingCents)} para ${a.name}?\nIsso lança uma saída no Financeiro.`,
      )
    ) {
      return;
    }
    setPaying(a.id);
    try {
      const res = await runPay({ data: { affiliateId: a.id } });
      toast.success(
        res.count
          ? `${res.count} comissão(ões) marcadas como pagas: ${money(res.totalCents)}.`
          : "Nada pendente.",
      );
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível marcar como pago.");
    } finally {
      setPaying(null);
    }
  }

  const field = (
    key: keyof typeof EMPTY_FORM,
    label: string,
    props: Partial<React.ComponentProps<typeof Input>> = {},
  ) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        value={form[key]}
        onChange={(e) => {
          const v = e.target.value;
          setForm((f) => ({
            ...f,
            [key]: v,
            ...(key === "name" && !codeTouched ? { code: slugify(v) } : {}),
          }));
          if (key === "code") setCodeTouched(true);
        }}
        className="mt-1 h-10"
        {...props}
      />
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Afiliados</h1>
        {totalPending > 0 && (
          <p className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            A pagar: {money(totalPending)}
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada parceiro tem um link próprio. Quem compra por ele ganha o desconto automático e o
        parceiro ganha comissão sobre o valor pago, gerada quando o pagamento é confirmado.
      </p>

      <form onSubmit={create} className="mt-6 rounded-2xl bg-card p-5 card-soft">
        <h2 className="text-sm font-black">Novo parceiro</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {field("name", "Nome", { required: true, minLength: 2, maxLength: 120 })}
          {field("code", "Código do cupom (link)", {
            required: true,
            maxLength: 30,
            placeholder: "joao",
          })}
          {field("instagram", "Instagram", { placeholder: "@perfil", maxLength: 60 })}
          {field("phone", "WhatsApp", { inputMode: "tel", maxLength: 20 })}
          {field("email", "E-mail", { type: "email", maxLength: 160 })}
          {field("document", "CPF/CNPJ", { maxLength: 20 })}
          {field("pix_key", "Chave Pix (pagar comissão)", { maxLength: 120 })}
          {field("discount_pct", "Desconto do cliente (%)", { inputMode: "numeric", maxLength: 2 })}
          {field("commission_pct", "Comissão do parceiro (%)", {
            inputMode: "numeric",
            maxLength: 2,
          })}
        </div>
        {form.code && (
          <p className="mt-3 break-all text-xs text-muted-foreground">
            Link:{" "}
            <span className="font-mono">
              {origin}/c/{form.code.toLowerCase()}
            </span>
          </p>
        )}
        <Button type="submit" disabled={saving} className="mt-4 h-10 w-full sm:w-auto">
          {saving ? "Salvando…" : "Cadastrar parceiro"}
        </Button>
      </form>

      {affiliates === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : affiliates.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhum parceiro ainda.</p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {affiliates.map((a) => {
            const s = statsById.get(a.id) ?? { sales: 0, revenue: 0, pending: 0, paid: 0 };
            const link = `${origin}/c/${a.code}`;
            const dash = `${origin}/parceiro/${a.access_token}`;
            return (
              <div
                key={a.id}
                className={`rounded-2xl bg-card p-5 card-soft ${a.is_active ? "" : "opacity-60"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono font-bold uppercase text-foreground">
                        {a.code}
                      </span>{" "}
                      · cliente −{a.discount_pct}% · comissão {a.commission_pct}%
                      {a.instagram ? ` · @${a.instagram}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleActive(a)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      a.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {a.is_active ? "Ativo" : "Pausado"}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <Mini label="Cliques" value={String(a.clicks)} />
                  <Mini label="Vendas" value={`${s.sales} · ${money(s.revenue)}`} />
                  <Mini label="A pagar" value={money(s.pending)} highlight={s.pending > 0} />
                  <Mini label="Pago" value={money(s.paid)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copy(link, "Link de divulgação")}
                  >
                    <Copy className="size-3.5" /> Link de divulgação
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copy(dash, "Painel do parceiro")}
                  >
                    <Copy className="size-3.5" /> Painel do parceiro
                  </Button>
                  {s.pending > 0 && (
                    <Button
                      size="sm"
                      disabled={paying === a.id}
                      onClick={() => void pay(a, s.pending)}
                    >
                      {paying === a.id ? "Salvando…" : `Marcar pago ${money(s.pending)}`}
                    </Button>
                  )}
                </div>
                {a.pix_key && (
                  <p className="mt-3 break-all text-xs text-muted-foreground">
                    Pix: <span className="font-mono text-foreground">{a.pix_key}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-2 ${highlight ? "bg-amber-100" : "bg-secondary"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
