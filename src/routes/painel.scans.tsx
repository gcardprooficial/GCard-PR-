import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart } from "@/components/ativar/Charts";

export const Route = createFileRoute("/painel/scans")({ component: Scans });

type PlateRow = {
  id: string;
  token: string;
  short_code: string;
  status: string;
  scan_count: number;
  last_scan_at: string | null;
  batch_id: string | null;
  business_name: string | null;
  businesses: { name: string } | null;
  products: { name: string } | null;
  batches: { code: string; label: string | null; owner_email: string | null } | null;
};
type Event = { plate_id: string | null; created_at: string; device: string | null };

const DAY = 86_400_000;
const PAGE = 15;

/** Quem é o dono da placa: o cliente do lote (nota ou e-mail) ou "Estoque solto". */
const ownerOf = (p: PlateRow) => (p.batches ? p.batches.label || p.batches.owner_email || p.batches.code : "Estoque solto");

function Scans() {
  const [plates, setPlates] = useState<PlateRow[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"com" | "todas">("com");
  const [view, setView] = useState<"clientes" | "placas">("clientes");
  const [limit, setLimit] = useState(PAGE);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const [p, e] = await Promise.all([
      supabase
        .from("plates")
        .select("id, token, short_code, status, scan_count, last_scan_at, batch_id, business_name, businesses(name), products(name), batches(code, label, owner_email)")
        .order("scan_count", { ascending: false })
        .limit(500),
      supabase.from("plate_scan_events").select("plate_id, created_at, device").gte("created_at", since).limit(5000),
    ]);
    if (p.error || e.error) {
      toast.error("Não foi possível carregar as leituras.");
      return;
    }
    setPlates((p.data ?? []) as unknown as PlateRow[]);
    setEvents((e.data ?? []) as Event[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setLimit(PAGE), [q, only, view]);

  const stats = useMemo(() => {
    const now = Date.now();
    const per = new Map<string, { d7: number; d30: number }>();
    const byDay = new Array<number>(30).fill(0);
    let d7 = 0;
    let d30 = 0;
    let mobile = 0;
    for (const ev of events) {
      const age = now - new Date(ev.created_at).getTime();
      const cur = per.get(ev.plate_id ?? "—") ?? { d7: 0, d30: 0 };
      cur.d30 += 1;
      d30 += 1;
      if (age <= 7 * DAY) {
        cur.d7 += 1;
        d7 += 1;
      }
      if (ev.device === "mobile") mobile += 1;
      per.set(ev.plate_id ?? "—", cur);
      const idx = 29 - Math.min(29, Math.floor(age / DAY));
      byDay[idx] = (byDay[idx] ?? 0) + 1;
    }
    return { per, d7, d30, byDay, mobilePct: d30 ? Math.round((mobile / d30) * 100) : 0 };
  }, [events]);

  const allTime = (plates ?? []).reduce((s, p) => s + p.scan_count, 0);

  // Por cliente (lote): soma das leituras das placas dele.
  const clients = useMemo(() => {
    const map = new Map<string, { key: string; name: string; code: string; plates: number; active: number; d30: number; total: number }>();
    for (const p of plates ?? []) {
      const key = p.batch_id ?? "estoque";
      const cur = map.get(key) ?? { key, name: ownerOf(p), code: p.batches?.code ?? "—", plates: 0, active: 0, d30: 0, total: 0 };
      cur.plates += 1;
      if (p.status === "ativada") cur.active += 1;
      cur.d30 += stats.per.get(p.id)?.d30 ?? 0;
      cur.total += p.scan_count;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.d30 - a.d30 || b.total - a.total);
  }, [plates, stats]);

  const t = q.trim().toLowerCase();
  const filteredClients = clients.filter((c) => (only === "todas" || c.total > 0) && (!t || c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t)));
  const filteredPlates = (plates ?? []).filter((p) => {
    if (only === "com" && p.scan_count === 0) return false;
    if (!t) return true;
    return (
      p.short_code.toLowerCase().includes(t) ||
      p.token.toLowerCase().includes(t) ||
      (p.business_name ?? p.businesses?.name ?? "").toLowerCase().includes(t) ||
      ownerOf(p).toLowerCase().includes(t) ||
      p.batches?.code.toLowerCase().includes(t)
    );
  });
  const list = view === "clientes" ? filteredClients : filteredPlates;

  return (
    <>
      <div className="mb">
        <div className="eyebrow">Leituras</div>
        <h1>Scans</h1>
        <p className="muted sm" style={{ marginTop: 4 }}>Quantas vezes as placas foram lidas, por cliente (lote) e por placa. Robôs e pré-visualizações ficam de fora.</p>
      </div>

      <div className="metrics mb" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <div className="metric"><div className="xs muted">Total (sempre)</div><div className="v">{allTime}</div></div>
        <div className="metric"><div className="xs muted">Últimos 30 dias</div><div className="v">{stats.d30}</div></div>
        <div className="metric"><div className="xs muted">Últimos 7 dias</div><div className="v">{stats.d7}</div></div>
        <div className="metric"><div className="xs muted">No celular (30 dias)</div><div className="v">{stats.mobilePct}%</div></div>
      </div>

      <div className="card mb">
        <b>Leituras por dia (últimos 30 dias)</b>
        <AreaChart values={stats.byDay} height={130} />
      </div>

      <div className="seg" style={{ marginBottom: 10 }}>
        <button type="button" className={`chip ${view === "clientes" ? "on" : ""}`} onClick={() => setView("clientes")}>Por cliente · {clients.length}</button>
        <button type="button" className={`chip ${view === "placas" ? "on" : ""}`} onClick={() => setView("placas")}>Por placa · {plates?.length ?? 0}</button>
      </div>
      <div className="row wrap mb" style={{ gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={view === "clientes" ? "Buscar cliente ou lote" : "Buscar placa, negócio, cliente ou lote"} className="input" style={{ flex: "1 1 260px", width: "auto" }} />
        <select aria-label="Mostrar" value={only} onChange={(e) => setOnly(e.target.value as typeof only)} className="input" style={{ flex: "0 1 220px", width: "auto" }}>
          <option value="com">Só com leituras</option>
          <option value="todas">Todas</option>
        </select>
      </div>
      {plates && plates.length >= 500 && <p className="xs muted mb">Considerando as 500 placas com mais leituras.</p>}

      {plates === null ? (
        <p className="sm muted">Carregando…</p>
      ) : list.length === 0 ? (
        <div className="card panel center sm muted" style={{ padding: 22 }}>Nada encontrado.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          {view === "clientes" ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs muted"><tr><th className="p-3">Cliente</th><th className="p-3">Lote</th><th className="p-3 text-right">Placas</th><th className="p-3 text-right">Ativas</th><th className="p-3 text-right">30 dias</th><th className="p-3 text-right">Total</th></tr></thead>
              <tbody>
                {(filteredClients.slice(0, limit)).map((c) => (
                  <tr key={c.key} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="p-3"><b>{c.name}</b></td>
                    <td className="p-3 font-mono text-xs">{c.code}</td>
                    <td className="p-3 text-right">{c.plates}</td>
                    <td className="p-3 text-right">{c.active}</td>
                    <td className="p-3 text-right">{c.d30}</td>
                    <td className="p-3 text-right"><b>{c.total}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs muted"><tr><th className="p-3">Negócio</th><th className="p-3">Placa</th><th className="p-3">Cliente / lote</th><th className="p-3 text-right">7 dias</th><th className="p-3 text-right">30 dias</th><th className="p-3 text-right">Total</th><th className="p-3">Última</th></tr></thead>
              <tbody>
                {filteredPlates.slice(0, limit).map((p) => {
                  const s = stats.per.get(p.id) ?? { d7: 0, d30: 0 };
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="p-3"><b>{p.business_name ?? p.businesses?.name ?? "Placa em branco"}</b><div className="xs muted">{p.products?.name ?? ""}</div></td>
                      <td className="p-3 font-mono text-xs">{p.short_code}{p.status === "bloqueada" && <span className="badge warn" style={{ marginLeft: 6 }}>bloqueada</span>}</td>
                      <td className="p-3">{ownerOf(p)}{p.batches ? <div className="xs muted font-mono">{p.batches.code}</div> : null}</td>
                      <td className="p-3 text-right">{s.d7}</td>
                      <td className="p-3 text-right">{s.d30}</td>
                      <td className="p-3 text-right"><b>{p.scan_count}</b></td>
                      <td className="p-3 muted">{p.last_scan_at ? new Date(p.last_scan_at).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {list.length > limit && (
        <div className="center" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>Mostrar mais ({list.length - limit} restantes)</button>
        </div>
      )}
    </>
  );
}
