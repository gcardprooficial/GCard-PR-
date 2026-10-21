// Tradução do que Melhor Envio / SuperFrete informam para o que o GCard usa. Lógica pura (testável).
import type { CarrierValue } from "@/lib/shipping";

/** Nome da transportadora (como a plataforma escreve) → valor usado no painel. */
export function carrierFromCompany(name: string | null | undefined): CarrierValue | null {
  const n = (name ?? "").toLowerCase();
  if (!n) return null;
  if (n.includes("correios") || n === "pac" || n === "sedex" || n.includes("mini envios")) return "correios";
  if (n.includes("jadlog")) return "jadlog";
  if (n.includes("loggi")) return "loggi";
  if (n.includes("azul")) return "azul_cargo";
  if (n.includes("latam")) return "latam_cargo";
  if (n.includes("j&t") || n.includes("jt express") || n.includes("j and t")) return "j_e_t";
  return "outra";
}

export type ShipStage = "etiqueta" | "enviado" | "entregue" | "cancelado" | "desconhecido";

/** Estado da etiqueta (texto cru da plataforma) → etapa. Estados desconhecidos NÃO mexem no pedido. */
export function stageFromStatus(status: string | null | undefined): ShipStage {
  const s = (status ?? "").toLowerCase().trim();
  if (["pending", "released", "generated", "paid", "created"].includes(s)) return "etiqueta";
  if (["posted", "shipped", "in_transit", "transit"].includes(s)) return "enviado";
  if (["delivered"].includes(s)) return "entregue";
  if (["canceled", "cancelled", "expired", "undelivered"].includes(s)) return "cancelado";
  return "desconhecido";
}

const ORDER = ["recebido", "em_producao", "pronto", "enviado", "entregue"] as const;

/**
 * Novo estado do pedido a partir da etapa da etiqueta. Só AVANÇA (nunca rebaixa: entregue não volta para enviado)
 * e não mexe em pedido cancelado. Devolve null quando não há o que mudar.
 */
export function nextFulfillment(current: string, stage: ShipStage): "enviado" | "entregue" | null {
  if (current === "cancelado") return null;
  const target = stage === "entregue" ? "entregue" : stage === "enviado" ? "enviado" : null;
  if (!target) return null;
  return ORDER.indexOf(target) > ORDER.indexOf(current as (typeof ORDER)[number]) ? target : null;
}
