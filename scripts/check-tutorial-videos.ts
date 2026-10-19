// Vídeos tutoriais (sem framework): npx tsx scripts/check-tutorial-videos.ts
// Trava: os IDs novos (canal novo), nenhum ID do canal removido no código, e a trava de "assistir até o fim" fora do checkout.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TUTORIAL_NFC_URL, TUTORIAL_QR_URL, TUTORIAL_VIDEOS } from "../src/lib/tutorial-videos";

assert.equal(TUTORIAL_VIDEOS.nfc, "8szG1_t3t-I");
assert.equal(TUTORIAL_VIDEOS.qr, "nsWdLR_xl_I");
assert.equal(TUTORIAL_NFC_URL, "https://youtube.com/shorts/8szG1_t3t-I");
assert.equal(TUTORIAL_QR_URL, "https://youtube.com/shorts/nsWdLR_xl_I");

const files: string[] = [];
(function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) files.push(p);
  }
})("src");
for (const f of files) {
  const s = readFileSync(f, "utf8");
  assert.ok(!s.includes("zeA8QT-3Ltc") && !s.includes("q8W2ojaF5vE"), `${f}: ID de vídeo do canal antigo`);
}

const comprar = readFileSync("src/routes/comprar.tsx", "utf8");
assert.ok(!comprar.includes("video1Watched") && !comprar.includes("RequiredVideo"), "checkout ainda tem a trava de vídeo");
assert.ok(comprar.includes("É opcional"), "checkout deve dizer que o vídeo é opcional");
assert.ok(!/case "videos":\s*\n\s*return/.test(comprar), "etapa de vídeos não pode bloquear o avanço");

console.log("check-tutorial-videos: ok");
