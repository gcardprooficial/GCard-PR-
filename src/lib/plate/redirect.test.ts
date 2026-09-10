import { describe, expect, it } from "vitest";
import { googleWriteReviewUrl, isSafePlateDestination } from "./redirect";

describe("isSafePlateDestination", () => {
  it("aceita URL de avaliação do Google", () => {
    expect(isSafePlateDestination("https://search.google.com/local/writereview?placeid=X")).toBe(true);
    expect(isSafePlateDestination("https://g.page/r/abc/review")).toBe(true);
    expect(isSafePlateDestination("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isSafePlateDestination("https://www.google.com/maps/place/x")).toBe(true);
  });

  it("rejeita http (sem s)", () => {
    expect(isSafePlateDestination("http://search.google.com/local/writereview?placeid=X")).toBe(false);
  });

  it("rejeita host fora da allowlist (anti open-redirect)", () => {
    expect(isSafePlateDestination("https://evil.com/phish")).toBe(false);
    expect(isSafePlateDestination("https://google.com.evil.com/x")).toBe(false);
    expect(isSafePlateDestination("javascript:alert(1)")).toBe(false);
    expect(isSafePlateDestination("not a url")).toBe(false);
  });

  it("googleWriteReviewUrl monta com place_id encodado", () => {
    expect(googleWriteReviewUrl("ChIJ 1")).toBe("https://search.google.com/local/writereview?placeid=ChIJ%201");
  });
});
