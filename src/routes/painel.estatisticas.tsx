import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaChart } from "@/components/ativar/Charts";

export const Route = createFileRoute("/painel/estatisticas")({ component: Stats });

type Plate = { id: string; token: string; short_code: string; status: string; scan_count: number };
type Day = { day: string; leituras: number; leituras_unicas: number; nfc: number; qr: number; desconhecido: number };

const DAY_MS = 86_400_000;
const db = untyped(supabase);

/** Estatísticas por código (toques NFC × leituras QR por dia). Atrás da flag app_settings.gcard_plus, desligada por padrão. */
function Stats() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    db.from("app_settings").select("value").eq("key", "gcard_plus").maybeSingle()
      .then(({ data }: { data: { value?: { enabled?: boolean } } | null }) => setEnabled(Boolean(data?.value?.enabled)));
  }, []);

  async function toggle() {
    const next = !enabled;
    const { error } = await db.from("app_settings").upsert({ key: "gcard_plus", value: { enabled: next } }, { onConflict: "key" });
    if (error) return void toast.error("Não consegui salvar.");
    setEnabled(next);
    toast.success(next ? "Estatísticas ligadas." : "Estatísticas desligadas.");
  }

  return (
    <div>
      <div className="mb">
        <div className="eyebrow">GCard Plus</div>
        <h1>Estatísticas por código</h1>
        <p className="muted sm" style={{ marginTop: 4 }}>Leituras por dia, no total e por código. NFC e QR aparecem separados só nas placas novas; as antigas contam como “sem origem”.</p>
      </div>
      <div className="card goldframe row wrap mb" style={{ gap: 12 }}>
        <span className="plustag">Plus</span>
        <span className="sm grow">Recurso <b>{enabled === null ? "…" : enabled ? "ligado" : "desligado"}</b>. Não cobra nada: só mostra toques e leituras por dia.</span>
        {enabled !== null && <button type="button" className="btn" onClick={toggle}>{enabled ? "Desligar" : "Ligar"}</button>}
      </div>
      {enabled && <Viewer />}
    </div>
  );
}

