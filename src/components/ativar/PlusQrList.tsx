import { useState } from "react";
import { Download, QrCode, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkDestination, type DestinationRule } from "@/lib/destination";
import { downloadQr } from "@/components/PlusQrCreator";

export type QrPlate = { id: string; token: string; short_code: string; business_name: string | null; destination_url: string | null; scan_count: number; plus_created?: boolean };

type P = QrPlate;

function Row({ p, rules, allowedUrls, active, onRemove, onDone }: { p: P; rules: DestinationRule[]; allowedUrls: string[]; active: boolean; onRemove: (p: P) => void; onDone: () => void }) {
  const [url, setUrl] = useState(p.destination_url ?? "");
  const [busy, setBusy] = useState(false);
  const changed = url.trim() !== (p.destination_url ?? "");

  async function save() {
    const c = checkDestination(url, rules, allowedUrls);
    if (!c.ok) return void toast.error(c.reason);
    setBusy(true);
    const { error } = await supabase.from("plates").update({ destination_url: c.url }).eq("id", p.id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Destino trocado. O mesmo QR já aponta para o novo link.");
    onDone();
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4 card-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><QrCode className="size-5" /></span>
          <div className="min-w-0">
            <p className="truncate font-bold">{p.business_name || "QR sem nome"}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{p.short_code} · {p.scan_count} leituras</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="outline" className="size-9 rounded-xl" aria-label="Baixar PNG" title="Baixar PNG" onClick={() => void downloadQr(p, "png")}><Download className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-9 rounded-xl text-destructive hover:bg-destructive/10" aria-label="Apagar QR" title="Apagar QR" onClick={() => onRemove(p)}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} disabled={!active} className="h-10 input-soft rounded-xl" aria-label="Destino do QR" />
        <Button onClick={() => void save()} disabled={!active || !changed || busy} className="gap-1.5 rounded-xl"><Save className="size-4" />{busy ? "Salvando…" : "Trocar destino"}</Button>
      </div>
      {!active && <p className="mt-2 text-xs text-muted-foreground">Plus inativo: o destino fica como está até você reativar. O QR continua funcionando.</p>}
    </li>
  );
}

/** Central dos QR Codes dinâmicos: troca de destino sem reimprimir, download e apagar. */
export function PlusQrList({ plates, rules, allowedUrls, active, onRemove, onDone }: { plates: P[]; rules: DestinationRule[]; allowedUrls: string[]; active: boolean; onRemove: (p: P) => void; onDone: () => void }) {
  const mine = plates.filter((p) => p.plus_created);
  if (mine.length === 0) return null;
  return (
    <section>
      <h3 className="font-display text-lg font-bold">Meus QR Codes dinâmicos</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">Imprima uma vez. Troque o destino quando quiser, sem reimprimir.</p>
      <ul className="mt-3 space-y-3">
        {mine.map((p) => (
          <Row key={p.id} p={p} rules={rules} allowedUrls={allowedUrls} active={active} onRemove={onRemove} onDone={onDone} />
        ))}
      </ul>
    </section>
  );
}
