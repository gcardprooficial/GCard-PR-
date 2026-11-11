import { afterEach, describe, expect, it } from "vitest";
import { classifyScan, parseScanSource, scanCountry, visitorHash } from "./scan-filter";

// Leitura de placa (/r/<token>): separa gente de robô e pré-visualização, e guarda só um hash do visitante.

const h = (o: Record<string, string>) => new Headers(o);
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("classifyScan", () => {
  it("celular de verdade não é robô", () => {
    expect(classifyScan(h({ "user-agent": CHROME_ANDROID }))).toEqual({
      isBot: false,
      reason: null,
    });
    expect(classifyScan(h({ "user-agent": SAFARI_IOS }))).toEqual({ isBot: false, reason: null });
  });
  it("sem User-Agent é robô", () => {
    expect(classifyScan(h({}))).toEqual({ isBot: true, reason: "sem_user_agent" });
    expect(classifyScan(h({ "user-agent": "   " })).isBot).toBe(true);
  });
  it("pré-visualização de link do WhatsApp, Facebook e Telegram é robô", () => {
    for (const ua of [
      "WhatsApp/2.24.10.80 A",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "TelegramBot (like TwitterBot)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    ]) {
      expect(classifyScan(h({ "user-agent": ua })).isBot, ua).toBe(true);
    }
  });
  it("ferramentas de linha de comando e navegador sem tela são robô", () => {
    for (const ua of [
      "curl/8.4.0",
      "python-requests/2.31",
      "HeadlessChrome/126.0",
      "Go-http-client/2.0",
      "node-fetch/1.0",
    ]) {
      expect(classifyScan(h({ "user-agent": ua })).isBot, ua).toBe(true);
    }
  });
  it("pré-carregamento do navegador é robô mesmo com UA de gente", () => {
    for (const header of ["sec-purpose", "purpose", "x-purpose", "x-moz"]) {
      const r = classifyScan(h({ "user-agent": CHROME_ANDROID, [header]: "prefetch" }));
      expect(r, header).toEqual({ isBot: true, reason: "prefetch" });
    }
    expect(
      classifyScan(h({ "user-agent": CHROME_ANDROID, "sec-purpose": "prefetch;prerender" })).isBot,
    ).toBe(true);
  });
  it("informa o motivo", () => {
    expect(classifyScan(h({ "user-agent": "curl/8.4.0" })).reason).toMatch(/^ua:curl/);
  });
});

describe("parseScanSource", () => {
  it("só aceita q (QR) e n (NFC)", () => {
    expect(parseScanSource("q")).toBe("q");
    expect(parseScanSource("n")).toBe("n");
    for (const bad of [null, "", "Q", "x", "qr", "nfc", "javascript:1"])
      expect(parseScanSource(bad as string | null), String(bad)).toBeNull();
  });
});

describe("scanCountry", () => {
  it("lê o país da Vercel e, se faltar, da Cloudflare, em maiúsculas", () => {
    expect(scanCountry(h({ "x-vercel-ip-country": "br" }))).toBe("BR");
    expect(scanCountry(h({ "cf-ipcountry": "pt" }))).toBe("PT");
  });
  it("ignora valor que não são 2 letras", () => {
    for (const v of ["BRA", "1", "", "B R", "<s>"])
      expect(scanCountry(h({ "x-vercel-ip-country": v })), v).toBeNull();
    expect(scanCountry(h({}))).toBeNull();
  });
});

describe("visitorHash", () => {
  const original = process.env["SCAN_HASH_SALT"];
  afterEach(() => {
    if (original === undefined) delete process.env["SCAN_HASH_SALT"];
    else process.env["SCAN_HASH_SALT"] = original;
  });
  it("é estável no mesmo dia e tem 24 caracteres hexadecimais", () => {
    const a = visitorHash("200.1.2.3", CHROME_ANDROID, "2026-11-11");
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(visitorHash("200.1.2.3", CHROME_ANDROID, "2026-11-11")).toBe(a);
  });
  it("não liga a mesma pessoa entre dias, nem pessoas diferentes", () => {
    const base = visitorHash("200.1.2.3", CHROME_ANDROID, "2026-11-11");
    expect(visitorHash("200.1.2.3", CHROME_ANDROID, "2026-11-12")).not.toBe(base);
    expect(visitorHash("200.1.2.4", CHROME_ANDROID, "2026-11-11")).not.toBe(base);
    expect(visitorHash("200.1.2.3", SAFARI_IOS, "2026-11-11")).not.toBe(base);
  });
  it("não deixa o IP nem o User-Agent legíveis no resultado", () => {
    const x = visitorHash("200.1.2.3", CHROME_ANDROID, "2026-11-11");
    expect(x).not.toContain("200");
    expect(x.toLowerCase()).not.toContain("chrome");
  });
  it("o sal muda o resultado", () => {
    process.env["SCAN_HASH_SALT"] = "sal-a";
    const a = visitorHash("1.1.1.1", "ua", "2026-11-11");
    process.env["SCAN_HASH_SALT"] = "sal-b";
    expect(visitorHash("1.1.1.1", "ua", "2026-11-11")).not.toBe(a);
  });
});
