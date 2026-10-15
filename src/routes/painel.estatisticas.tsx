import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">GCard Plus</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Estatísticas por código</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
        <span>Recurso: <strong>{enabled === null ? "…" : enabled ? "ligado" : "desligado"}</strong></span>
        {enabled !== null && <Button size="sm" variant="outline" onClick={toggle}>{enabled ? "Desligar" : "Ligar"}</Button>}
        <span className="text-muted-foreground">Não cobra nada. Só mostra toques e leituras por dia.</span>
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

  return (
    <div className="mt-5 grid gap-5 md:grid-cols-[18rem_1fr]">
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
              <Box label="Toques NFC" value={total.nfc} />
              <Box label="Leituras QR" value={total.qr} />
              <Box label="Origem desconhecida" value={total.unk} />
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
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Azul = NFC, amarelo = QR. Robôs e pré-visualizações não entram. Placas antigas (sem origem) aparecem como "desconhecido".</p>
          </>
        )}
      </div>
    </div>
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
