import { PDFDocument } from "pdf-lib";

/**
 * Rolo de impressão (96 cm de largura): grade de células com a arte + um QR por placa.
 * Medidas em pontos PDF, tiradas dos PDFs de rolo da gráfica (Estoque 4 do 10x10 e Estoque 5 do 10x15).
 * `tile*` = célula + metade do vão até a vizinha; `qr*` = posição do QR medida do canto sup. esq. da célula.
 */
export type RoloKey = "10x10" | "10x15";
export type RoloSpec = {
  label: string;
  cellPdf: string;
  cols: number;
  fullRows: number;
  tileW: number;
  tileH: number;
  left: number;
  top: number;
  qrX: number;
  qrY: number;
  qrW: number;
  qrH: number;
};

export const ROLO_PAGE_W = 2721.3601;
export const ROLO_FULL_H = 2834.8799; // rolo de 100 cm (grade cheia)
const PDF_MAX = 14400; // limite do formato PDF (~5 m)

export const ROLO: Record<RoloKey, RoloSpec> = {
  "10x10": {
    label: "Placa 10x10 — Avaliação Google",
    cellPdf: "/rolo/cel-10x10.pdf",
    cols: 9,
    fullRows: 9,
    tileW: 297.6382,
    tileH: 297.6382,
    left: 7.0866,
    top: 7.0882,
    qrX: 177.826,
    qrY: 193.016,
    qrW: 47.1093,
    qrH: 46.8519,
  },
  "10x15": {
    label: "Placa 10x15 — Avaliação Google",
    cellPdf: "/rolo/cel-10x15.pdf",
    cols: 9,
    fullRows: 6,
    tileW: 294.8031,
    tileH: 433.6968,
    left: 17.008,
    top: 14.173,
    qrX: 176.785,
    qrY: 283.208,
    qrW: 75.68,
    qrH: 75.68,
  },
};

export function roloPageHeight(spec: RoloSpec, rows: number): number {
  return rows === spec.fullRows ? ROLO_FULL_H : spec.top * 2 + rows * spec.tileH;
}

export function roloMaxPlates(spec: RoloSpec): number {
  return Math.floor((PDF_MAX - spec.top * 2) / spec.tileH) * spec.cols;
}

/** Ordem de leitura: linha por linha, esquerda -> direita. */
export async function buildRoloPdf(
  spec: RoloSpec,
  cellPdf: Uint8Array,
  qrPngs: Uint8Array[],
): Promise<Uint8Array> {
  const n = qrPngs.length;
  if (n === 0 || n > roloMaxPlates(spec)) throw new Error(`Quantidade inválida: ${n}`);
  const rows = Math.ceil(n / spec.cols);
  const H = roloPageHeight(spec, rows);

  const doc = await PDFDocument.create();
  const src = await PDFDocument.load(cellPdf);
  const cb = src.getPage(0).getCropBox();
  const cell = await doc.embedPage(src.getPage(0), {
    left: cb.x,
    bottom: cb.y,
    right: cb.x + cb.width,
    top: cb.y + cb.height,
  });
  const page = doc.addPage([ROLO_PAGE_W, H]);
  const imgs = await Promise.all(qrPngs.map((b) => doc.embedPng(b)));

  for (let i = 0; i < n; i++) {
    const x = spec.left + (i % spec.cols) * spec.tileW;
    const yTop = spec.top + Math.floor(i / spec.cols) * spec.tileH;
    page.drawPage(cell, { x, y: H - yTop - spec.tileH, width: spec.tileW, height: spec.tileH });
    page.drawImage(imgs[i]!, {
      x: x + spec.qrX,
      y: H - (yTop + spec.qrY) - spec.qrH,
      width: spec.qrW,
      height: spec.qrH,
    });
  }
  return doc.save();
}
