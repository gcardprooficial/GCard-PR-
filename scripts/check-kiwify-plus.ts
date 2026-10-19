// GCard Plus / webhook Kiwify (sem framework): npx tsx scripts/check-kiwify-plus.ts
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { dedupeKey, parseKiwifyPlus, validKiwifySignature } from "../src/lib/plus-kiwify";

const mk = (event: string, status: string, freq = "monthly", extra: object = {}) => ({
  order_id: "o1", webhook_event_type: event, Product: { product_id: "p1" }, Customer: { email: " Ana@Example.com " },
  Subscription: { id: "s1", status, next_payment: "2026-11-19T10:00:00.000Z", plan: { frequency: freq } }, subscription_id: "s1", ...extra,
});

// assinatura
const raw = JSON.stringify(mk("order_approved", "active"));
const sig = createHmac("sha1", "tok").update(raw).digest("hex");
assert.ok(validKiwifySignature(raw, sig, "tok"));
assert.ok(validKiwifySignature(raw, sig.toUpperCase(), "tok"));
assert.ok(!validKiwifySignature(raw, sig, "outro"));
assert.ok(!validKiwifySignature(raw + " ", sig, "tok"), "corpo alterado");
assert.ok(!validKiwifySignature(raw, null, "tok"));
assert.ok(!validKiwifySignature(raw, "abc", "tok"));
assert.ok(!validKiwifySignature(raw, sig, undefined), "sem token configurado nunca valida");

// eventos
const a = parseKiwifyPlus(mk("order_approved", "active"))!;
assert.equal(a.status, "ativa");
assert.equal(a.plan, "mensal");
assert.equal(a.email, "ana@example.com");
assert.equal(a.periodEnd, "2026-11-19T10:00:00.000Z");
assert.equal(parseKiwifyPlus(mk("subscription_renewed", "active", "yearly"))!.plan, "anual");
assert.equal(parseKiwifyPlus(mk("subscription_late", "waiting_payment"))!.status, "atrasada");
assert.equal(parseKiwifyPlus(mk("subscription_canceled", "canceled"))!.status, "cancelada");
assert.equal(parseKiwifyPlus(mk("order_refunded", "canceled"))!.status, "reembolsada");

// ignorados (sem gravar nada)
assert.equal(parseKiwifyPlus(mk("pix_created", "active")), null, "evento desconhecido");
assert.equal(parseKiwifyPlus(mk("order_approved", "active", "weekly")), null, "plano que não é mensal/anual");
assert.equal(parseKiwifyPlus({ ...mk("order_approved", "active"), Customer: {} }), null, "sem e-mail");
assert.equal(parseKiwifyPlus({ ...mk("order_approved", "active"), subscription_id: undefined, Subscription: undefined }), null, "sem assinatura");
assert.equal(parseKiwifyPlus(null), null);
assert.ok(parseKiwifyPlus(mk("order_approved", "active"), ["p1"]));
assert.equal(parseKiwifyPlus(mk("order_approved", "active"), ["outro"]), null, "produto fora da lista");

// idempotência: mesmo aviso, mesma chave; renovação seguinte (outro pedido), outra
assert.equal(dedupeKey(a), dedupeKey(parseKiwifyPlus(mk("order_approved", "active"))!));
assert.notEqual(dedupeKey(a), dedupeKey(parseKiwifyPlus(mk("order_approved", "active", "monthly", { order_id: "o2" }))!));

console.log("check-kiwify-plus: ok");
