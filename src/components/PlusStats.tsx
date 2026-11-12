import { useEffect, useMemo, useState } from "react";
import { QrCode, Radio, Eye, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { AreaChart, Donut } from "@/components/ativar/Charts";

type Row = { plate_id: string; day: string; nfc: number; qr: number; desconhecido: number; leituras: number };
type P = { id: string; short_code: string; business_name: string | null };

const PERIODS = [7, 30, 90] as const;

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="metric">
      <div className="xs muted row" style={{ gap: 6 }}>{icon}{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

/** Plus: leituras por dia (gráfico), origem (rosca) e ranking de códigos, com período. Só números agregados (nada de pessoa). */
export function PlusStats({ plates, onOpen }: { plates: P[]; onOpen?: (id: string) => void }) {
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
    return <div className="card panel center sm muted" style={{ padding: 22 }}>Ative um código para ver as estatísticas aqui.</div>;
  }
  return (
    <div>
      <div className="row between wrap mb" style={{ rowGap: 10 }}>
        <h2>Visão geral</h2>
        <div className="seg">
          {PERIODS.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`chip ${d === days ? "on" : ""}`}>
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="sm muted">Não consegui carregar agora.</p>
      ) : rows === null ? (
        <p className="sm muted">Carregando…</p>
      ) : (
        <div className="col" style={{ gap: 14 }}>
          <div className="metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <Kpi icon={<Eye size={14} />} label="Leituras" value={total} />
            <Kpi icon={<Radio size={14} />} label="Toques NFC" value={nfc} />
            <Kpi icon={<QrCode size={14} />} label="Leituras de QR" value={qr} />
          </div>

          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
            <div className="card">
              <b>Leituras por dia</b>
              <div style={{ marginTop: 10 }}>
                <AreaChart values={series} labels={[fmt(firstDay), fmt(lastDay)]} height={170} />
              </div>
              <p className="xs muted" style={{ marginTop: 6 }}>Só pessoas, sem robôs. Números agregados por dia.</p>
            </div>
            <div className="card col" style={{ alignItems: "center" }}>
              <b style={{ alignSelf: "flex-start" }}>De onde vêm</b>
              <Donut
                parts={[
                  { value: nfc, color: "var(--brand)", label: "NFC" },
                  { value: qr, color: "var(--ink)", label: "QR" },
                  { value: other, color: "var(--line)", label: "Sem origem" },
                ]}
              />
              <div className="col sm" style={{ width: "100%", gap: 6 }}>
                <div className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--brand)" }} />NFC <b style={{ marginLeft: "auto" }}>{nfc}</b></div>
                <div className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--ink)" }} />QR <b style={{ marginLeft: "auto" }}>{qr}</b></div>
                <div className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--line)" }} />Placas antigas <b style={{ marginLeft: "auto" }}>{other}</b></div>
              </div>
            </div>
          </div>

          {plates.length > 1 && (
            <div className="card col" style={{ gap: 12 }}>
              <b className="row" style={{ gap: 8 }}><Trophy size={16} color="var(--brand)" /> Códigos mais lidos</b>
              {byCode.slice(0, 8).map(({ p, c }, i) => (
                <div key={p.id}>
                  <div className="row sm" style={{ gap: 8 }}>
                    <button type="button" disabled={!onOpen} onClick={() => onOpen?.(p.id)} className="grow" style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: onOpen ? "pointer" : "default", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={onOpen ? "Ver só este código" : undefined}>
                      <span className="xs muted" style={{ marginRight: 8 }}>{i + 1}º</span><b>{p.business_name || p.short_code}</b> <span className="xs muted font-mono">{p.short_code}</span>
                    </button>
                    <b>{c.total}</b>
                  </div>
                  <div style={{ marginTop: 4, height: 8, borderRadius: 99, background: "var(--panel)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "var(--brand-grad)", width: `${Math.max(c.total ? 4 : 0, (c.total / topMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
