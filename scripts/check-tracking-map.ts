// Rastreio automático (sem framework): npx tsx scripts/check-tracking-map.ts
import assert from "node:assert/strict";
import { carrierFromCompany, nextFulfillment, parseSuperFreteEvent, stageFromStatus } from "../src/lib/shipping/tracking-map";

assert.equal(carrierFromCompany("Correios"), "correios");
assert.equal(carrierFromCompany("CORREIOS - PAC"), "correios");
assert.equal(carrierFromCompany("Jadlog"), "jadlog");
assert.equal(carrierFromCompany("Loggi"), "loggi");
assert.equal(carrierFromCompany("Azul Cargo Express"), "azul_cargo");
assert.equal(carrierFromCompany("J&T Express"), "j_e_t");
assert.equal(carrierFromCompany("Transportadora X"), "outra");
assert.equal(carrierFromCompany(""), null);
assert.equal(carrierFromCompany(null), null);

assert.equal(stageFromStatus("posted"), "enviado");
assert.equal(stageFromStatus("Delivered"), "entregue");
assert.equal(stageFromStatus("released"), "etiqueta");
assert.equal(stageFromStatus("canceled"), "cancelado");
assert.equal(stageFromStatus("algo_novo"), "desconhecido");
assert.equal(stageFromStatus(null), "desconhecido");

// só avança; nunca rebaixa; cancelado e desconhecido não mexem
assert.equal(nextFulfillment("pronto", "enviado"), "enviado");
assert.equal(nextFulfillment("em_producao", "enviado"), "enviado");
assert.equal(nextFulfillment("enviado", "enviado"), null);
assert.equal(nextFulfillment("enviado", "entregue"), "entregue");
assert.equal(nextFulfillment("pronto", "entregue"), "entregue");
assert.equal(nextFulfillment("entregue", "enviado"), null, "entregue não volta");
assert.equal(nextFulfillment("entregue", "entregue"), null);
assert.equal(nextFulfillment("cancelado", "entregue"), null);
assert.equal(nextFulfillment("enviado", "etiqueta"), null);
assert.equal(nextFulfillment("enviado", "desconhecido"), null);
assert.equal(nextFulfillment("enviado", "cancelado"), null, "etiqueta cancelada não reverte o pedido sozinha");

// SuperFrete: webhook
assert.deepEqual(parseSuperFreteEvent({ event: "order.posted", data: { id: "x", tracking: " SF123BR ", posted_at: "2026-10-21T10:00:00Z" } }), { stage: "enviado", tracking: "SF123BR", postedAt: "2026-10-21T10:00:00.000Z" });
assert.equal(parseSuperFreteEvent({ event: "order.delivered", data: { tracking: "SF123BR" } })?.stage, "entregue");
assert.equal(parseSuperFreteEvent({ event: "order.created", data: { tracking: "SF123BR" } }), null, "evento desconhecido");
assert.equal(parseSuperFreteEvent({ event: "order.posted", data: {} }), null, "sem código de rastreio");
assert.equal(parseSuperFreteEvent(null), null);

console.log("check-tracking-map: ok");
