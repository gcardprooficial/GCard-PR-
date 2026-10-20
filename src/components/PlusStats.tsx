import { useEffect, useMemo, useState } from "react";
import { QrCode, Radio, Eye, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { AreaChart, Donut } from "@/components/ativar/Charts";

type Row = { plate_id: string; day: string; nfc: number; qr: number; desconhecido: number; leituras: number };
type P = { id: string; short_code: string; business_name: string | null };

const PERIODS = [7, 30, 90] as const;

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 card-soft">
      <span className={`inline-flex size-9 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <p className="mt-3 font-display text-3xl font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

/** Plus: leituras por dia (gráfico), origem (rosca) e ranking de códigos, com período. Só números agregados (nada de pessoa). */
export function PlusStats({ plates }: { plates: P[] }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  // A lista chega nova a cada render do pai: a chave em texto evita buscar de novo sem necessidade.
  const idsKey = plates.map((p) => p.id).join(",");

  useEffect(() => {
    if (!idsKey) return;
    setRows(null);
    setError(false);
    const since = new Date(Date.now() - days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    void untyped(supabase)
      .from("plate_scan_daily")
      .select("plate_id, day, nfc, qr, desconhecido, leituras")
      .in("plate_id", idsKey.split(","))
      .gte("day", since)
      .order("day", { ascending: true })
      .then(({ data, error: e }: { data: Row[] | null; error: unknown }) => (e ? setError(true) : setRows(data ?? [])));
  }, [idsKey, days]);

  const { series, firstDay, lastDay } = useMemo(() => {
    // todos os dias do período (dia sem leitura = 0), para o gráfico não "pular"
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.day, (m.get(r.day) ?? 0) + Number(r.leituras));
    const out: number[] = [];
    let first = "", last = "";
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      if (i === days - 1) first = d;
      last = d;
      out.push(m.get(d) ?? 0);
    }
    return { series: out, firstDay: first, lastDay: last };
  }, [rows, days]);
  const byCode = useMemo(() => {
    const m = new Map<string, { nfc: number; qr: number; total: number }>();
    for (const r of rows ?? []) {
      const c = m.get(r.plate_id) ?? { nfc: 0, qr: 0, total: 0 };
      c.nfc += Number(r.nfc);
      c.qr += Number(r.qr);
      c.total += Number(r.leituras);
      m.set(r.plate_id, c);
    }
    return plates.map((p) => ({ p, c: m.get(p.id) ?? { nfc: 0, qr: 0, total: 0 } })).sort((a, b) => b.c.total - a.c.total);
  }, [rows, plates]);
  const total = series.reduce((s, n) => s + n, 0);
  const nfc = byCode.reduce((s, x) => s + x.c.nfc, 0);
  const qr = byCode.reduce((s, x) => s + x.c.qr, 0);
  const other = Math.max(0, total - nfc - qr);
  const topMax = Math.max(1, ...byCode.map((x) => x.c.total));
  const fmt = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

  if (plates.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Ative um código para ver as estatísticas aqui.</p>;
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold">Visão geral</h3>
        <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-semibold">
          {PERIODS.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1.5 transition-colors ${d === days ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-muted-foreground">Não consegui carregar agora.</p>
      ) : rows === null ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Kpi icon={<Eye className="size-4" />} label="Leituras" value={total} tone="bg-primary/20 text-foreground" />
            <Kpi icon={<Radio className="size-4" />} label="Toques NFC" value={nfc} tone="bg-secondary text-secondary-foreground" />
            <Kpi icon={<QrCode className="size-4" />} label="Leituras de QR" value={qr} tone="bg-muted text-foreground" />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl border border-border bg-card p-4 card-soft">
              <p className="text-sm font-semibold">Leituras por dia</p>
              <div className="mt-3">
                <AreaChart values={series} labels={[fmt(firstDay), fmt(lastDay)]} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Só pessoas, sem robôs. Números agregados por dia.</p>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-4 card-soft">
              <p className="self-start text-sm font-semibold">De onde vêm</p>
              <div className="mt-2">
                <Donut
                  parts={[
                    { value: nfc, color: "var(--secondary)", label: "NFC" },
                    { value: qr, color: "var(--primary)", label: "QR" },
                    { value: other, color: "#CBD5E1", label: "Sem origem" },
                  ]}
                />
              </div>
              <ul className="mt-2 w-full space-y-1 text-xs">
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-secondary" />NFC <b className="ml-auto">{nfc}</b></li>
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />QR <b className="ml-auto">{qr}</b></li>
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-slate-300" />Placas antigas <b className="ml-auto">{other}</b></li>
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 card-soft">
            <p className="flex items-center gap-2 text-sm font-semibold"><Trophy className="size-4 text-primary" /> Códigos mais lidos</p>
            <ul className="mt-3 space-y-3">
              {byCode.slice(0, 8).map(({ p, c }, i) => (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate"><span className="mr-2 text-xs text-muted-foreground">{i + 1}º</span><b>{p.business_name || p.short_code}</b> <span className="font-mono text-[11px] text-muted-foreground">{p.short_code}</span></span>
                    <span className="font-display font-black">{c.total}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(c.total ? 4 : 0, (c.total / topMax) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
