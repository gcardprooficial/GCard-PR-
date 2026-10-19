// Entrega de e-mail (Resend/Svix), sem framework: npx tsx scripts/check-email-delivery.ts
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isDeliveryProblem, parseResendEvent, validSvixSignature } from "../src/lib/email-delivery";

const secret = "whsec_" + Buffer.from("segredo-de-teste-1234567890").toString("base64");
const raw = JSON.stringify({ type: "email.bounced", data: { email_id: "m1", bounce: { message: "mailbox not found" } } });
const now = 1_800_000_000_000;
const ts = String(now / 1000);
const sig = "v1," + createHmac("sha256", Buffer.from("segredo-de-teste-1234567890")).update(`id1.${ts}.${raw}`).digest("base64");
const h = { id: "id1", timestamp: ts, signature: sig };

assert.ok(validSvixSignature(raw, h, secret, now));
assert.ok(validSvixSignature(raw, { ...h, signature: "v1,xxxx " + sig }, secret, now), "várias assinaturas");
assert.ok(!validSvixSignature(raw + " ", h, secret, now), "corpo alterado");
assert.ok(!validSvixSignature(raw, { ...h, id: "outro" }, secret, now), "id alterado");
assert.ok(!validSvixSignature(raw, h, "whsec_" + Buffer.from("errado").toString("base64"), now), "segredo errado");
assert.ok(!validSvixSignature(raw, h, undefined, now), "sem segredo");
assert.ok(!validSvixSignature(raw, h, secret, now + 10 * 60_000), "aviso antigo (repetição)");
assert.ok(!validSvixSignature(raw, { ...h, signature: null }, secret, now));

assert.deepEqual(parseResendEvent(JSON.parse(raw)), { messageId: "m1", status: "bounce", detail: "mailbox not found" });
assert.equal(parseResendEvent({ type: "email.delivered", data: { email_id: "m2" } })?.status, "entregue");
assert.equal(parseResendEvent({ type: "email.suppressed", data: { email_id: "m3" } })?.status, "suprimido");
assert.equal(parseResendEvent({ type: "email.opened", data: { email_id: "m4" } }), null);
assert.equal(parseResendEvent({ type: "email.bounced", data: {} }), null);
assert.ok(isDeliveryProblem("bounce") && isDeliveryProblem("suprimido") && isDeliveryProblem("reclamacao"));
assert.ok(!isDeliveryProblem("entregue") && !isDeliveryProblem("atrasado"));

console.log("check-email-delivery: ok");
