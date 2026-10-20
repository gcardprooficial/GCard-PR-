// Regras de destino (horário/dia/validade), sem framework: npx tsx scripts/check-plate-rules.ts
import assert from "node:assert/strict";
import { describeRule, pickRuleDestination, ruleMatches, spClock, type PlateRule } from "../src/lib/plate-rules";

const rule = (over: Partial<PlateRule>): PlateRule => ({
  id: "r", label: null, destination_url: "https://a.com", days: null, start_time: null, end_time: null,
  valid_from: null, valid_until: null, enabled: true, position: 0, ...over,
});
// São Paulo = UTC-3 (sem horário de verão). 2026-10-19 é segunda-feira.
const sp = (iso: string) => new Date(`${iso}-03:00`);

// relógio de São Paulo
assert.deepEqual(spClock(sp("2026-10-19T12:30:00")), { date: "2026-10-19", weekday: 1, minutes: 750 });
assert.deepEqual(spClock(new Date("2026-10-20T02:00:00Z")), { date: "2026-10-19", weekday: 1, minutes: 23 * 60 }); // 23h do dia 19 em SP

// janela de horário
const almoco = rule({ start_time: "11:00", end_time: "15:00" });
assert.ok(ruleMatches(almoco, sp("2026-10-19T11:00:00")), "início é inclusivo");
assert.ok(ruleMatches(almoco, sp("2026-10-19T14:59:00")));
assert.ok(!ruleMatches(almoco, sp("2026-10-19T15:00:00")), "fim é exclusivo");
assert.ok(!ruleMatches(almoco, sp("2026-10-19T10:59:00")));

// janela que vira a noite (18h às 02h)
const noite = rule({ start_time: "18:00", end_time: "02:00" });
assert.ok(ruleMatches(noite, sp("2026-10-19T23:30:00")));
assert.ok(ruleMatches(noite, sp("2026-10-20T01:59:00")));
assert.ok(!ruleMatches(noite, sp("2026-10-20T02:00:00")));
assert.ok(!ruleMatches(noite, sp("2026-10-19T12:00:00")));

// dias da semana (seg a sex)
const util = rule({ days: [1, 2, 3, 4, 5] });
assert.ok(ruleMatches(util, sp("2026-10-19T09:00:00")), "segunda");
assert.ok(!ruleMatches(util, sp("2026-10-24T09:00:00")), "sábado");
assert.ok(ruleMatches(rule({ days: [] }), sp("2026-10-24T09:00:00")), "lista vazia = todos os dias");

// validade (inclusiva nas duas pontas)
const promo = rule({ valid_from: "2026-10-20", valid_until: "2026-10-22" });
assert.ok(!ruleMatches(promo, sp("2026-10-19T23:59:00")));
assert.ok(ruleMatches(promo, sp("2026-10-20T00:00:00")));
assert.ok(ruleMatches(promo, sp("2026-10-22T23:59:00")));
assert.ok(!ruleMatches(promo, sp("2026-10-23T00:00:00")));

// desligada nunca casa
assert.ok(!ruleMatches(rule({ enabled: false }), sp("2026-10-19T09:00:00")));

// precedência por posição; sem regra que case, null (= destino normal)
const a = rule({ id: "a", position: 2, destination_url: "https://geral.com" });
const b = rule({ id: "b", position: 1, destination_url: "https://almoco.com", start_time: "11:00", end_time: "15:00" });
assert.equal(pickRuleDestination([a, b], sp("2026-10-19T12:00:00")), "https://almoco.com");
assert.equal(pickRuleDestination([a, b], sp("2026-10-19T20:00:00")), "https://geral.com");
assert.equal(pickRuleDestination([b], sp("2026-10-19T20:00:00")), null);
assert.equal(pickRuleDestination([], new Date()), null);

// texto
assert.equal(describeRule(util), "seg, ter, qua, qui, sex");
assert.equal(describeRule(rule({})), "todos os dias");
assert.equal(describeRule(rule({ days: [6, 0], start_time: "10:00:00", end_time: "14:00:00", valid_until: "2026-12-31" })), "dom, sáb · 10:00–14:00 · até 31/12/2026");

console.log("check-plate-rules: ok");
