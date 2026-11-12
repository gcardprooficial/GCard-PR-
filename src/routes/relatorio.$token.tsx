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
    <div className="v2">
      <div className="lp" style={{ minHeight: "100vh" }}>
        <div className="lp-bg print:hidden" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>
        <header style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--card) 85%, transparent)" }}>
          <div className="row between" style={{ maxWidth: 860, margin: "0 auto", padding: "14px 20px" }}>
            <img src={logoMarca} alt="GCard-PRÓ" className="h-5 w-auto" style={{ filter: "invert(1)" }} />
            <button type="button" onClick={() => window.print()} className="btn print:hidden"><Printer size={15} /> Salvar em PDF</button>
          </div>
        </header>
        <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 56px" }}>
          {error ? (
            <div className="card col center" style={{ padding: 32, alignItems: "center" }}>
              <h1>{error === "rate_limited" ? "Muitos acessos" : "Relatório indisponível"}</h1>
              <p className="sm muted">
                {error === "not_found" ? "Esse link não existe ou foi desativado." : error === "rate_limited" ? "Aguarde um minuto e recarregue." : "Este relatório está indisponível no momento. Fale com quem enviou o link."}
              </p>
            </div>
          ) : !report ? (
            <p className="sm muted">Carregando…</p>
          ) : (
            <div className="col" style={{ gap: 16 }}>
              <div>
                <div className="eyebrow">Relatório de leituras</div>
                <h1>{report.name}</h1>
                <p className="sm muted" style={{ marginTop: 4 }}>{fmt(report.from)} a {fmt(report.to)} · código {report.shortCode}</p>
              </div>
              <div className="seg print:hidden">
                {([7, 30, 90] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setDays(d)} className={`chip ${d === days ? "on" : ""}`}>{d} dias</button>
                ))}
              </div>
              <div className="metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                {[["Leituras", t.total], ["Toques NFC", t.nfc], ["Leituras de QR", t.qr]].map(([l, v]) => (
                  <div key={l as string} className="metric"><div className="xs muted">{l}</div><div className="v">{v}</div></div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
                <div className="card">
                  <b>Leituras por dia</b>
                  <div style={{ marginTop: 10 }}><AreaChart values={report.series.map((s) => s.leituras)} labels={[fmt(report.from), fmt(report.to)]} height={170} /></div>
                </div>
                <div className="card col" style={{ alignItems: "center" }}>
                  <b style={{ alignSelf: "flex-start" }}>De onde vêm</b>
                  <Donut parts={[{ value: t.nfc, color: "var(--brand)", label: "NFC" }, { value: t.qr, color: "var(--ink)", label: "QR" }, { value: Math.max(0, t.total - t.nfc - t.qr), color: "var(--line)", label: "Sem origem" }]} />
                </div>
              </div>
              <p className="xs muted">Contagem de leituras do código (só pessoas, sem robôs), agregada por dia. Nenhum dado pessoal é coletado ou mostrado. Gerado pelo GCard-PRÓ Plus.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
