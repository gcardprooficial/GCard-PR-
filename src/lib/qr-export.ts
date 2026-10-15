// Exportação do QR de um código: SVG e PDF (vetoriais) e PNG de alta resolução.
// Sempre com correção de erro nível H e zona de silêncio (margem branca) de 4 módulos já no arquivo.
// Tudo roda no navegador a partir da matriz de módulos: sem serviço externo e os três formatos saem idênticos.

export const QUIET_ZONE_MODULES = 4;
export const PNG_MIN_PX = 1200;
/** PDF quadrado de 80 mm: a gráfica redimensiona sem perder nitidez (é vetor). */
export const PDF_SIDE_MM = 80;

export type QrMatrix = { size: number; dark: (row: number, col: number) => boolean };

export type QrExportOptions = { mirrored: boolean };

/** Matriz de módulos do texto (URL), correção H. */
export async function buildQrMatrix(text: string): Promise<QrMatrix> {
  const QRCode = await import("qrcode");
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  return { size: qr.modules.size, dark: (r: number, c: number) => Boolean(qr.modules.get(r, c)) };
}

/** Sequências horizontais de módulos escuros por linha: menos retângulos que um por módulo. */
function darkRuns(m: QrMatrix, mirrored: boolean) {
  const runs: { x: number; y: number; w: number }[] = [];
  for (let r = 0; r < m.size; r++) {
    let start = -1;
    for (let c = 0; c <= m.size; c++) {
      const col = mirrored ? m.size - 1 - c : c;
      const on = c < m.size && m.dark(r, col);
      if (on && start < 0) start = c;
      if (!on && start >= 0) {
        runs.push({ x: start + QUIET_ZONE_MODULES, y: r + QUIET_ZONE_MODULES, w: c - start });
        start = -1;
      }
    }
  }
  return runs;
}

const totalModules = (m: QrMatrix) => m.size + QUIET_ZONE_MODULES * 2;

export function qrToSvg(m: QrMatrix, { mirrored }: QrExportOptions): string {
  const total = totalModules(m);
  const path = darkRuns(m, mirrored)
    .map((r) => `M${r.x} ${r.y}h${r.w}v1h-${r.w}z`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 10}" height="${total * 10}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/></svg>`
  );
}

/** PNG com pelo menos PNG_MIN_PX de lado (escala inteira por módulo: bordas nítidas). */
export async function qrToPngBlob(m: QrMatrix, { mirrored }: QrExportOptions): Promise<Blob> {
  const total = totalModules(m);
  const scale = Math.ceil(PNG_MIN_PX / total);
  const canvas = document.createElement("canvas");
  canvas.width = total * scale;
  canvas.height = total * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu gerar a imagem.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (const r of darkRuns(m, mirrored)) ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, scale);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não consegui gerar o PNG."))), "image/png"),
  );
}

/** PDF vetorial (quadrado de PDF_SIDE_MM). */
export async function qrToPdfBytes(m: QrMatrix, { mirrored }: QrExportOptions, title: string): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const side = (PDF_SIDE_MM / 25.4) * 72;
  const unit = side / totalModules(m);
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const page = doc.addPage([side, side]);
  page.drawRectangle({ x: 0, y: 0, width: side, height: side, color: rgb(1, 1, 1) });
  for (const r of darkRuns(m, mirrored)) {
    page.drawRectangle({ x: r.x * unit, y: side - (r.y + 1) * unit, width: r.w * unit, height: unit, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function qrFilename(shortCode: string, ext: "svg" | "pdf" | "png", mirrored: boolean) {
  return `gcard-${shortCode}${mirrored ? "-espelhado" : ""}.${ext}`;
}
