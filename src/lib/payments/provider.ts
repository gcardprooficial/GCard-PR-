// Payment provider abstraction. The checkout and webhook only speak this
// interface, so switching providers means adding one file, not rewriting flows.

export type PaymentStatus = "pendente" | "pago" | "recusado" | "estornado" | "cancelado";

export type OrderForCheckout = {
  id: string;
  order_number: number;
  total_cents: number;
  quantity: number;
  customer_email: string;
  customer_name: string;
};

export type CheckoutPreference = {
  /** URL to send the buyer to (hosted checkout). */
  url: string;
  /** Provider-side id of the preference/intent, for reconciliation. */
  reference: string | null;
};

export type VerifiedEvent = {
  /** Provider payment id, to reconsult. */
  paymentId: string;
};

export type PaymentResult = {
  status: PaymentStatus;
  /** orders.external_reference set when the preference was created. */
  externalReference: string | null;
  providerPaymentId: string;
  method: string | null;
};

export interface PaymentProvider {
  readonly name: string;
  createPreference(input: {
    order: OrderForCheckout;
    origin: string;
  }): Promise<CheckoutPreference>;
  /** Validate an incoming webhook request. Returns null if invalid/irrelevant. */
  verifyWebhook(request: Request, rawBody: string): Promise<VerifiedEvent | null>;
  /** Reconsult the provider API for the authoritative payment state. */
  getPayment(paymentId: string): Promise<PaymentResult | null>;
}
