import type {
  PaymentProvider,
  PaymentResult,
  PaymentStatus,
  CheckoutPreference,
  VerifiedEvent,
  OrderForCheckout,
} from "./provider";

const API = "https://api.mercadopago.com";

function mapStatus(mp: string): PaymentStatus {
  switch (mp) {
    case "approved":
      return "pago";
    case "rejected":
      return "recusado";
    case "refunded":
    case "charged_back":
      return "estornado";
    case "cancelled":
      return "cancelado";
    default:
      return "pendente"; // pending, in_process, authorized
  }
}

type MpPayment = {
  id: number;
  status: string;
  external_reference?: string | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
};

function toResult(p: MpPayment): PaymentResult {
  return {
    status: mapStatus(p.status),
    externalReference: p.external_reference ?? null,
    providerPaymentId: String(p.id),
    method: p.payment_type_id ?? p.payment_method_id ?? null,
  };
}

/** Constant-time compare of two hex strings. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createMercadoPagoProvider(accessToken: string, webhookSecret: string): PaymentProvider {
  const auth = { Authorization: `Bearer ${accessToken}` };

  return {
    name: "mercadopago",

    async createPreference({ order, origin }): Promise<CheckoutPreference> {
      const unitPrice = Math.round(order.total_cents / order.quantity) / 100;
      // CPF/CNPJ ajuda a MP a registrar o pagamento (cartão/pix costumam exigir
      // identificação do comprador). Sem isso alguns pedidos ficam travados na
      // tela de pagamento com "Não conseguimos registrar o pedido".
      const docDigits = (order.customer_document ?? "").replace(/\D/g, "");
      const identification =
        docDigits.length === 11
          ? { type: "CPF", number: docDigits }
          : docDigits.length === 14
            ? { type: "CNPJ", number: docDigits }
            : null;
      const [firstName, ...rest] = order.customer_name.trim().split(/\s+/);
      const res = await fetch(`${API}/checkout/preferences`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: order.id,
              title: `Pedido GCard-PRÓ #${order.order_number}`,
              quantity: order.quantity,
              unit_price: unitPrice,
              currency_id: "BRL",
            },
          ],
          // Nome e CPF ajudam a MP a registrar o pagamento. O e-mail fica de fora de
          // propósito: com e-mail de quem já tem conta no MP, o checkout exige login.
          payer: {
            name: firstName || order.customer_name,
            surname: rest.join(" ") || undefined,
            ...(identification ? { identification } : {}),
          },
          external_reference: order.id,
          back_urls: {
            success: `${origin}/pagamento/retorno`,
            failure: `${origin}/pagamento/retorno`,
            pending: `${origin}/pagamento/retorno`,
          },
          auto_return: "approved",
          notification_url: `${origin}/api/webhooks/mercadopago`,
          statement_descriptor: "GCARDPRO",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Mercado Pago preference falhou [${res.status}]: ${body}`);
      }
      const json = (await res.json()) as { id?: string; init_point?: string; sandbox_init_point?: string };
      const url = json.init_point ?? json.sandbox_init_point;
      if (!url) throw new Error("Mercado Pago não retornou init_point.");
      return { url, reference: json.id ?? null };
    },

    async verifyWebhook(request: Request): Promise<VerifiedEvent | null> {
      const url = new URL(request.url);
      const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
      const type = url.searchParams.get("type") ?? url.searchParams.get("topic");
      if (!dataId || (type && type !== "payment")) return null;

      const signature = request.headers.get("x-signature");
      const requestId = request.headers.get("x-request-id") ?? "";
      if (!signature) return null;

      const parts = Object.fromEntries(
        signature.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string]),
      );
      const ts = parts["ts"];
      const v1 = parts["v1"];
      if (!ts || !v1) return null;

      const timestamp = Number(ts);
      if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) {
        return null;
      }

      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const expected = await hmacSha256Hex(webhookSecret, manifest);
      if (!safeEqualHex(expected, v1)) return null;

      return { paymentId: dataId };
    },

    async getPayment(paymentId: string): Promise<PaymentResult | null> {
      const res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, { headers: auth });
      if (!res.ok) {
        console.error(`Mercado Pago getPayment [${res.status}] ${paymentId}`);
        return null;
      }
      return toResult((await res.json()) as MpPayment);
    },

    async findPaymentsByReference(reference: string): Promise<PaymentResult[]> {
      const url = `${API}/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc&limit=10`;
      const res = await fetch(url, { headers: auth });
      if (!res.ok) {
        console.error(`Mercado Pago search [${res.status}] ${reference}`);
        return [];
      }
      const json = (await res.json()) as { results?: MpPayment[] };
      return (json.results ?? []).map(toResult);
    },
  };
}
