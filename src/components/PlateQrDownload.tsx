import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerQrDownload } from "@/lib/qr.functions";
import { buildQrMatrix, downloadBlob, qrFilename, qrToPdfBytes, qrToPngBlob, qrToSvg } from "@/lib/qr-export";

/** Baixar o QR de um código (SVG, PDF, PNG), normal ou espelhado. O servidor confere que o código é seu. */
export function PlateQrDownload({ plateId }: { plateId: string }) {
  const authorize = useServerFn(registerQrDownload);
  const [open, setOpen] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function download(format: "svg" | "pdf" | "png") {
    setBusy(format);
    try {
      const auth = await authorize({ data: { plateId, format, mirrored } });
      if (!auth.ok) {
        toast.error(auth.error);
        return;
      }
      const matrix = await buildQrMatrix(auth.url);
      const name = qrFilename(auth.shortCode, format, mirrored);
      if (format === "svg") {
        downloadBlob(new Blob([qrToSvg(matrix, { mirrored })], { type: "image/svg+xml" }), name);
      } else if (format === "png") {
        downloadBlob(await qrToPngBlob(matrix, { mirrored }), name);
      } else {
        const bytes = await qrToPdfBytes(matrix, { mirrored }, `QR ${auth.shortCode}`);
        downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), name);
      }
    } catch (error) {
      console.error("download do QR falhou", error);
      toast.error("Não consegui gerar o arquivo agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3">
      <Button type="button" size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => setOpen((o) => !o)}>
        ⬇ Baixar QR
      </Button>
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-muted/50 p-3 text-xs">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy !== null} onClick={() => void download("svg")} className="h-8 rounded-lg text-xs">
              {busy === "svg" ? "Gerando…" : "SVG (recomendado)"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download("pdf")} className="h-8 rounded-lg text-xs">
              {busy === "pdf" ? "Gerando…" : "PDF (gráfica)"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download("png")} className="h-8 rounded-lg text-xs">
              {busy === "png" ? "Gerando…" : "PNG (Canva)"}
            </Button>
          </div>
          <label className="mt-3 flex items-start gap-2">
            <input type="checkbox" checked={mirrored} onChange={(e) => setMirrored(e.target.checked)} className="mt-0.5" />
            <span>
              <strong>Versão espelhada</strong>: para adesivo colado por trás do acrílico, quando o QR é lido através do
              acrílico (a imagem sai invertida na horizontal).
            </span>
          </label>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>
              Tamanho mínimo: cerca de <strong>2,5 a 3 cm</strong> nas placas 10x10 e 10x15.
            </li>
            <li>
              QR <strong>escuro em fundo claro</strong>. Não ponha degradê nem foto atrás do QR.
            </li>
            <li>Já vem com a margem branca ao redor: não corte nem cubra essa margem.</li>
            <li>O QR leva ao código, não ao link final: você pode trocar o destino depois sem reimprimir.</li>
            <li>
              <strong>Teste a leitura no celular antes de imprimir um lote.</strong>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
