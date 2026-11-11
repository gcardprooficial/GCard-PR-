import { describe, expect, it } from "vitest";
import {
  BUSINESS_HOURS,
  PRODUCTION_LONG,
  PRODUCTION_SHORT,
  nonBusinessDayNotice,
} from "./business-hours";
import { CARRIERS, carrierLabel, trackingUrl } from "./shipping";
import { suggestEmailDomain } from "./email-typo";

// Operação: dia útil (a produção só trabalha segunda a sexta, 9h às 17h), rastreio e e-mail digitado errado.
// Referência: 2026-11-11 é quarta; 14 é sábado; 15 (domingo) e 20 (sexta) são feriados nacionais; 2026-04-03 é Sexta-feira Santa.

const em = (iso: string) => new Date(`${iso}-03:00`); // horário de Brasília

describe("textos de horário", () => {
  it("o horário aparece igual em todos os textos", () => {
    expect(BUSINESS_HOURS).toBe("segunda a sexta, das 9h às 17h");
    expect(PRODUCTION_SHORT).toContain(BUSINESS_HOURS);
    expect(PRODUCTION_LONG).toContain(BUSINESS_HOURS);
  });
});

describe("nonBusinessDayNotice", () => {
  it("dia útil não tem aviso", () => {
    expect(nonBusinessDayNotice(em("2026-11-11T10:00"))).toBeNull();
    expect(nonBusinessDayNotice(em("2026-11-13T16:59"))).toBeNull();
  });
  it("sábado avisa a próxima segunda", () => {
    expect(nonBusinessDayNotice(em("2026-11-14T12:00"))?.nextBusinessDay).toBe(
      "segunda-feira (16/11)",
    );
  });
  it("domingo avisa a próxima segunda", () => {
    expect(nonBusinessDayNotice(em("2026-11-15T09:00"))?.nextBusinessDay).toBe(
      "segunda-feira (16/11)",
    );
  });
  it("usa a data de Brasília, não a de UTC", () => {
    // 02:00 UTC de sábado ainda é sexta à noite em Brasília: dia útil.
    expect(nonBusinessDayNotice(new Date("2026-11-14T02:00:00Z"))).toBeNull();
    // 01:00 UTC de domingo já é sábado à noite em Brasília: sem produção.
    expect(nonBusinessDayNotice(new Date("2026-11-15T01:00:00Z"))?.nextBusinessDay).toBe(
      "segunda-feira (16/11)",
    );
  });
  it("feriado nacional (Consciência Negra, sexta) pula o fim de semana", () => {
    expect(nonBusinessDayNotice(em("2026-11-20T11:00"))?.nextBusinessDay).toBe(
      "segunda-feira (23/11)",
    );
  });
  it("Carnaval, Sexta-feira Santa e Corpus Christi são feriados", () => {
    expect(nonBusinessDayNotice(em("2026-02-16T11:00"))).not.toBeNull(); // segunda de Carnaval
    expect(nonBusinessDayNotice(em("2026-02-17T11:00"))?.nextBusinessDay).toBe(
      "quarta-feira (18/02)",
    ); // terça de Carnaval
    expect(nonBusinessDayNotice(em("2026-04-03T11:00"))?.nextBusinessDay).toBe(
      "segunda-feira (06/04)",
    ); // Sexta Santa
    expect(nonBusinessDayNotice(em("2026-06-04T11:00"))?.nextBusinessDay).toBe(
      "sexta-feira (05/06)",
    ); // Corpus Christi (quinta)
  });
  it("feriados fixos", () => {
    for (const d of [
      "2026-01-01",
      "2026-04-21",
      "2026-05-01",
      "2026-09-07",
      "2026-10-12",
      "2026-11-02",
      "2026-12-25",
    ]) {
      expect(nonBusinessDayNotice(em(`${d}T11:00`)), d).not.toBeNull();
    }
  });
});

describe("transportadoras e rastreio", () => {
  it("lista as transportadoras usadas", () => {
    expect(CARRIERS.map((c) => c.value)).toEqual([
      "correios",
      "jadlog",
      "loggi",
      "azul_cargo",
      "latam_cargo",
      "j_e_t",
      "outra",
    ]);
  });
  it("carrierLabel traduz e tem valor padrão", () => {
    expect(carrierLabel("jadlog")).toBe("Jadlog");
    expect(carrierLabel("j_e_t")).toBe("J&T Express");
    expect(carrierLabel("desconhecida")).toBe("Transportadora");
    expect(carrierLabel(null)).toBe("Transportadora");
  });
  it("monta o link de rastreio das que têm", () => {
    expect(trackingUrl("correios", "AE003507088BR")).toBe(
      "https://rastreamento.correios.com.br/app/index.php?objetos=AE003507088BR",
    );
    expect(trackingUrl("jadlog", "13191900799520")).toBe(
      "https://www.jadlog.com.br/tracking/13191900799520",
    );
    expect(trackingUrl("loggi", "ABC123")).toBe("https://www.loggi.com/rastreador/ABC123");
  });
  it("codifica o código para não quebrar o link", () => {
    expect(trackingUrl("jadlog", "a b/c?d")).toBe(
      "https://www.jadlog.com.br/tracking/a%20b%2Fc%3Fd",
    );
  });
  it("sem link para as demais e sem transportadora", () => {
    expect(trackingUrl("azul_cargo", "X1")).toBeNull();
    expect(trackingUrl("outra", "X1")).toBeNull();
    expect(trackingUrl(null, "X1")).toBeNull();
  });
});

describe("suggestEmailDomain", () => {
  it("corrige erros conhecidos mantendo a parte antes do @", () => {
    expect(suggestEmailDomain("ana@gmail.con")).toBe("ana@gmail.com");
    expect(suggestEmailDomain("Joao.Silva@gmial.com")).toBe("Joao.Silva@gmail.com");
    expect(suggestEmailDomain("x@hotmal.com")).toBe("x@hotmail.com");
  });
  it("sugere o domínio comum mais próximo (até 1 ou 2 letras de diferença)", () => {
    expect(suggestEmailDomain("a@hotmaill.com")).toBe("a@hotmail.com");
    expect(suggestEmailDomain("a@outlookk.com")).toBe("a@outlook.com");
  });
  it("não mexe em domínio certo ou desconhecido demais", () => {
    expect(suggestEmailDomain("a@gmail.com")).toBeNull();
    expect(suggestEmailDomain("a@empresa.com.br")).toBeNull();
    expect(suggestEmailDomain("a@minhaloja.com")).toBeNull();
  });
  it("lida com e-mail incompleto", () => {
    expect(suggestEmailDomain("")).toBeNull();
    expect(suggestEmailDomain("sem-arroba")).toBeNull();
    expect(suggestEmailDomain("@gmail.con")).toBeNull();
    expect(suggestEmailDomain("a@semponto")).toBeNull();
  });
  it("ignora espaços nas pontas e maiúsculas no domínio", () => {
    expect(suggestEmailDomain("  ana@GMAIL.CON ")).toBe("ana@gmail.com");
  });
});
