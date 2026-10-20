import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkDestination, type DestinationRule } from "@/lib/destination";
import { buildQrMatrix, downloadBlob, qrFilename, qrToPngBlob, qrToSvg } from "@/lib/qr-export";

type Made = { token: string; short_code: string };

/** Baixa o QR (com ?s=q para contar leituras de QR). */
export async function downloadQr(m: Made, ext: "png" | "svg") {
  const matrix = await buildQrMatrix(`${window.location.origin}/r/${m.token}?s=q`);
  const opt = { mirrored: false };
  if (ext === "png") downloadBlob(await qrToPngBlob(matrix, opt), qrFilename(m.short_code, "png", false));
  else downloadBlob(new Blob([qrToSvg(matrix, opt)], { type: "image/svg+xml" }), qrFilename(m.short_code, "svg", false));
}

/** Plus: cria um QR Code próprio (com leituras contadas) para imprimir onde quiser. Sem assinatura: 1 teste grátis. */
export function PlusQrCreator({ rules, allowedUrls, active, onDone }: { rules: DestinationRule[]; allowedUrls: string[]; active: boolean; onDone: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Made | null>(null);

  async function create() {
    const checked = checkDestination(url, rules, allowedUrls);
    if (!checked.ok) return void toast.error(checked.reason);
    setBusy(true);
    const { data, error } = await untyped(supabase).rpc("plus_create_qr", { _name: name, _url: checked.url });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setMade(data as Made);
    setName("");
    setUrl("");
    toast.success("QR Code criado.");
    onDone();
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 card-soft">
      <h2 className="text-base font-bold">
        Criar QR Code próprio <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Plus</span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {active ? "QR Codes ilimitados." : "Você tem 1 QR Code de teste grátis."} Cada um conta as leituras e você troca o destino quando quiser, sem reimprimir.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex: Cardápio)" className="h-10 input-soft rounded-xl" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… destino" className="h-10 input-soft rounded-xl" />
        <Button onClick={() => void create()} disabled={busy} className="rounded-xl">{busy ? "Criando…" : "Criar"}</Button>
      </div>
      {made && (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
          <p>
            Código <strong className="font-mono">{made.short_code}</strong> criado. Baixe o QR e mande imprimir:
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void downloadQr(made, "png")}>Baixar PNG</Button>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void downloadQr(made, "svg")}>Baixar SVG</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Ele também aparece na lista de códigos abaixo, no lote "Meus QR Codes".</p>
        </div>
      )}
    </section>
  );
}
