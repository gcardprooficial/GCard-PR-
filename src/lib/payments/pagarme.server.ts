import type { PaymentResult } from "./provider";

export const PAGARME = "pagarme";

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

/** Cria pedido Pix (QR + copia-e-cola no nosso site). code = id do pedido. A conta não libera checkout hospedado/link, mas libera Pix por API. */
export async function createPagarmePix(input: {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  customerName: string;
  customerEmail: string;
  customerDocument: string | null;
  customerPhone: string | null;
  items: { name: string; quantity: number; unitCents: number }[];
  ship: { zip: string | null; street: string | null; number: string | null; complement: string | null; district: string | null; city: string | null; state: string | null };
}): Promise<PgOrder> {
  if (!key()) throw new Error("pagarme_not_configured");
  const doc = (input.customerDocument ?? "").replace(/\D/g, "");
  let phone = (input.customerPhone ?? "").replace(/\D/g, "");
  if (phone.startsWith("55") && phone.length > 11) phone = phone.slice(2);
  // Itens reais (nome, qtd, valor unitário) quando a soma bate com o total cobrado (cupom/desconto Pix fazem diferir);
  // senão um item único com a descrição do pedido, pra nunca recusar por soma errada.
  const itemsSum = input.items.reduce((t, i) => t + i.unitCents * i.quantity, 0);
  const items =
    input.items.length > 0 && itemsSum === input.totalCents
      ? input.items.map((i, n) => ({ amount: i.unitCents, description: i.name.slice(0, 256), quantity: i.quantity, code: `${input.orderNumber}-${n + 1}` }))
      : [
          {
            amount: input.totalCents,
            description: (`Pedido GCard-PRO #${input.orderNumber}` + (input.items.length ? `: ${input.items.map((i) => `${i.quantity}x ${i.name}`).join("; ")}` : "")).slice(0, 256),
            quantity: 1,
            code: String(input.orderNumber),
          },
        ];
  const zip = (input.ship.zip ?? "").replace(/\D/g, "");
  const address =
    zip.length === 8 && input.ship.street && input.ship.city && input.ship.state?.length === 2
      ? {
          country: "BR",
          state: input.ship.state.toUpperCase(),
          city: input.ship.city,
          zip_code: zip,
          line_1: [input.ship.number, input.ship.street, input.ship.district].filter(Boolean).join(", ").slice(0, 256),
          ...(input.ship.complement ? { line_2: input.ship.complement.slice(0, 128) } : {}),
        }
      : null;
  const body = {
    code: input.orderId,
    metadata: { order_id: input.orderId, order_number: String(input.orderNumber) },
    items,
    ...(address ? { shipping: { amount: 0, description: "Envio GCard-PRO", recipient_name: input.customerName, address } } : {}),
    customer: {
      ...(address ? { address } : {}),
      name: input.customerName,
      email: input.customerEmail.slice(0, 64),
      code: input.orderId.slice(0, 52),
      ...(doc.length === 11 || doc.length === 14
        ? { type: doc.length === 11 ? "individual" : "company", document: doc, document_type: doc.length === 11 ? "CPF" : "CNPJ" }
        : {}),
      ...(phone.length >= 10 ? { phones: { mobile_phone: { country_code: "55", area_code: phone.slice(0, 2), number: phone.slice(2) } } } : {}),
    },
    payments: [{ payment_method: "pix", pix: { expires_in: PIX_EXPIRES_SECONDS } }],
  };
  const res = await fetch(`${base()}/orders`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const json = (await res.json().catch(() => null)) as PgOrder | null;
  if (!res.ok || !json?.id) {
    console.error("Pagar.me pix falhou", res.status, JSON.stringify(json)?.slice(0, 400));
    throw new Error(`pagarme_pix_failed_${res.status}`);
  }
  return json;
}

export type PgOrder = {
  id?: string;
  code?: string | null;
  status?: string;
  amount?: number;
  metadata?: Record<string, unknown> | null;
  customer?: { code?: string | null } | null;
  charges?: {
    status?: string;
    amount?: number;
    payment_method?: string;
    metadata?: Record<string, unknown> | null;
    last_transaction?: { qr_code?: string; qr_code_url?: string; expires_at?: string } | null;
  }[];
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
