// QR personalizado, regras de leitura (sem framework): npx tsx scripts/check-qr-style.ts
import assert from "node:assert/strict";
import { CAPTION_MAX, contrastRatio, logoSide, LOGO_MAX_FRACTION, luminance, PRESETS, styleProblem } from "../src/lib/qr-style";

assert.ok(Math.abs(contrastRatio("#000000", "#FFFFFF") - 21) < 0.01);
assert.ok(Math.abs(contrastRatio("#FFFFFF", "#FFFFFF") - 1) < 0.001);
assert.ok(luminance("#FFFFFF") > luminance("#000000"));

// todos os presets do produto têm que ser legíveis
for (const p of PRESETS) assert.equal(styleProblem({ fg: p.fg, bg: p.bg, caption: "" }), null, `preset ${p.name}`);

// estilos que o celular não leria são recusados
assert.match(styleProblem({ fg: "#FFFFFF", bg: "#000000", caption: "" })!, /mais escuro/, "QR claro em fundo escuro (invertido)");
assert.match(styleProblem({ fg: "#FFD700", bg: "#FFFFFF", caption: "" })!, /Contraste/, "amarelo no branco");
assert.match(styleProblem({ fg: "#777777", bg: "#999999", caption: "" })!, /Contraste/, "cinza no cinza");
assert.match(styleProblem({ fg: "azul", bg: "#FFFFFF", caption: "" })!, /inválida/);
assert.match(styleProblem({ fg: "#000000", bg: "#FFFFFF", caption: "x".repeat(CAPTION_MAX + 1) })!, /letras/);
assert.equal(styleProblem({ fg: "#000000", bg: "#FFFFFF", caption: "x".repeat(CAPTION_MAX) }), null);

// o logo nunca passa de 20% do lado (correção de erro H aguenta até ~30%)
assert.ok(LOGO_MAX_FRACTION <= 0.2);
assert.equal(logoSide(1000), 200);
assert.ok(logoSide(1234) <= 1234 * 0.2);

console.log("check-qr-style: ok");
