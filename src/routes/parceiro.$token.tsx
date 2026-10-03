import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAffiliateDashboard } from "@/lib/affiliates.functions";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/parceiro/$token")({
  head: () => ({
    meta: [{ title: "Painel do parceiro | GCard-PRÓ" }, { name: "robots", content: "noindex" }],
  }),
  component: Parceiro,
});

type Dashboard = Extract<Awaited<ReturnType<typeof getAffiliateDashboard>>, { ok: true }>;

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "A receber", cls: "bg-amber-100 text-amber-900" },
  paga: { label: "Pago", cls: "bg-green-100 text-green-800" },
  cancelada: { label: "Cancelada", cls: "bg-secondary text-muted-foreground" },
};

function Parceiro() {
  const { token } = Route.useParams();
  const fetchDash = useServerFn(getAffiliateDashboard);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError(true);
      return;
    }
    fetchDash({ data: { token } })
      .then((res) => (res.ok ? setData(res) : setError(true)))
      .catch(() => setError(true));
  }, [token, fetchDash]);

  if (error) {
    return (
      <Center>
        <p className="font-bold">Link inválido.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Peça o link do seu painel pra equipe GCard-PRÓ.
        </p>
      </Center>
    );
  }
  if (!data) return <Center>Carregando…</Center>;

  const link = `${window.location.origin}/c/${data.code}`;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-background px-4 py-8">
      <Link to="/" className="text-xs font-bold text-muted-foreground">
        GCard-PRÓ
      </Link>
      <h1 className="mt-2 text-2xl font-black">Olá, {data.name.split(" ")[0]} 👋</h1>
      {!data.isActive && (
        <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
          Seu cupom está pausado no momento.
        </p>
      )}

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Seu link de divulgação
        </p>
        <p className="mt-1 break-all font-mono text-sm font-bold">{link}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Quem compra por ele ganha <strong>{data.discountPct}% de desconto</strong> automático
          (cupom <strong className="uppercase">{data.code}</strong>) e você ganha{" "}
          <strong>{data.commissionPct}%</strong> do valor pago.
        </p>
        <Button
          className="mt-3 h-11 w-full rounded-xl font-bold"
          onClick={() => {
            navigator.clipboard
              .writeText(link)
              .then(() => toast.success("Link copiado."))
              .catch(() => toast.error("Não foi possível copiar."));
          }}
        >
          Copiar link
        </Button>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Cliques no link" value={String(data.clicks)} />
        <Stat label="Vendas" value={String(data.salesCount)} />
        <Stat
          label="A receber"
          value={money(data.pendingCents)}
          highlight={data.pendingCents > 0}
        />
        <Stat label="Já recebido" value={money(data.paidCents)} />
      </div>

      <h2 className="mt-8 text-sm font-black">Últimas vendas</h2>
      {data.sales.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma venda ainda. Bora divulgar! 🚀</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
          {data.sales.map((s, i) => {
            const st = STATUS[s.status] ?? STATUS["pendente"]!;
            return (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">Venda de {money(s.base_cents)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{money(s.amount_cents)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border p-4 ${highlight ? "bg-amber-50" : "bg-card"}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}
