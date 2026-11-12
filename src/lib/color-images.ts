import acrilico10x10Cristal from "@/assets/acrilico-10x10-cristal.jpg";
import acrilico10x10Branco from "@/assets/acrilico-10x10-branco.jpg";
import acrilico10x10Preto from "@/assets/acrilico-10x10-preto.jpg";
import acrilico10x10Azul from "@/assets/acrilico-10x10-azul.jpg";
import acrilicoLCristal from "@/assets/acrilico-l-cristal.jpg";
import acrilicoLBranco from "@/assets/acrilico-l-branco.jpg";
import acrilicoLPreto from "@/assets/acrilico-l-preto.jpg";
import acrilicoLAzul from "@/assets/acrilico-l-azul.jpg";

/** Foto do acrílico liso por produto e cor ("slug:cor"). Usada na página do produto, no carrinho e na escolha antiga de cor. */
export const COLOR_IMAGES: Record<string, string> = {
  "acrilico-10x10-sem-arte:cristal": acrilico10x10Cristal,
  "acrilico-10x10-sem-arte:branco": acrilico10x10Branco,
  "acrilico-10x10-sem-arte:preto": acrilico10x10Preto,
  "acrilico-10x10-sem-arte:azul": acrilico10x10Azul,
  "acrilico-15x10-l-sem-arte:cristal": acrilicoLCristal,
  "acrilico-15x10-l-sem-arte:branco": acrilicoLBranco,
  "acrilico-15x10-l-sem-arte:preto": acrilicoLPreto,
  "acrilico-15x10-l-sem-arte:azul": acrilicoLAzul,
};

export const colorImage = (slug: string, color: string | null): string | undefined => (color ? COLOR_IMAGES[`${slug}:${color}`] : undefined);
