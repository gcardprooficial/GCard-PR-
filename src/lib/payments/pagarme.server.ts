import type { PaymentResult } from "./provider";

export const PAGARME = "pagarme";

// ponytail: à vista + Pix. Parcelar encarece a taxa (2x 7,26% · 3x 9,40%) -- ajuste aqui se quiser oferecer.
const INSTALLMENTS_MAX = 1;
const PIX_EXPIRES_SECONDS = 30 * 60;

function key() {
  return process.env["PAGARME_SECRET_KEY"] || null;
}

/** Teste e produção usam a mesma API: quem decide é a chave (sk_test_ x sk_live_). Testado: sk_test_ responde 200 em api.pagar.me. */
function base() {
  return process.env["PAGARME_API_URL"] ?? "https://api.pagar.me/core/v5";
}

function headers() {
  // HTTP Basic: chave secreta no usuário, senha vazia.
  return { Authorization: `Basic ${Buffer.from(`${key()}:`).toString("base64")}`, "Content-Type": "application/json" };
}

export function pagarmeConfigured() {
  return Boolean(key());
}

const isUuid = (x: unknown): x is string =>
  typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

/** Cria o link de pagamento (Pix + cartão à vista). order_code = id do pedido. Devolve a URL do checkout hospedado. */
export async function createPagarmeLink(input: {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  customerName: string;
  customerEmail: string;
  customerDocument: string | null;
  origin: string;
}): Promise<{ url: string; linkId: string | null }> {
  if (!key()) throw new Error("pagarme_not_configured");
  const doc = (input.customerDocument ?? "").replace(/\D/g, "");
  const body = {
    type: "order",
    name: `Pedido GCard-PRO #${input.orderNumber}`.slice(0, 64),
    order_code: input.orderId,
    max_paid_sessions: 1,
    flow_settings: { success_url: `${input.origin}/pagamento/retorno?gw=pagarme&ref=${input.orderId}` },
    payment_settings: {
      accepted_payment_methods: ["credit_card", "pix"],
      statement_descriptor: "GCARDPRO",
      credit_card_settings: {
        operation_type: "auth_and_capture",
        installments: Array.from({ length: INSTALLMENTS_MAX }, (_, i) => ({ number: i + 1, total: input.totalCents })),
      },
      pix_settings: { expires_in: PIX_EXPIRES_SECONDS },
    },
    cart_settings: {
      items: [{ name: `Pedido GCard-PRO #${input.orderNumber}`.slice(0, 64), amount: input.totalCents, default_quantity: 1 }],
    },
    customer_settings: {
      customer: {
        name: input.customerName,
        email: input.customerEmail.slice(0, 64),
        ...(doc.length === 11 || doc.length === 14
          ? { type: doc.length === 11 ? "individual" : "company", document: doc, document_type: doc.length === 11 ? "CPF" : "CNPJ" }
          : {}),
        code: input.orderId.slice(0, 52),
      },
    },
  };
  const res = await fetch(`${base()}/paymentlinks`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const json = (await res.json().catch(() => null)) as { url?: string; id?: string } | null;
  if (!res.ok || !json?.url) {
    console.error("Pagar.me link falhou", res.status, JSON.stringify(json)?.slice(0, 400));
    throw new Error(`pagarme_link_failed_${res.status}`);
  }
  return { url: json.url, linkId: json.id ?? null };
}

type PgOrder = {
  id?: string;
  code?: string | null;
  status?: string;
  amount?: number;
  metadata?: Record<string, unknown> | null;
  customer?: { code?: string | null } | null;
  charges?: { status?: string; amount?: number; payment_method?: string; metadata?: Record<string, unknown> | null }[];
};

export async function fetchPagarmeOrder(pagarmeOrderId: string): Promise<PgOrder | null> {
  if (!key()) return null;
  const res = await fetch(`${base()}/orders/${encodeURIComponent(pagarmeOrderId)}`, { headers: headers(), signal: AbortSignal.timeout(20_000) });
  return res.ok ? ((await res.json()) as PgOrder) : null;
}

/** Acha pedidos da Pagar.me pelo código (id do nosso pedido). */
export async function findPagarmeOrdersByCode(code: string): Promise<PgOrder[]> {
  if (!key()) return [];
  const res = await fetch(`${base()}/orders?code=${encodeURIComponent(code)}&size=10`, { headers: headers(), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: PgOrder[] };
  return j.data ?? [];
}

/** O que liga o pagamento ao nosso pedido: tenta código do pedido, depois metadados, depois o código do cliente. */
function referenceOf(o: PgOrder): string | null {
  const meta = (o.metadata ?? {}) as Record<string, unknown>;
  return [o.code, meta["order_id"], meta["order_code"], o.customer?.code].find(isUuid) ?? null;
}

/** Aplica o resultado de um pedido da Pagar.me. Sempre reconsulta a API; confere valor antes de marcar pago. */
export async function settlePagarmeOrder(order: PgOrder, fallbackRef?: string) {
  const ref = referenceOf(order) ?? (isUuid(fallbackRef) ? fallbackRef : null);
  if (!ref) {
    console.error("Pagar.me: pedido sem referência nossa", { id: order.id, code: order.code });
    return { ok: false as const, reason: "no_reference" as const };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ours } = await supabaseAdmin.from("orders").select("id, order_number, total_cents").eq("id", ref).maybeSingle();
  if (!ours) return { ok: false as const, reason: "order_not_found" as const };

  const paid = order.status === "paid";
  if (paid && (order.amount ?? 0) < ours.total_cents) {
    console.error("Pagar.me: valor pago menor que o pedido", { ref, paid: order.amount, total: ours.total_cents });
    return { ok: false as const, reason: "amount_mismatch" as const };
  }
  const status: PaymentResult["status"] = paid ? "pago" : order.status === "failed" ? "recusado" : order.status === "canceled" ? "cancelado" : "pendente";
  const result: PaymentResult = {
    status,
    externalReference: ref,
    providerPaymentId: order.id ?? "",
    method: order.charges?.[0]?.payment_method ?? null,
  };
  const { applyPaymentToOrder } = await import("./settle.server");
  const applied = await applyPaymentToOrder(ref, result, PAGARME);
  return { ok: true as const, status: applied.found ? applied.status : ("pendente" as const), orderNumber: ours.order_number as number };
}
