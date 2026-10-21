import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { Button } from "@/components/ui/button";

type Daily = { leituras: number; leituras_unicas: number; nfc: number; qr: number; desconhecido: number; robos: number };

/** Toques e leituras dos últimos 30 dias (só gente: robôs e pré-visualizações ficam separados). */
export function PlateScanStats({ plateId, extra }: { plateId: string; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Daily | null>(null);
  const [error, setError] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || stats) return;
    const since = new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { data, error: e } = await untyped(supabase)
      .from("plate_scan_daily")
      .select("leituras, leituras_unicas, nfc, qr, desconhecido, robos")
      .eq("plate_id", plateId)
      .gte("day", since);
    if (e) {
      setError(true);
      return;
    }
    const sum = (k: keyof Daily) => ((data ?? []) as Daily[]).reduce((s, r) => s + Number(r[k] ?? 0), 0);
    setStats({
      leituras: sum("leituras"),
      leituras_unicas: sum("leituras_unicas"),
      nfc: sum("nfc"),
      qr: sum("qr"),
      desconhecido: sum("desconhecido"),
      robos: sum("robos"),
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs underline" onClick={() => void toggle()}>
          Ver toques e leituras
        </Button>
        {extra}
      </div>
      {open && (
        <div className="mt-1 rounded-xl border border-border bg-muted/50 p-3 text-xs">
          {error ? (
            <p>Não consegui carregar agora.</p>
          ) : !stats ? (
            <p>Carregando…</p>
          ) : (
            <>
              <p className="font-semibold">Últimos 30 dias</p>
              <p className="mt-1">
                <strong>{stats.leituras}</strong> leituras · <strong>{stats.leituras_unicas}</strong> pessoas diferentes
                (contadas por dia)
              </p>
              <p className="mt-1 text-muted-foreground">
                NFC {stats.nfc} · QR {stats.qr} · origem não identificada {stats.desconhecido}
                {stats.robos > 0 ? ` · ${stats.robos} acessos automáticos (pré-visualizações) não contados` : ""}
              </p>
              <p className="mt-1 text-muted-foreground">
                Placas antigas não separam NFC de QR: aparecem como origem não identificada.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
