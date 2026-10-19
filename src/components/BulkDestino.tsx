import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkDestination, type DestinationRule } from "@/lib/destination";

type P = { id: string; short_code: string; status: string; business_name: string | null; destination_url: string | null };

/** Plus: trocar o destino de várias placas ativadas de uma vez. Mesma regra do destino individual (lista de hosts liberados). */
export function BulkDestino({ plates, rules, allowedUrls, onDone }: { plates: P[]; rules: DestinationRule[]; allowedUrls: string[]; onDone: () => void }) {
  const ativadas = useMemo(() => plates.filter((p) => p.status === "ativada"), [plates]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  if (ativadas.length < 2) return null;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function apply() {
    const checked = checkDestination(url, rules, allowedUrls);
    if (!checked.ok) return void toast.error(checked.reason);
    if (sel.size === 0) return void toast.error("Marque pelo menos uma placa.");
    setBusy(true);
    const { error } = await supabase.from("plates").update({ destination_url: checked.url }).in("id", [...sel]).eq("status", "ativada");
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`Destino trocado em ${sel.size} placa(s).`);
    setSel(new Set());
    setUrl("");
    onDone();
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 card-soft">
      <h2 className="text-base font-bold">Trocar destino em lote <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Plus</span></h2>
      <p className="mt-1 text-xs text-muted-foreground">Marque as placas e informe o novo link. Vale para todas de uma vez.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button type="button" className="underline" onClick={() => setSel(new Set(ativadas.map((p) => p.id)))}>Marcar todas</button>
        <button type="button" className="underline" onClick={() => setSel(new Set())}>Limpar</button>
        <span className="text-muted-foreground">{sel.size} de {ativadas.length} marcadas</span>
      </div>
      <ul className="mt-2 grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
        {ativadas.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
              <span className="font-mono text-xs">{p.short_code}</span>
              <span className="truncate text-muted-foreground">{p.business_name ?? ""}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… novo destino" className="h-10 input-soft rounded-xl" />
        <Button onClick={() => void apply()} disabled={busy} className="rounded-xl">{busy ? "Trocando…" : "Trocar"}</Button>
      </div>
    </section>
  );
}
