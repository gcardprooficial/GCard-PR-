// Recarga por arquivo velho (sem framework): npx tsx scripts/check-stale-chunk.ts
import assert from "node:assert/strict";
import { isChunkError, mayReload } from "../src/lib/stale-chunk";

assert.ok(isChunkError("Failed to fetch dynamically imported module: https://www.gcardpro.com.br/assets/painel-CKuD.js"));
assert.ok(isChunkError("error loading dynamically imported module"));
assert.ok(isChunkError("Importing a module script failed."));
assert.ok(!isChunkError("Cannot read properties of undefined"));
assert.ok(!isChunkError("Network request failed"));

const now = 1_000_000;
assert.ok(mayReload(null, now), "primeira vez recarrega");
assert.ok(!mayReload(now - 5_000, now), "recarregou há 5 s: não repete (sem laço)");
assert.ok(!mayReload(now - 60_000, now), "no limite da janela ainda não");
assert.ok(mayReload(now - 61_000, now), "passou a janela: pode de novo");
console.log("check-stale-chunk: ok");
