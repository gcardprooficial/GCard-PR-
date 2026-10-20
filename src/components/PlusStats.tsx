import { useEffect, useMemo, useState } from "react";
import { QrCode, Radio, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";

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

/** Plus: toques NFC e leituras de QR por dia, com período, gráfico e total por código. Só números agregados (nada de pessoa). */
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

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.day, (m.get(r.day) ?? 0) + Number(r.leituras));
    return [...m.entries()];
  }, [rows]);
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
  const total = byDay.reduce((s, [, n]) => s + n, 0);
  const nfc = byCode.reduce((s, x) => s + x.c.nfc, 0);
  const qr = byCode.reduce((s, x) => s + x.c.qr, 0);
  const max = Math.max(1, ...byDay.map(([, n]) => n));
  const fmt = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

  if (plates.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Ative um código para ver as estatísticas aqui.
      </p>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold">Visão geral</h3>
        <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-semibold">
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1.5 transition-colors ${d === days ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
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

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 card-soft">
            <p className="text-sm font-semibold">Leituras por dia</p>
            {byDay.length === 0 ? (
              <p className="mt-6 pb-4 text-center text-sm text-muted-foreground">Nenhuma leitura neste período.</p>
            ) : (
              <>
                <div className="mt-3 flex h-36 items-end gap-[3px]" role="img" aria-label={`Gráfico de leituras por dia, total ${total}`}>
                  {byDay.map(([d, n]) => (
                    <div key={d} className="group relative flex h-full min-w-[3px] flex-1 items-end" title={`${fmt(d)}: ${n}`}>
                      <div className="w-full rounded-t bg-primary transition-colors group-hover:bg-foreground" style={{ height: `${Math.max(4, (n / max) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{fmt(byDay[0]![0])}</span>
                  <span>{fmt(byDay[byDay.length - 1]![0])}</span>
                </div>
              </>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Só pessoas, sem robôs. Números agregados por dia.</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card card-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-2 font-semibold">NFC</th>
                  <th className="px-2 font-semibold">QR</th>
                  <th className="px-4 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {byCode.map(({ p, c }) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-bold">{p.short_code}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.business_name ?? ""}</span>
                    </td>
                    <td className="px-2">{c.nfc}</td>
                    <td className="px-2">{c.qr}</td>
                    <td className="px-4 text-right font-bold">{c.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Placas antigas não separam NFC de QR: entram só no total.</p>
        </>
      )}
    </div>
  );
}
