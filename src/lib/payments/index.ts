import type { PaymentProvider } from "./provider";
import { createMercadoPagoProvider } from "./mercadopago";

export type { PaymentProvider } from "./provider";

let cached: PaymentProvider | null | undefined;

/** Returns the configured provider, or null when secrets are absent. */
export function getPaymentProvider(): PaymentProvider | null {
  if (cached !== undefined) return cached;
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  cached = token && secret ? createMercadoPagoProvider(token, secret) : null;
  return cached;
}
