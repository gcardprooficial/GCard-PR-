import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseAllowHostBody, validToqySignature } from "./partner-toqy";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres-ok";
const NOW = 1_800_000_000;
const sign = (ts: string, raw: string) => createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");

describe("validToqySignature", () => {
  const raw = '{"host":"www.barbeariadoleo.com.br","action":"add"}';
  it("aceita assinatura correta dentro da janela", () => {
    expect(validToqySignature(raw, String(NOW), sign(String(NOW), raw), SECRET, NOW + 10)).toBe(true);
  });
  it("recusa assinatura errada", () => {
    expect(validToqySignature(raw, String(NOW), "0".repeat(64), SECRET, NOW)).toBe(false);
  });
  it("recusa corpo alterado", () => {
    expect(validToqySignature(raw + " ", String(NOW), sign(String(NOW), raw), SECRET, NOW)).toBe(false);
  });
  it("recusa relógio fora da janela de 5 minutos", () => {
    expect(validToqySignature(raw, String(NOW), sign(String(NOW), raw), SECRET, NOW + 301)).toBe(false);
    expect(validToqySignature(raw, String(NOW), sign(String(NOW), raw), SECRET, NOW - 301)).toBe(false);
  });
  it("recusa sem segredo ou com segredo curto", () => {
    expect(validToqySignature(raw, String(NOW), sign(String(NOW), raw), undefined, NOW)).toBe(false);
    expect(validToqySignature(raw, String(NOW), sign(String(NOW), raw), "curto", NOW)).toBe(false);
  });
  it("recusa carimbo que não é número", () => {
    expect(validToqySignature(raw, "abc", sign("abc", raw), SECRET, NOW)).toBe(false);
  });
});

describe("parseAllowHostBody", () => {
  it("aceita um host público", () => {
    expect(parseAllowHostBody('{"host":"www.barbeariadoleo.com.br","action":"add","owner_email":"Leo@Exemplo.com"}')).toEqual({ host: "www.barbeariadoleo.com.br", action: "add", ownerEmail: "leo@exemplo.com" });
  });
  it("recusa curinga, IP, localhost, porta, caminho e maiúsculas", () => {
    for (const host of ["*", "*.com.br", "127.0.0.1", "localhost", "site.com.br:8080", "site.com.br/pagina", "Site.com.br", "site..com.br", ".site.com.br", "meusite.local"]) {
      expect(parseAllowHostBody(JSON.stringify({ host, action: "add" }))).toBeNull();
    }
  });
  it("recusa ação desconhecida e corpo inválido", () => {
    expect(parseAllowHostBody('{"host":"site.com.br","action":"apagar"}')).toBeNull();
    expect(parseAllowHostBody("não é json")).toBeNull();
  });
  it("recusa e-mail inválido", () => {
    expect(parseAllowHostBody('{"host":"site.com.br","action":"remove","owner_email":"sem-arroba"}')).toBeNull();
  });
});
