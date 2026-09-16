import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/painel/scans")({ component: Scans });

type PlateRow = {
  id: string;
  token: string;
  status: string;
  scan_count: number;
  last_scan_at: string | null;
  businesses: { name: string } | null;
  products: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  nao_ativada: "Não ativada",
  ativada: "Ativada",
  bloqueada: "Bloqueada",
};
type Event = { plate_id: string | null; created_at: string; device: string | null };

const DAY = 86_400_000;

function Scans() {
  const [plates, setPlates] = useState<PlateRow[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const [p, e] = await Promise.all([
      supabase
        .from("plates")
        .select("id, token, status, scan_count, last_scan_at, businesses(name), products(name)")
        .order("scan_count", { ascending: false })
        .limit(500),
      supabase
        .from("plate_scan_events")
        .select("plate_id, created_at, device")
        .gte("created_at", since)
        .limit(5000),
    ]);
    if (p.error || e.error) {
      toast.error("Não foi possível carregar os scans.");
      return;
    }
    setPlates((p.data ?? []) as unknown as PlateRow[]);
    setEvents((e.data ?? []) as Event[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    const per = new Map<string, { d7: number; d30: number }>();
    let d7 = 0;
    let d30 = 0;
    let mobile = 0;
    for (const ev of events) {
      const age = now - new Date(ev.created_at).getTime();
      const key = ev.plate_id ?? "—";
      const cur = per.get(key) ?? { d7: 0, d30: 0 };
      cur.d30 += 1;
      d30 += 1;
      if (age <= 7 * DAY) {
        cur.d7 += 1;
        d7 += 1;
      }
      if (ev.device === "mobile") mobile += 1;
      per.set(key, cur);
    }
    return { per, d7, d30, mobilePct: d30 ? Math.round((mobile / d30) * 100) : 0 };
  }, [events]);

  const allTime = (plates ?? []).reduce((s, p) => s + p.scan_count, 0);

  const filtered = (plates ?? []).filter((p) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      p.token.toLowerCase().includes(t) ||
      p.businesses?.name.toLowerCase().includes(t) ||
      p.products?.name.toLowerCase().includes(t)
    );
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Scans</h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar placa, negócio, produto…"
          className="h-9 w-64"
        />
      </div>
      {plates && plates.length >= 500 && (
        <p className="mt-1 text-xs text-amber-800">
          Tabela mostra as 500 placas com mais scans — não é a lista completa.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total (sempre)" value={allTime} />
        <Stat label="Últimos 30 dias" value={stats.d30} />
        <Stat label="Últimos 7 dias" value={stats.d7} />
        <Stat label="Mobile (30d)" value={`${stats.mobilePct}%`} />
      </div>

      {plates === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : plates.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhuma placa ainda.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nada encontrado.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-card card-soft">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Negócio</th>
                <th className="px-4 py-3 text-right">7 dias</th>
                <th className="px-4 py-3 text-right">30 dias</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Último</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const s = stats.per.get(p.id) ?? { d7: 0, d30: 0 };
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{p.token}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.products?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.status === "ativada"
                            ? "bg-green-100 text-green-800"
                            : p.status === "bloqueada"
                              ? "bg-red-100 text-red-800"
                              : "bg-accent text-accent-foreground"
                        }`}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.businesses?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{s.d7}</td>
                    <td className="px-4 py-3 text-right">{s.d30}</td>
                    <td className="px-4 py-3 text-right font-semibold">{p.scan_count}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.last_scan_at ? new Date(p.last_scan_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-card p-5 card-soft">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
