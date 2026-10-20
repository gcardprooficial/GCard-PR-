// QR personalizado (Plus): cores, cantos arredondados, logo no centro e moldura com chamada.
// Regras de leitura: o QR sempre é ESCURO em fundo CLARO com contraste mínimo, o logo cobre no máximo ~20% do lado
// (correção de erro H aguenta 30%) e o módulo nunca some. Se o estilo ficar ilegível, não deixa baixar.
import { QUIET_ZONE_MODULES, type QrMatrix } from "@/lib/qr-export";

export type QrStyle = { fg: string; bg: string; rounded: boolean; caption: string; logo: CanvasImageSource | null };

export const DEFAULT_STYLE: QrStyle = { fg: "#0F172A", bg: "#FFFFFF", rounded: true, caption: "", logo: null };
export const PRESETS: { name: string; fg: string; bg: string }[] = [
  { name: "Clássico", fg: "#000000", bg: "#FFFFFF" },
  { name: "Marinho", fg: "#0F172A", bg: "#FFFFFF" },
  { name: "Ouro", fg: "#7C4A03", bg: "#FFF8E7" },
  { name: "Verde", fg: "#0B5D3F", bg: "#F0FBF5" },
  { name: "Vinho", fg: "#6B1630", bg: "#FFF5F7" },
  { name: "Azul", fg: "#12408F", bg: "#F2F7FF" },
];
export const MIN_CONTRAST = 4.5;
export const LOGO_MAX_FRACTION = 0.2;
export const CAPTION_MAX = 28;

const HEX = /^#[0-9a-fA-F]{6}$/;

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Motivo pelo qual o estilo não pode ser usado (null = pode). */
export function styleProblem(s: Pick<QrStyle, "fg" | "bg" | "caption">): string | null {
  if (!HEX.test(s.fg) || !HEX.test(s.bg)) return "Cor inválida.";
  if (luminance(s.fg) >= luminance(s.bg)) return "O QR precisa ser mais escuro que o fundo, senão o celular não lê.";
  if (contrastRatio(s.fg, s.bg) < MIN_CONTRAST) return "Contraste baixo: escolha uma cor mais escura (ou o fundo mais claro) para o celular conseguir ler.";
  if (s.caption.length > CAPTION_MAX) return `A frase pode ter até ${CAPTION_MAX} letras.`;
  return null;
}

/** Lado máximo do logo em módulos/px, dado o lado do QR. */
export const logoSide = (qrSidePx: number) => Math.floor(qrSidePx * LOGO_MAX_FRACTION);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Desenha o QR estilizado num canvas (PNG de alta resolução). */
export function renderStyledQr(matrix: QrMatrix, style: QrStyle, side = 1200): HTMLCanvasElement {
  const problem = styleProblem(style);
  if (problem) throw new Error(problem);
  const total = matrix.size + QUIET_ZONE_MODULES * 2;
  const unit = Math.floor(side / total);
  const qrPx = unit * total;
  const cap = style.caption.trim();
  const capH = cap ? Math.round(qrPx * 0.16) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = qrPx;
  canvas.height = qrPx + capH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu gerar a imagem.");
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = style.fg;
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.dark(r, c)) continue;
      const x = (c + QUIET_ZONE_MODULES) * unit;
      const y = (r + QUIET_ZONE_MODULES) * unit;
      if (style.rounded) {
        roundRect(ctx, x, y, unit, unit, unit * 0.32);
        ctx.fill();
      } else ctx.fillRect(x, y, unit, unit);
    }
  }

  if (style.logo) {
    const box = logoSide(matrix.size * unit);
    const pad = Math.round(box * 0.1);
    const cx = qrPx / 2;
    const cy = qrPx / 2;
    ctx.fillStyle = style.bg;
    roundRect(ctx, cx - box / 2 - pad, cy - box / 2 - pad, box + pad * 2, box + pad * 2, box * 0.18);
    ctx.fill();
    const src = style.logo as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
    const w = src.naturalWidth ?? src.width ?? box;
    const h = src.naturalHeight ?? src.height ?? box;
    const k = Math.min(box / w, box / h);
    ctx.drawImage(style.logo, cx - (w * k) / 2, cy - (h * k) / 2, w * k, h * k);
  }

  if (cap) {
    const bandY = qrPx - Math.round(unit * 1.5);
    ctx.fillStyle = style.fg;
    roundRect(ctx, unit * 3, bandY, qrPx - unit * 6, capH, capH * 0.35);
    ctx.fill();
    ctx.fillStyle = style.bg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const font = (px: number) => `800 ${px}px Manrope, system-ui, sans-serif`;
    let px = Math.round(capH * 0.5);
    ctx.font = font(px);
    while (ctx.measureText(cap).width > qrPx - unit * 10 && px > 12) {
      px -= 2;
      ctx.font = font(px);
    }
    ctx.fillText(cap, qrPx / 2, bandY + capH / 2 + px * 0.04);
  }
  return canvas;
}
