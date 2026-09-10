// Config de LANÇAMENTO / PRÉ-VENDA.
//
// PLATE_PREORDER.enabled = true → landing e wizard mostram que é pré-venda
// (a pessoa paga sabendo que recebe em alguns dias). Virar false quando a
// produção estabilizar.
export const PLATE_PREORDER = {
  enabled: true,
  badge: "Pré-venda de lançamento",
  headline: "Seja um dos primeiros e receba antes de todo mundo",
  detail:
    "Estamos na primeira leva de produção. Você garante sua placa agora, com preço de lançamento, e recebe em alguns dias.",
} as const;

// Grupo de WhatsApp de lançamento. Preencher NEXT_PUBLIC_LAUNCH_WA_GROUP.
// Vazio = o CTA não aparece.
export function launchWhatsappGroup(): string {
  return process.env.NEXT_PUBLIC_LAUNCH_WA_GROUP?.trim() || "";
}
