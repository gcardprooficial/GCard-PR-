import { describe, expect, it } from "vitest";
import {
  FALLBACK_RULES,
  MAX_DESTINATION_LENGTH,
  checkDestination,
  isAllowedHost,
  isPublicHost,
  isToqyHost,
  isToqyUrl,
  normalizeDestination,
  rulesOrFallback,
  toqyOnboardingUrl,
  type DestinationRule,
} from "./destination";

// Para onde uma placa já impressa pode levar. Se isto quebrar, um QR em um balcão passa a abrir o lugar errado
// ou abre um endereço perigoso. Cada caso abaixo é uma regra que não pode mudar sem decisão do Leonardo.

const REGRAS: DestinationRule[] = [
  { host: "g.page", include_subdomains: false },
  { host: "google.com", include_subdomains: true },
  { host: "toqy.com.br", include_subdomains: true },
  { host: "wa.me", include_subdomains: false },
];

describe("isPublicHost", () => {
  it("aceita domínio público", () => {
    expect(isPublicHost("google.com")).toBe(true);
    expect(isPublicHost("Loja.Exemplo.com.br")).toBe(true);
  });
  it("recusa host sem ponto, localhost, IP e rede interna", () => {
    for (const h of [
      "localhost",
      "intranet",
      "127.0.0.1",
      "10.0.0.5",
      "192.168.0.1",
      "[::1]",
      "host:8080",
      "impressora.local",
      "app.internal",
      "nas.lan",
      "x.home",
      "y.corp",
    ]) {
      expect(isPublicHost(h), h).toBe(false);
    }
  });
});

describe("normalizeDestination", () => {
  it("recusa vazio, link muito longo e texto que não é link", () => {
    expect(normalizeDestination("   ").ok).toBe(false);
    expect(
      normalizeDestination("https://exemplo.com/" + "a".repeat(MAX_DESTINATION_LENGTH)).ok,
    ).toBe(false);
    expect(normalizeDestination("isto não é um link").ok).toBe(false);
  });
  it("só aceita http e https", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<b>x</b>",
      "ftp://exemplo.com/a",
      "file:///etc/passwd",
      "mailto:a@b.com",
    ]) {
      expect(normalizeDestination(bad).ok, bad).toBe(false);
    }
  });
  it("recusa usuário, senha e porta no endereço", () => {
    expect(normalizeDestination("https://user:pass@exemplo.com/").ok).toBe(false);
    expect(normalizeDestination("https://user@exemplo.com/").ok).toBe(false);
    expect(normalizeDestination("https://exemplo.com:8443/").ok).toBe(false);
  });
  it("recusa IP e endereço interno", () => {
    for (const bad of [
      "https://127.0.0.1/",
      "https://10.1.2.3/x",
      "http://localhost/",
      "https://impressora.local/",
    ]) {
      expect(normalizeDestination(bad).ok, bad).toBe(false);
    }
  });
  it("sobe http para https e avisa", () => {
    const r = normalizeDestination("http://exemplo.com/a?b=1");
    expect(r).toMatchObject({ ok: true, upgradedToHttps: true });
    if (r.ok) expect(r.url).toBe("https://exemplo.com/a?b=1");
  });
  it("mantém https como está e normaliza o host para minúsculas", () => {
    const r = normalizeDestination("  https://EXEMPLO.com/Caminho  ");
    expect(r).toMatchObject({ ok: true, upgradedToHttps: false });
    if (r.ok) expect(r.url).toBe("https://exemplo.com/Caminho");
  });
});

describe("isAllowedHost", () => {
  it("host exato", () => {
    expect(isAllowedHost("g.page", REGRAS)).toBe(true);
    expect(isAllowedHost("G.PAGE", REGRAS)).toBe(true);
    expect(isAllowedHost("outro.page", REGRAS)).toBe(false);
  });
  it("subdomínio só quando a regra permite", () => {
    expect(isAllowedHost("maps.google.com", REGRAS)).toBe(true);
    expect(isAllowedHost("bio.toqy.com.br", REGRAS)).toBe(true);
    expect(isAllowedHost("sub.wa.me", REGRAS)).toBe(false);
  });
  it("não confunde domínio parecido (sufixo sem ponto)", () => {
    expect(isAllowedHost("evilgoogle.com", REGRAS)).toBe(false);
    expect(isAllowedHost("google.com.evil.com", REGRAS)).toBe(false);
    expect(isAllowedHost("faketoqy.com.br", REGRAS)).toBe(false);
  });
  it('a regra "*" libera qualquer host', () => {
    expect(isAllowedHost("qualquer.com", [{ host: "*", include_subdomains: false }])).toBe(true);
  });
});

