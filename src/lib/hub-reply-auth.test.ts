import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseHubReplyBody, signHubReply, validHubReplySignature } from "./hub-reply-auth";

const SECRET = "x".repeat(40);
const NOW = 1_800_000_000;
const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("validHubReplySignature", () => {
  const body = JSON.stringify({ conversa: ID, texto: "Oi" });
  const ts = String(NOW);
  it("aceita assinatura correta", () =>
    expect(validHubReplySignature(body, ts, signHubReply(SECRET, ts, body), SECRET, NOW)).toBe(
      true,
    ));
  it("recusa corpo alterado, segredo curto e hora velha", () => {
    expect(
      validHubReplySignature(body + " ", ts, signHubReply(SECRET, ts, body), SECRET, NOW),
    ).toBe(false);
    expect(validHubReplySignature(body, ts, signHubReply("curto", ts, body), "curto", NOW)).toBe(
      false,
    );
    expect(
      validHubReplySignature(body, ts, signHubReply(SECRET, ts, body), SECRET, NOW + 1000),
    ).toBe(false);
  });
  it("recusa assinatura de evento (sem o prefixo reply)", () => {
    const evento = createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex");
    expect(validHubReplySignature(body, ts, evento, SECRET, NOW)).toBe(false);
  });
});

describe("parseHubReplyBody", () => {
  it("lê corpo válido", () =>
    expect(
      parseHubReplyBody(JSON.stringify({ conversa: ID.toUpperCase(), texto: " Oi " })),
    ).toEqual({ conversa: ID, texto: "Oi" }));
  it("recusa conversa inválida, texto vazio ou longo", () => {
    expect(parseHubReplyBody(JSON.stringify({ conversa: "1", texto: "Oi" }))).toBeNull();
    expect(parseHubReplyBody(JSON.stringify({ conversa: ID, texto: "  " }))).toBeNull();
    expect(parseHubReplyBody(JSON.stringify({ conversa: ID, texto: "a".repeat(2001) }))).toBeNull();
    expect(parseHubReplyBody("não é json")).toBeNull();
  });
});
