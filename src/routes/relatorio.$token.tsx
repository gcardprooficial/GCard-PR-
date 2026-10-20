import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { getPublicReport, type PublicReport } from "@/lib/report.functions";
import { AreaChart, Donut } from "@/components/ativar/Charts";
import logoMarca from "@/assets/logo/header-marca.png";

export const Route = createFileRoute("/relatorio/$token")({
  head: () => ({ meta: [{ title: "Relatório de leituras | GCard-PRÓ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Relatorio,
});

const fmt = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

function Relatorio() {
  const { token } = Route.useParams();
  const fetchReport = useServerFn(getPublicReport);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<PublicReport | null>(null);
  const [error, setError] = useState<"not_found" | "unavailable" | "rate_limited" | null>(null);

  useEffect(() => {
    setReport(null);
    fetchReport({ data: { token, days } })
      .then((r) => (r.ok ? (setReport(r.report), setError(null)) : setError(r.error)))
      .catch(() => setError("unavailable"));
  }, [token, days, fetchReport]);

  const t = useMemo(() => {
    const s = report?.series ?? [];
    return { total: s.reduce((a, x) => a + x.leituras, 0), nfc: s.reduce((a, x) => a + x.nfc, 0), qr: s.reduce((a, x) => a + x.qr, 0) };
  }, [report]);

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <header className="bg-foreground text-white print:bg-white print:text-black">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <img src={logoMarca} alt="GCard-PRÓ" className="h-5 w-auto print:invert" />
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-xs font-bold hover:bg-white/10 print:hidden">
            <Printer className="size-4" /> Salvar em PDF
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        {error ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="font-display text-xl font-bold">{error === "rate_limited" ? "Muitos acessos" : "Relatório indisponível"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error === "not_found" ? "Esse link não existe ou foi desativado." : error === "rate_limited" ? "Aguarde um minuto e recarregue." : "Este relatório está indisponível no momento. Fale com quem enviou o link."}
            </p>
          </div>
        ) : !report ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relatório de leituras</p>
            <h1 className="font-display text-3xl font-bold">{report.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmt(report.from)} a {fmt(report.to)} · código {report.shortCode}
            </p>
            <div className="mt-4 flex gap-1 self-start rounded-full bg-muted p-1 text-xs font-semibold print:hidden">
              {([7, 30, 90] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1.5 ${d === days ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {d} dias
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[["Leituras", t.total], ["Toques NFC", t.nfc], ["Leituras de QR", t.qr]].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-display text-3xl font-black leading-none">{v}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Leituras por dia</p>
                <div className="mt-3"><AreaChart values={report.series.map((s) => s.leituras)} labels={[fmt(report.from), fmt(report.to)]} /></div>
              </div>
              <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-4">
                <p className="self-start text-sm font-semibold">De onde vêm</p>
                <div className="mt-2">
                  <Donut parts={[{ value: t.nfc, color: "var(--secondary)", label: "NFC" }, { value: t.qr, color: "var(--primary)", label: "QR" }, { value: Math.max(0, t.total - t.nfc - t.qr), color: "#CBD5E1", label: "Sem origem" }]} />
                </div>
              </div>
            </div>
            <p className="mt-6 text-[11px] text-muted-foreground">Contagem de leituras do código (só pessoas, sem robôs), agregada por dia. Nenhum dado pessoal é coletado ou mostrado. Gerado pelo GCard-PRÓ Plus.</p>
          </>
        )}
      </main>
    </div>
  );
}
