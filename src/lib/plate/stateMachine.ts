// Máquinas de estado explícitas do módulo Placas & Avaliações.
// Toda transição válida está aqui. Qualquer transição fora da tabela é
// rejeitada (as rotas de API chamam canTransition antes de gravar).
// Ver .planning/PLAN_MODULO_PLACAS_AVALIACOES.md §4.

import type { PlateBatchStatus, PlateOrderStatus, PlateUnitStatus } from "./types";

export const PLATE_ORDER_TRANSITIONS: Record<PlateOrderStatus, PlateOrderStatus[]> = {
  draft: ["pending_payment", "cancelled"],
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "refunded", "cancelled"],
  processing: ["manufacturing", "cancelled"],
  manufacturing: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
  refunded: [],
};

export const PLATE_UNIT_TRANSITIONS: Record<PlateUnitStatus, PlateUnitStatus[]> = {
  reserved: ["manufacturing", "cancelled"],
  manufacturing: ["in_stock", "cancelled"],
  in_stock: ["shipped", "cancelled"],
  shipped: ["available_for_activation", "cancelled"],
  // individual: a unidade pode nascer já "activated" (não passa por
  // available_for_activation). available_for_activation -> activated é o
  // caminho de revenda.
  available_for_activation: ["activated", "blocked", "suspended", "cancelled"],
  activated: ["suspended", "cancelled"],
  suspended: ["activated", "cancelled"],
  blocked: ["available_for_activation", "cancelled"],
  cancelled: [],
};

export const PLATE_BATCH_TRANSITIONS: Record<PlateBatchStatus, PlateBatchStatus[]> = {
  reserved: ["manufacturing", "cancelled"],
  manufacturing: ["in_stock", "shipped", "cancelled"],
  in_stock: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

type Kind = "order" | "unit" | "batch";

const TABLES = {
  order: PLATE_ORDER_TRANSITIONS,
  unit: PLATE_UNIT_TRANSITIONS,
  batch: PLATE_BATCH_TRANSITIONS,
} as const;

/** true se `from -> to` é uma transição permitida pra esse tipo de entidade. */
export function canTransition(kind: Kind, from: string, to: string): boolean {
  if (from === to) return true; // no-op sempre ok
  const table = TABLES[kind] as Record<string, string[]>;
  return (table[from] ?? []).includes(to);
}

/** Lança se a transição for inválida. Usar nas rotas de API antes de gravar. */
export function assertTransition(kind: Kind, from: string, to: string): void {
  if (!canTransition(kind, from, to)) {
    throw new Error(`transição inválida de ${kind}: ${from} -> ${to}`);
  }
}
