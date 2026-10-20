import { useEffect, useRef, useState } from "react";
import { ImagePlus, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildQrMatrix, downloadBlob, qrFilename } from "@/lib/qr-export";
import { CAPTION_MAX, DEFAULT_STYLE, PRESETS, renderStyledQr, styleProblem, type QrStyle } from "@/lib/qr-style";

type Target = { token: string; short_code: string; business_name: string | null };

/** Plus: QR com a cara da marca (cor, cantos, logo, frase). Mostra o resultado antes de baixar e recusa o que o celular não leria. */
export function QrStyleStudio({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const [style, setStyle] = useState<QrStyle>(DEFAULT_STYLE);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const matrixKey = useRef("");
  const problem = styleProblem(style);

  useEffect(() => {
    if (!target) return;
    let live = true;
    void (async () => {
      if (problem) return setPreview(null);
      const url = `${window.location.origin}/r/${target.token}?s=q`;
      matrixKey.current = url;
      const matrix = await buildQrMatrix(url);
      if (!live) return;
      try {
        setPreview(renderStyledQr(matrix, style, 480).toDataURL("image/png"));
      } catch {
        setPreview(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [target, style, problem]);

  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2_000_000) return void toast.error("Use uma imagem (PNG, JPG ou SVG) de até 2 MB.");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      setStyle((s) => ({ ...s, logo: img }));
      setLogoName(file.name);
    };
    img.onerror = () => toast.error("Não consegui ler essa imagem.");
    img.src = url;
  }

  async function download() {
    if (!target || problem) return;
    setBusy(true);
    try {
      const matrix = await buildQrMatrix(`${window.location.origin}/r/${target.token}?s=q`);
      const canvas = renderStyledQr(matrix, style, 1400);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("png");
      downloadBlob(blob, qrFilename(target.short_code, "png", false).replace(".png", "-marca.png"));
    } catch {
      toast.error("Não consegui gerar o arquivo agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette className="size-5" /> QR com a sua marca</DialogTitle>
          <DialogDescription>
            {target?.business_name || target?.short_code}. O QR continua levando ao mesmo código: você troca o destino sem reimprimir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="flex items-center justify-center rounded-2xl border border-border bg-muted/40 p-3">
            {preview ? <img src={preview} alt="Prévia do QR" className="w-full rounded-lg" /> : <p className="p-6 text-center text-xs text-muted-foreground">{problem ?? "Gerando…"}</p>}
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Cores</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setStyle((s) => ({ ...s, fg: p.fg, bg: p.bg }))}
                    title={p.name}
                    className={`size-9 rounded-full border-2 ${style.fg === p.fg && style.bg === p.bg ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                    style={{ background: `linear-gradient(135deg, ${p.fg} 50%, ${p.bg} 50%)` }}
                    aria-label={p.name}
                  />
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <label className="flex items-center gap-1.5">QR <input type="color" value={style.fg} onChange={(e) => setStyle((s) => ({ ...s, fg: e.target.value }))} /></label>
                <label className="flex items-center gap-1.5">Fundo <input type="color" value={style.bg} onChange={(e) => setStyle((s) => ({ ...s, bg: e.target.value }))} /></label>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={style.rounded} onChange={(e) => setStyle((s) => ({ ...s, rounded: e.target.checked }))} /> Cantos arredondados
            </label>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Frase embaixo (opcional)</p>
              <Input value={style.caption} maxLength={CAPTION_MAX} onChange={(e) => setStyle((s) => ({ ...s, caption: e.target.value }))} placeholder="Ex.: Escaneie e peça" className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Logo no centro (opcional)</p>
              <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                <ImagePlus className="size-4" /> {logoName ?? "Escolher imagem"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              </label>
              {style.logo && (
                <button type="button" className="ml-2 text-xs underline" onClick={() => { setStyle((s) => ({ ...s, logo: null })); setLogoName(null); }}>
                  tirar
                </button>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">O logo ocupa só o centro (até 20%) para o QR continuar legível. A imagem não é enviada para lugar nenhum.</p>
            </div>
            {problem && <p className="rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">{problem}</p>}
            <Button onClick={() => void download()} disabled={busy || !!problem} className="w-full rounded-xl font-bold">
              {busy ? "Gerando…" : "Baixar PNG com a minha marca"}
            </Button>
            <p className="text-[11px] text-muted-foreground"><strong>Teste a leitura no celular antes de imprimir.</strong> Tamanho mínimo de 2,5 a 3 cm.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