describe("rulesOrFallback", () => {
  it("sem regras no banco volta ao plano B (só Google), para nenhum QR já impresso quebrar", () => {
    expect(rulesOrFallback(null)).toBe(FALLBACK_RULES);
    expect(rulesOrFallback([])).toBe(FALLBACK_RULES);
    expect(FALLBACK_RULES.map((r) => r.host)).toEqual([
      "search.google.com",
      "www.google.com",
      "google.com",
      "maps.google.com",
      "g.page",
    ]);
  });
  it("com regras usa as do banco", () => {
    expect(rulesOrFallback(REGRAS)).toBe(REGRAS);
  });
});

describe("checkDestination", () => {
  it("aceita host liberado", () => {
    const r = checkDestination("https://g.page/r/abc/review", REGRAS);
    expect(r.ok).toBe(true);
  });
  it("host fora da lista vira pedido de liberação, com o host e a URL", () => {
    const r = checkDestination("https://www.nubank.com.br/cobrar/x", REGRAS);
    expect(r).toMatchObject({ ok: false, code: "host_nao_permitido", host: "www.nubank.com.br" });
  });
  it("uma URL exata liberada passa mesmo com o host fora da lista", () => {
    const url = "https://www.nubank.com.br/cobrar/x";
    expect(checkDestination(url, REGRAS, [url]).ok).toBe(true);
    expect(checkDestination("https://www.nubank.com.br/cobrar/outro", REGRAS, [url]).ok).toBe(
      false,
    );
  });
  it("sem regras no banco só o Google passa", () => {
    expect(checkDestination("https://www.google.com/maps", []).ok).toBe(true);
    expect(checkDestination("https://instagram.com/loja", []).ok).toBe(false);
  });
  it('mesmo com "*", IP, porta e usuário continuam recusados', () => {
    const livre: DestinationRule[] = [{ host: "*", include_subdomains: false }];
    expect(checkDestination("https://qualquer.com/x", livre).ok).toBe(true);
    expect(checkDestination("https://127.0.0.1/x", livre).ok).toBe(false);
    expect(checkDestination("https://qualquer.com:81/x", livre).ok).toBe(false);
    expect(checkDestination("https://a:b@qualquer.com/x", livre).ok).toBe(false);
  });
  it("http é aceito e sobe para https", () => {
    const r = checkDestination("http://g.page/r/abc", REGRAS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.startsWith("https://")).toBe(true);
  });
});

describe("Toqy", () => {
  it("reconhece o domínio do Toqy e subdomínios, e nada parecido", () => {
    expect(isToqyHost("toqy.com.br")).toBe(true);
    expect(isToqyHost("loja.toqy.com.br")).toBe(true);
    expect(isToqyHost("meutoqy.com.br")).toBe(false);
    expect(isToqyHost("toqy.com.br.evil.com")).toBe(false);
  });
  it("isToqyUrl lida com valor vazio ou quebrado", () => {
    expect(isToqyUrl("https://toqy.com.br/b/loja")).toBe(true);
    expect(isToqyUrl(null)).toBe(false);
    expect(isToqyUrl(undefined)).toBe(false);
    expect(isToqyUrl("não é url")).toBe(false);
  });
  it("o botão de criar página leva a origem para medir e o código da placa", () => {
    const u = new URL(toqyOnboardingUrl("GCARD-00252"));
    expect(u.origin + u.pathname).toBe("https://toqy.com.br/onboarding");
    expect(u.searchParams.get("utm_source")).toBe("gcard");
    expect(u.searchParams.get("codigo")).toBe("GCARD-00252");
  });
});

describe("isToqyUrl com domínio próprio liberado pelo Toqy", () => {
  it("reconhece o host registrado e volta ao normal ao limpar", async () => {
    const { isToqyUrl, registerToqyHosts } = await import("./destination");
    expect(isToqyUrl("https://www.barbeariadoleo.com.br/")).toBe(false);
    registerToqyHosts(["www.barbeariadoleo.com.br"]);
    expect(isToqyUrl("https://www.barbeariadoleo.com.br/")).toBe(true);
    expect(isToqyUrl("https://outro.com.br/")).toBe(false);
    registerToqyHosts([]);
    expect(isToqyUrl("https://www.barbeariadoleo.com.br/")).toBe(false);
  });
});
