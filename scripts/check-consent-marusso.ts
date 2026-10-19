// Verificação do aceite "Marusso" e do reply_to (sem framework): npx tsx scripts/check-consent-marusso.ts
// Trava: texto EXATO (uma palavra mudada falha), versão, uso do mesmo texto nos 4 pontos de tela e comportamento do reply_to.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, MARUSSO_CONSENT_TEXT, MARUSSO_CONSENT_VERSION } from "../src/lib/consent";
import { replyToField } from "../src/lib/reply-to";

// --- texto exato do pedido do Hub (cópia literal; qualquer mudança aqui exige nova versão do texto)
const TEXTO_EXATO =
  "Quero receber novidades e ofertas da Marusso Produções (TOQY, GCard-PRÓ, cursos e outros produtos) por e-mail. Posso sair quando quiser.";
assert.equal(MARUSSO_CONSENT_TEXT, TEXTO_EXATO);
assert.equal(MARUSSO_CONSENT_VERSION, "marusso-2026-10-v1");

// --- o aceite atual continua intocado
assert.equal(CONSENT_TEXT_VERSION, "2026-10-v1");
assert.equal(
  CONSENT_TEXT,
  "Quero receber novidades e ofertas dos produtos da Marusso Produções (GCard-PRÓ e TOQY) por e-mail. Posso cancelar quando quiser.",
);

// --- a migração grava o MESMO texto em consent_texts (o banco guarda o texto exibido de cada versão)
const migracao = readFileSync("supabase/migrations/20261028000000_aceite_marusso.sql", "utf8");
assert.ok(migracao.includes(`'${TEXTO_EXATO}'`), "migração com texto diferente do código");
assert.ok(migracao.includes("'marusso-2026-10-v1'"));

// --- os quatro pontos usam a constante (nenhum tem cópia do texto) e a caixa nunca vem marcada
const pontos: [string, string][] = [
  ["cadastro", "src/components/AuthForm.tsx"],
  ["checkout", "src/routes/comprar.tsx"],
  ["gerador", "src/components/ReviewLinkGenerator.tsx"],
  ["configurações", "src/components/AvisosPorEmail.tsx"],
];
for (const [nome, arquivo] of pontos) {
  const src = readFileSync(arquivo, "utf8");
  assert.ok(src.includes("MARUSSO_CONSENT_TEXT"), `${nome}: não usa a constante do texto`);
  assert.ok(!src.includes("Quero receber novidades e ofertas da Marusso"), `${nome}: tem cópia do texto`);
}
for (const arquivo of ["src/components/AuthForm.tsx", "src/routes/comprar.tsx", "src/components/ReviewLinkGenerator.tsx"]) {
  assert.match(readFileSync(arquivo, "utf8"), /useState\(false\)/, `${arquivo}: estado inicial deve ser desmarcado`);
}
// cadastro: a caixa Marusso viaja no metadata que o gatilho do banco lê
assert.ok(readFileSync("src/components/AuthForm.tsx", "utf8").includes("marusso_consent: marusso"));
// configurações: o aviso exigido na tela de desativar
assert.ok(readFileSync("src/components/AvisosPorEmail.tsx", "utf8").includes("Desativar cancela todos os e-mails de novidades e ofertas."));
// privacidade: controladora, CNPJ, cidade e finalidade
const priv = readFileSync("src/routes/privacidade.tsx", "utf8");
for (const trecho of ["Marusso Produções", "68.194.199/0001-70", "Indaiatuba/SP", "novidades e ofertas"]) {
  assert.ok(priv.includes(trecho), `privacidade sem: ${trecho}`);
}

// --- reply_to: só entra quando a variável existe (e não é vazia); nada de valor no código
assert.deepEqual(replyToField({}), {});
assert.deepEqual(replyToField({ RESEND_REPLY_TO: "" }), {});
assert.deepEqual(replyToField({ RESEND_REPLY_TO: "   " }), {});
assert.deepEqual(replyToField({ RESEND_REPLY_TO: " contato@exemplo.com " }), { reply_to: "contato@exemplo.com" });
assert.ok(!readFileSync("src/lib/reply-to.ts", "utf8").includes("@gcardpro"), "endereço de e-mail fixo no código");
assert.ok(!readFileSync("src/lib/email-events.server.ts", "utf8").includes("contato@"), "endereço de e-mail fixo no envio");

console.log("check-consent-marusso: ok");
