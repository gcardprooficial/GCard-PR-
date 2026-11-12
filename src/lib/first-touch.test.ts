import { describe, expect, it } from "vitest";
import { parseFirstTouchCookie, sanitizeFirstTouch, trackingParameters } from "./first-touch";

describe("first-touch com UTM completo", () => {
  it("guarda utm_term, utm_id, src, sck e cliques, sem mudar maiúsculas dos códigos", () => {
    const ft = sanitizeFirstTouch({ utm_source: "Facebook", utm_term: "Placa NFC", utm_id: "123", src: "AbC", sck: "XyZ", fbclid: "IwAR_ABC", gclid: "Cj0K", ttclid: "TT9" });
    expect(ft).toMatchObject({ utm_source: "facebook", utm_term: "placa nfc", utm_id: "123", src: "AbC", sck: "XyZ", fbclid: "IwAR_ABC", gclid: "Cj0K", ttclid: "TT9" });
  });
  it("corta valores longos e ignora chaves desconhecidas", () => {
    const ft = sanitizeFirstTouch({ fbclid: "x".repeat(500), lixo: "y" });
    expect(ft?.fbclid).toHaveLength(200);
    expect((ft as Record<string, unknown>)["lixo"]).toBeUndefined();
  });
  it("lê do cookie", () => {
    const c = `gcard_ft=${encodeURIComponent(JSON.stringify({ utm_source: "instagram", sck: "AbC" }))}`;
    expect(parseFirstTouchCookie(`a=1; ${c}`)).toMatchObject({ utm_source: "instagram", sck: "AbC" });
  });
  it("monta os parâmetros da Utmify", () => {
    expect(trackingParameters({ utm_source: "ig", src: "s1" })).toEqual({ src: "s1", sck: null, utm_source: "ig", utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null });
    expect(trackingParameters(null).src).toBeNull();
  });
});
