import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";

type Row = { plate_id: string; day: string; nfc: number; qr: number; desconhecido: number; leituras: number };
type P = { id: string; short_code: string; business_name: string | null };

const PERIODS = [7, 30, 90] as const;

/** Plus: toques NFC e leituras de QR por dia, com período e total por código. Só números agregados (nada de pessoa). */
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
    return plates
      .map((p) => ({ p, c: m.get(p.id) ?? { nfc: 0, qr: 0, total: 0 } }))
      .sort((a, b) => b.c.total - a.c.total);
  }, [rows, plates]);
  const max = Math.max(1, ...byDay.map(([, n]) => n));
  const total = byDay.reduce((s, [, n]) => s + n, 0);

  if (plates.length === 0) return null;
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 card-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">
          Estatísticas <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Plus</span>
        </h2>
        <div className="flex gap-1 text-xs">
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg border px-2.5 py-1 ${d === days ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted"}`}
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
          <p className="mt-3 text-sm">
            <strong>{total}</strong> leituras nos últimos {days} dias (só pessoas, sem robôs). Números agregados por dia.
          </p>
          {byDay.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto text-xs">
              {byDay.map(([d, n]) => (
                <li key={d} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-muted-foreground">{d.split("-").reverse().slice(0, 2).join("/")}</span>
                  <span className="h-2 rounded bg-primary" style={{ width: `${(n / max) * 100}%`, minWidth: 2 }} />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Código</th>
                <th>NFC</th>
                <th>QR</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {byCode.map(({ p, c }) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-1">
                    <span className="font-mono">{p.short_code}</span> <span className="text-muted-foreground">{p.business_name ?? ""}</span>
                  </td>
                  <td>{c.nfc}</td>
                  <td>{c.qr}</td>
                  <td className="font-semibold">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Placas antigas não separam NFC de QR: entram só no total.</p>
        </>
      )}
    </section>
  );
}