function Viewer() {
  const [q, setQ] = useState("");
  const [plates, setPlates] = useState<Plate[] | null>(null);
  const [picked, setPicked] = useState<Plate | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [range, setRange] = useState(30);

  const search = useCallback(async () => {
    const t = q.trim();
    let query = db.from("plates").select("id, token, short_code, status, scan_count").order("scan_count", { ascending: false }).limit(20);
    if (t) query = query.or(`short_code.ilike.%${t.replace(/[%,()]/g, "")}%,token.ilike.%${t.replace(/[%,()]/g, "")}%`);
    const { data, error } = await query;
    if (error) return void toast.error("Não consegui buscar.");
    setPlates((data ?? []) as Plate[]);
  }, [q]);
  useEffect(() => void search(), [search]);

  useEffect(() => {
    if (!picked) return;
    setDays(null);
    const since = new Date(Date.now() - range * DAY_MS).toISOString().slice(0, 10);
    db.from("plate_scan_daily").select("day, leituras, leituras_unicas, nfc, qr, desconhecido").eq("plate_id", picked.id).gte("day", since).order("day")
      .then(({ data, error }: { data: Day[] | null; error: unknown }) => {
        if (error) toast.error("Não consegui carregar as leituras.");
        setDays(data ?? []);
      });
  }, [picked, range]);

  const total = useMemo(
    () => (days ?? []).reduce((a, d) => ({ nfc: a.nfc + d.nfc, qr: a.qr + d.qr, unk: a.unk + d.desconhecido, uniq: a.uniq + d.leituras_unicas }), { nfc: 0, qr: 0, unk: 0, uniq: 0 }),
    [days],
  );
  const max = Math.max(1, ...(days ?? []).map((d) => d.leituras));

  type Top = { id: string; short_code: string; name: string; owner: string; nfc: number; qr: number; total: number };
  const [ov, setOv] = useState<{ nfc: number; qr: number; total: number; codes: number; series: number[]; tops: Top[] } | null>(null);
  const [ovErr, setOvErr] = useState(false);
  useEffect(() => {
    setOv(null);
    setOvErr(false);
    const since = new Date(Date.now() - range * DAY_MS).toISOString().slice(0, 10);
    db.from("plate_scan_daily").select("plate_id, day, leituras, nfc, qr").gte("day", since).limit(20000)
      .then(async ({ data, error }: { data: { plate_id: string; day: string; leituras: number; nfc: number; qr: number }[] | null; error: unknown }) => {
        if (error) return setOvErr(true);
        const rows = data ?? [];
        const byDay = new Map<string, number>();
        const per = new Map<string, { nfc: number; qr: number; total: number }>();
        let nfc = 0, qr = 0, total = 0;
        for (const r of rows) {
          byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.leituras);
          const c = per.get(r.plate_id) ?? { nfc: 0, qr: 0, total: 0 };
          c.nfc += r.nfc; c.qr += r.qr; c.total += r.leituras;
          per.set(r.plate_id, c);
          nfc += r.nfc; qr += r.qr; total += r.leituras;
        }
        const series = Array.from({ length: range }, (_, i) => byDay.get(new Date(Date.now() - (range - 1 - i) * DAY_MS).toISOString().slice(0, 10)) ?? 0);
        const top = [...per.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
        let tops: Top[] = [];
        if (top.length) {
          const { data: pl } = await db.from("plates").select("id, short_code, business_name, businesses(name), batches(label, owner_email, code)").in("id", top.map(([id]) => id));
          const info = new Map<string, { short_code: string; business_name: string | null; businesses: { name: string } | null; batches: { label: string | null; owner_email: string | null; code: string } | null }>((pl ?? []).map((x: { id: string; short_code: string; business_name: string | null; businesses: { name: string } | null; batches: { label: string | null; owner_email: string | null; code: string } | null }) => [x.id, x]));
          tops = top.map(([id, c]) => {
            const i = info.get(id);
            return { id, short_code: i?.short_code ?? id.slice(0, 8), name: i?.business_name ?? i?.businesses?.name ?? "Placa em branco", owner: i?.batches ? i.batches.label || i.batches.owner_email || i.batches.code : "Estoque solto", ...c };
          });
        }
        setOv({ nfc, qr, total, codes: per.size, series, tops });
      });
  }, [range]);

  return (
    <>
    <div className="mt-2">
      <div className="seg mb">
        {[7, 30, 90].map((r) => (
          <button key={r} type="button" className={`chip ${range === r ? "on" : ""}`} onClick={() => setRange(r)}>{r} dias</button>
        ))}
      </div>
      {ovErr ? (
        <div className="card panel sm muted">Não consegui carregar o resumo agora. Use a busca por código abaixo.</div>
      ) : ov === null ? (
        <p className="sm muted">Carregando resumo…</p>
      ) : (
        <div className="col" style={{ gap: 14 }}>
          <div className="metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <div className="metric"><div className="xs muted">Leituras</div><div className="v">{ov.total}</div></div>
            {ov.nfc + ov.qr > 0 && <div className="metric"><div className="xs muted">Toques NFC</div><div className="v">{ov.nfc}</div></div>}
            {ov.nfc + ov.qr > 0 && <div className="metric"><div className="xs muted">Leituras QR</div><div className="v">{ov.qr}</div></div>}
            <div className="metric"><div className="xs muted">Códigos com leitura</div><div className="v">{ov.codes}</div></div>
          </div>
          <div className="card"><b>Leituras por dia</b><AreaChart values={ov.series} height={130} /></div>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <div style={{ padding: "14px 16px 6px" }}><b>Mais lidos no período</b></div>
            {ov.tops.length === 0 ? (
              <p className="sm muted" style={{ padding: "0 16px 16px" }}>Sem leituras neste período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs muted"><tr><th className="p-3">Negócio</th><th className="p-3">Cliente / lote</th><th className="p-3">Código</th>{ov.nfc + ov.qr > 0 && <th className="p-3 text-right">NFC</th>}{ov.nfc + ov.qr > 0 && <th className="p-3 text-right">QR</th>}<th className="p-3 text-right">Leituras</th></tr></thead>
                <tbody>
                  {ov.tops.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }} onClick={() => { setPicked({ id: t.id, token: "", short_code: t.short_code, status: "", scan_count: t.total }); document.getElementById("ver-codigo")?.scrollIntoView({ behavior: "smooth" }); }}>
                      <td className="p-3"><b>{t.name}</b></td>
                      <td className="p-3">{t.owner}</td>
                      <td className="p-3 font-mono text-xs">{t.short_code}</td>
                      {ov.nfc + ov.qr > 0 && <td className="p-3 text-right">{t.nfc}</td>}
                      {ov.nfc + ov.qr > 0 && <td className="p-3 text-right">{t.qr}</td>}
                      <td className="p-3 text-right"><b>{t.total}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
    <h2 id="ver-codigo" className="mt-8">Ver um código</h2>
    <div className="mt-3 grid gap-5 md:grid-cols-[18rem_1fr]">
      <div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código…" className="h-9" />
        <ul className="mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-card text-sm">
          {plates === null && <li className="p-3 text-muted-foreground">Carregando…</li>}
          {plates?.length === 0 && <li className="p-3 text-muted-foreground">Nenhum código.</li>}
          {plates?.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setPicked(p)} className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted ${picked?.id === p.id ? "bg-primary/10" : ""}`}>
                <span className="font-mono text-xs font-bold">{p.short_code}</span>
                <span className="text-xs text-muted-foreground">{p.scan_count} leituras</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {!picked ? (
          <p className="text-sm text-muted-foreground">Escolha um código à esquerda.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-lg font-bold">{picked.short_code}</h2>
              {[7, 30, 90].map((r) => (
                <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>{r} dias</Button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {total.nfc + total.qr > 0 && <Box label="Toques NFC" value={total.nfc} />}
              {total.nfc + total.qr > 0 && <Box label="Leituras QR" value={total.qr} />}
              <Box label={total.nfc + total.qr > 0 ? "Sem origem (placa antiga)" : "Leituras (sem separar NFC e QR)"} value={total.unk} />
              <Box label="Visitantes únicos/dia (soma)" value={total.uniq} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-3">
              {days === null ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : days.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem leituras neste período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="p-2">Dia</th><th className="p-2">NFC</th><th className="p-2">QR</th><th className="p-2 w-1/2" /></tr>
                  </thead>
                  <tbody>
                    {[...days].reverse().map((d) => (
                      <tr key={d.day} className="border-t border-border">
                        <td className="p-2">{new Date(`${d.day}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                        <td className="p-2 tabular-nums">{d.nfc}</td>
                        <td className="p-2 tabular-nums">{d.qr}</td>
                        <td className="p-2">
                          <div className="flex h-3 overflow-hidden rounded bg-muted" style={{ width: `${(d.leituras / max) * 100}%` }}>
                            <div className="bg-primary" style={{ width: `${d.leituras ? (d.nfc / d.leituras) * 100 : 0}%` }} />
                            <div className="bg-amber-400" style={{ width: `${d.leituras ? (d.qr / d.leituras) * 100 : 0}%` }} />
                            <div className="bg-slate-400" style={{ width: `${d.leituras ? (d.desconhecido / d.leituras) * 100 : 0}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Azul = NFC, amarelo = QR, cinza = origem desconhecida. Robôs e pré-visualizações não entram. Placas antigas (sem origem) aparecem como "desconhecido".</p>
          </>
        )}
      </div>
    </div>
    </>
  );
}

function Box({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
