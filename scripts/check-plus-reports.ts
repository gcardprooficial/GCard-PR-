// GCard Plus: relatório mensal e alerta (sem framework): npx tsx scripts/check-plus-reports.ts
import assert from "node:assert/strict";
import { isDown, reportPeriod, sumByPlate, weekKey } from "../src/lib/plus-reports";

// só no dia 1 (fuso de São Paulo)
assert.equal(reportPeriod(new Date("2026-11-15T12:00:00Z")), null);
assert.deepEqual(reportPeriod(new Date("2026-11-01T12:00:00Z")), { period: "2026-10", from: "2026-10-01", to: "2026-10-31" });
assert.deepEqual(reportPeriod(new Date("2026-03-01T12:00:00Z")), { period: "2026-02", from: "2026-02-01", to: "2026-02-28" });
assert.deepEqual(reportPeriod(new Date("2027-01-01T12:00:00Z")), { period: "2026-12", from: "2026-12-01", to: "2026-12-31" });
// 02h UTC do dia 1 ainda é 23h do dia 31 em São Paulo: não é dia 1 ainda
assert.equal(reportPeriod(new Date("2026-11-01T02:00:00Z")), null);

// uma semana = uma chave (segunda 2026-10-19)
assert.equal(weekKey(new Date("2026-10-19T12:00:00Z")), "2026-10-19");
assert.equal(weekKey(new Date("2026-10-25T12:00:00Z")), "2026-10-19");
assert.equal(weekKey(new Date("2026-10-26T12:00:00Z")), "2026-10-26");

// fora do ar
assert.ok(isDown({ error: true }));
assert.ok(isDown({ status: 404 }) && isDown({ status: 410 }) && isDown({ status: 503 }));
assert.ok(!isDown({ status: 200 }) && !isDown({ status: 301 }));
assert.ok(!isDown({ status: 403 }) && !isDown({ status: 429 }) && !isDown({ status: 401 }), "site que barra robô não é queda");

// soma por código, com zero para quem não teve leitura
const m = sumByPlate(
  [
    { plate_id: "a", nfc: 2, qr: 1, leituras: 3 },
    { plate_id: "a", nfc: 0, qr: 4, leituras: 4 },
    { plate_id: "x", nfc: 9, qr: 9, leituras: 9 }, // não é do cliente: ignorado
  ],
  ["a", "b"],
);
assert.deepEqual(m.get("a"), { nfc: 2, qr: 5, total: 7 });
assert.deepEqual(m.get("b"), { nfc: 0, qr: 0, total: 0 });
assert.ok(!m.has("x"));

console.log("check-plus-reports: ok");
