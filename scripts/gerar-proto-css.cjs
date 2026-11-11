// Gera src/app/proto.css a partir do styles.css do protótipo (C:\MESTRA-TOQY-GCARD\prototipo-v2\src\styles.css),
// com todos os seletores dentro de ".v2" e o amarelo do Hub já embutido. Rode de novo se o protótipo mudar.
const fs = require("node:fs");
const path = require("node:path");

const origem = process.argv[2] || "C:/MESTRA-TOQY-GCARD/prototipo-v2/src/styles.css";
const destino = path.join(__dirname, "..", "src", "proto.css");
const css = fs.readFileSync(origem, "utf8");

// separa em blocos de nível superior (respeitando chaves aninhadas)
function blocos(texto) {
  const out = [];
  let i = 0;
  while (i < texto.length) {
    // comentários e espaços
    const resto = texto.slice(i);
    const c = resto.match(/^\s*\/\*[\s\S]*?\*\//);
    if (c) { out.push({ tipo: "comentario", texto: c[0] }); i += c[0].length; continue; }
    if (/^\s+$/.test(resto)) break;
    const abre = texto.indexOf("{", i);
    if (abre === -1) break;
    const cabeca = texto.slice(i, abre).trim();
    let nivel = 1, j = abre + 1;
    while (j < texto.length && nivel > 0) { if (texto[j] === "{") nivel++; else if (texto[j] === "}") nivel--; j++; }
    out.push({ tipo: "regra", cabeca, corpo: texto.slice(abre + 1, j - 1) });
    i = j;
  }
  return out;
}

function mapearSeletor(sel) {
  let s = sel.trim();
  if (!s) return null;
  if (s.includes(':not([data-product="amber"])')) return null; // regras só do verde do Toqy
  s = s.replace(/\[data-product="amber"\]/g, "");
  if (/^(html|body|html, body, #root|#root)$/.test(s)) return ".v2";
  if (s.startsWith(":root")) return s.replace(":root", ".v2");
  if (s.startsWith("[data-theme")) return ".v2" + s;
  if (s === "*") return ".v2 *";
  if (s.startsWith("html ") || s.startsWith("body ")) s = s.replace(/^(html|body)\s+/, "");
  return `.v2 ${s}`;
}

function converter(lista) {
  let out = "";
  for (const b of lista) {
    if (b.tipo === "comentario") { out += b.texto + "\n"; continue; }
    const { cabeca, corpo } = b;
    if (cabeca.startsWith("@keyframes") || cabeca.startsWith("@font-face") || cabeca.startsWith("@import") || cabeca.startsWith("@charset")) {
      out += `${cabeca} {${corpo}}\n`;
    } else if (cabeca.startsWith("@media") || cabeca.startsWith("@supports")) {
      out += `${cabeca} {\n${converter(blocos(corpo))}}\n`;
    } else {
      const sels = cabeca.split(",").map(mapearSeletor).filter(Boolean);
      if (sels.length) out += `${sels.join(",\n")} {${corpo}}\n`;
    }
  }
  return out;
}

const cabecalho = "/* GERADO por scripts/gerar-proto-css.cjs a partir do protótipo v2. Não editar à mão: edite o protótipo e gere de novo. Tudo vale só dentro de .v2. */\n";
fs.writeFileSync(destino, cabecalho + converter(blocos(css)));
console.log("gerado", destino, fs.statSync(destino).size, "bytes");
