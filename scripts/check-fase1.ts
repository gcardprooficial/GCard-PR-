// Verificação rápida da lógica da Fase 1 (sem framework): npx tsx scripts/check-fase1.ts
import assert from "node:assert/strict";
import { checkDestination, isAllowedHost, isToqyUrl, normalizeDestination, type DestinationRule } from "../src/lib/destination";
import { classifyScan, parseScanSource, scanCountry } from "../src/lib/scan-filter";
import { buildQrMatrix, qrToSvg, QUIET_ZONE_MODULES } from "../src/lib/qr-export";
import { suggestEmailDomain } from "../src/lib/email-typo";
import { nonBusinessDayNotice } from "../src/lib/business-hours";

const rules: DestinationRule[] = [
  { host: "search.google.com", include_subdomains: false },
  { host: "g.page", include_subdomains: false },
  { host: "toqy.com.br", include_subdomains: true },
  { host: "www.toqy.com.br", include_subdomains: false },
];

// --- destino: só https (http sobe para https), sem javascript:/data:, sem usuário/porta, hosts da tabela
for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://toqy.com.br/x", "https://evil.com/", "https://toqy.com.br.evil.com/", "https://evil.com/toqy.com.br", "https://user:pw@toqy.com.br/", "https://toqy.com.br:8443/x", "https://eviltoqy.com.br/", ""]) {
  assert.equal(checkDestination(bad, rules).ok, false, `deveria recusar: ${bad}`);
}
for (const good of ["https://search.google.com/local/writereview?placeid=abc", "https://g.page/r/xyz/review", "https://toqy.com.br/b/loja", "https://www.toqy.com.br/b/loja", "https://loja.toqy.com.br/", "  https://TOQY.com.br/b/x  "]) {
  assert.equal(checkDestination(good, rules).ok, true, `deveria aceitar: ${good}`);
}
const up = normalizeDestination("http://toqy.com.br/b/x");
assert.ok(up.ok && up.url.startsWith("https://") && up.upgradedToHttps);
assert.equal(normalizeDestination("https://toqy.com.br/" + "a".repeat(2100)).ok, false);
assert.equal(isAllowedHost("faketoqy.com.br", rules), false);
assert.equal(isToqyUrl("https://x.toqy.com.br/p"), true);

// --- leituras: robôs e pré-visualizações separados; origem só q/n; país Vercel antes da Cloudflare
const h = (ua: string, extra: Record<string, string> = {}) => new Headers({ "user-agent": ua, ...extra });
assert.equal(classifyScan(h("WhatsApp/2.23.20.0 A")).isBot, true);
assert.equal(classifyScan(h("facebookexternalhit/1.1")).isBot, true);
assert.equal(classifyScan(h("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).isBot, false);
assert.equal(classifyScan(h("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36 Instagram 300.0")).isBot, false);
assert.equal(classifyScan(h("Mozilla/5.0 Chrome/120", { "sec-purpose": "prefetch;prerender" })).isBot, true);
assert.equal(classifyScan(new Headers()).isBot, true);
assert.equal(parseScanSource("q"), "q");
assert.equal(parseScanSource("n"), "n");
assert.equal(parseScanSource("x"), null);
assert.equal(parseScanSource("javascript:1"), null);
assert.equal(scanCountry(new Headers({ "x-vercel-ip-country": "br", "cf-ipcountry": "US" })), "BR");
assert.equal(scanCountry(new Headers({ "cf-ipcountry": "PT" })), "PT");

// --- QR: SVG tem margem de 4 módulos, e o espelhado é o horizontal do normal
const m = await buildQrMatrix("https://gcardpro.com.br/r/AbCdEfGh2345?s=q");
const svg = qrToSvg(m, { mirrored: false });
const total = m.size + QUIET_ZONE_MODULES * 2;
assert.ok(svg.includes(`viewBox="0 0 ${total} ${total}"`));
const cells = (mirrored: boolean) => {
  const out = new Set<string>();
  for (const part of qrToSvg(m, { mirrored }).match(/M\d+ \d+h\d+/g) ?? []) {
    const [, x, y, w] = part.match(/M(\d+) (\d+)h(\d+)/)!.map(Number) as [number, number, number, number];
    for (let i = 0; i < w; i++) out.add(`${x + i},${y}`);
  }
  return out;
};
const normal = cells(false);
const flipped = cells(true);
for (const k of normal) {
  const [x, y] = k.split(",").map(Number) as [number, number];
  assert.ok(x >= QUIET_ZONE_MODULES && x < QUIET_ZONE_MODULES + m.size, "módulo fora da área do QR (invade a margem)");
  assert.ok(flipped.has(`${2 * QUIET_ZONE_MODULES + m.size - 1 - x},${y}`), "espelhado não é o horizontal do normal");
}
assert.equal(normal.size, flipped.size);

// --- e-mail com erro de digitação
assert.equal(suggestEmailDomain("ana@gmail.con"), "ana@gmail.com");
assert.equal(suggestEmailDomain("ana@hotmal.com"), "ana@hotmail.com");
assert.equal(suggestEmailDomain("ana@gmail.com"), null);
assert.equal(suggestEmailDomain("ana@empresa.com.br"), null);

// --- fim de semana / feriado (Brasília)
assert.equal(nonBusinessDayNotice(new Date("2026-10-14T15:00:00Z")), null); // quarta
assert.ok(nonBusinessDayNotice(new Date("2026-10-17T15:00:00Z"))); // sábado
assert.ok(nonBusinessDayNotice(new Date("2026-10-12T15:00:00Z"))); // feriado

console.log("check-fase1: tudo certo");
