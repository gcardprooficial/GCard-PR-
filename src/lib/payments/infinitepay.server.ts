import { timingSafeEqual } from "node:crypto";
import type { PaymentResult } from "./provider";

const API = "https://api.checkout.infinitepay.io";

export const INFINITEPAY = "infinitepay";

export function infinitePayHandle() {
  return process.env["INFINITEPAY_HANDLE"]?.replace(/^\$/, "") || null;
}

/** Webhook da InfinitePay não é assinado: a chave vai na URL e o pagamento é sempre reconferido via payment_check. */
export function validWebhookSecret(given: string | null) {
  const secret = process.env["INFINITEPAY_WEBHOOK_SECRET"];
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cria o link de pagamento hospedado (Pix + cartão). order_nsu = id do pedido. */
export async function createInfinitePayLink(input: {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  customerName: string;
  customerEmail: string;
  origin: string;
}): Promise<string> {
  const handle = infinitePayHandle();
  if (!handle) throw new Error("infinitepay_not_configured");
  const secret = process.env["INFINITEPAY_WEBHOOK_SECRET"];
  const res = await fetch(`${API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle,
      order_nsu: input.orderId,
      redirect_url: `${input.origin}/pagamento/retorno`,
      ...(secret ? { webhook_url: `${input.origin}/api/webhooks/infinitepay?secret=${encodeURIComponent(secret)}` } : {}),
      customer: { name: input.customerName, email: input.customerEmail },
      items: [{ quantity: 1, price: input.totalCents, description: `Pedido GCard-PRO #${input.orderNumber}` }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { url?: string } | null;
  if (!res.ok || !json?.url) throw new Error(`infinitepay_link_failed_${res.status}`);
  return json.url;
}

type Checked = PaymentResult & { paidCents: number };

/** Pergunta à InfinitePay se o pagamento existe e foi pago. Nunca confiar só no corpo do webhook/URL. */
async function checkInfinitePayPayment(p: { orderId: string; transactionNsu: string; slug: string }): Promise<Checked | null> {
  const handle = infinitePayHandle();
  if (!handle) return null;
  const res = await fetch(`${API}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, order_nsu: p.orderId, transaction_nsu: p.transactionNsu, slug: p.slug }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { success?: boolean; paid?: boolean; paid_amount?: number; amount?: number; capture_method?: string };
  if (!j.success) return null;
  return {
    status: j.paid ? "pago" : "pendente",
    externalReference: p.orderId,
    providerPaymentId: p.transactionNsu,
    method: j.capture_method ?? null,
    paidCents: j.paid_amount ?? j.amount ?? 0,
  };
}

/** Confere no banco que o valor pago cobre o pedido e aplica o resultado (idempotente). */
export async function settleInfinitePay(p: { orderId: string; transactionNsu: string; slug: string }) {
  const payment = await checkInfinitePayPayment(p);
  if (!payment) return { ok: false as const, reason: "check_failed" as const };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total_cents")
    .eq("id", p.orderId)
    .maybeSingle();
  if (!order) return { ok: false as const, reason: "order_not_found" as const };
  if (payment.status === "pago" && payment.paidCents < order.total_cents) {
    console.error("InfinitePay: valor pago menor que o pedido", { orderId: p.orderId, paid: payment.paidCents, total: order.total_cents });
    return { ok: false as const, reason: "amount_mismatch" as const };
  }
  const { applyPaymentToOrder } = await import("./settle.server");
  const result = await applyPaymentToOrder(p.orderId, payment, INFINITEPAY);
  return { ok: true as const, status: result.found ? result.status : ("pendente" as const), orderNumber: order.order_number as number };
}
