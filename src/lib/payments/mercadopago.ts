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
          payer: { name: order.customer_name, email: order.customer_email },
          external_reference: order.id,
          back_urls: {
            success: `${origin}/comprar?status=sucesso`,
            failure: `${origin}/comprar?status=erro`,
            pending: `${origin}/comprar?status=pendente`,
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
      const res = await fetch(`${API}/v1/payments/${paymentId}`, { headers: auth });
      if (!res.ok) {
        console.error(`Mercado Pago getPayment [${res.status}] ${paymentId}`);
        return null;
      }
      const p = (await res.json()) as {
        id: number;
        status: string;
        external_reference?: string | null;
        payment_method_id?: string | null;
        payment_type_id?: string | null;
      };
      return {
        status: mapStatus(p.status),
        externalReference: p.external_reference ?? null,
        providerPaymentId: String(p.id),
        method: p.payment_type_id ?? p.payment_method_id ?? null,
      };
    },
  };
}
