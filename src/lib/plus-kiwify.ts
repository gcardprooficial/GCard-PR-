import { createHmac, timingSafeEqual } from "node:crypto";

/** A Kiwify assina o corpo cru: ?signature = HMAC-SHA1 hex com o token do webhook como chave. */
export function validKiwifySignature(raw: string, given: string | null, token: string | undefined): boolean {
  if (!token || !given) return false;
  const want = createHmac("sha1", token).update(raw).digest("hex");
  const a = Buffer.from(given.toLowerCase());
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type PlusStatus = "ativa" | "atrasada" | "cancelada" | "reembolsada";
export type PlusChange = {
  email: string;
  plan: "mensal" | "anual";
  status: PlusStatus;
  subscriptionId: string;
  orderId: string | null;
  productId: string | null;
  periodEnd: string | null;
  event: string;
};

const STATUS_BY_EVENT: Record<string, PlusStatus> = {
  order_approved: "ativa",
  subscription_renewed: "ativa",
  subscription_late: "atrasada",
  subscription_canceled: "cancelada",
  order_refunded: "reembolsada", // ponytail: nome do aviso de reembolso/chargeback não veio nos testes da Kiwify; conferir no 1º real
  chargeback: "reembolsada",
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** null = aviso que não é assinatura do Plus (ou não dá para ler com segurança): responde 200 e não grava. */
export function parseKiwifyPlus(body: unknown, allowedProducts: string[] = []): PlusChange | null {
  const b = body as Record<string, any> | null;
  if (!b || typeof b !== "object") return null;
  const event = str(b["webhook_event_type"]);
  const status = event ? STATUS_BY_EVENT[event] : undefined;
  const email = str(b["Customer"]?.["email"])?.toLowerCase();
  const subscriptionId = str(b["subscription_id"]) ?? str(b["Subscription"]?.["id"]);
  const freq = str(b["Subscription"]?.["plan"]?.["frequency"])?.toLowerCase() ?? "";
  const plan = /year|annual|anual/.test(freq) ? "anual" : /month|mensal/.test(freq) ? "mensal" : null;
  const productId = str(b["Product"]?.["product_id"]);
  if (!event || !status || !email || !subscriptionId || !plan) return null;
  if (allowedProducts.length && (!productId || !allowedProducts.includes(productId))) return null;
  const next = str(b["Subscription"]?.["next_payment"]);
  return {
    email, plan, status, subscriptionId, event, productId,
    orderId: str(b["order_id"]),
    periodEnd: next && !Number.isNaN(Date.parse(next)) ? new Date(next).toISOString() : null,
  };
}

/** Mesmo aviso reenviado = mesma chave. */
export const dedupeKey = (c: PlusChange) => `${c.event}:${c.orderId ?? ""}:${c.subscriptionId}`;
