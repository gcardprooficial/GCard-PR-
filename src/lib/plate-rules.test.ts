import { describe, expect, it } from "vitest";
import {
  describeRule,
  pickRuleDestination,
  ruleMatches,
  spClock,
  toMinutes,
  type PlateRule,
} from "./plate-rules";

// Regras de destino do GCard Plus (horário, dia da semana e validade), sempre no fuso de São Paulo.
// Referência de datas: 2026-11-10 é terça (2), 2026-11-11 é quarta (3), 2026-11-14 é sábado (6), 2026-11-15 é domingo (0).

const regra = (p: Partial<PlateRule> = {}): PlateRule => ({
  id: "r1",
  label: null,
  destination_url: "https://exemplo.com/a",
  days: null,
  start_time: null,
  end_time: null,
  valid_from: null,
  valid_until: null,
  enabled: true,
  position: 0,
  ...p,
});
/** Instante a partir de um horário local de Brasília (UTC-3, sem horário de verão desde 2019). */
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe("spClock", () => {
  it("converte para São Paulo, inclusive virada de dia", () => {
    expect(spClock(new Date("2026-11-11T02:30:00Z"))).toEqual({
      date: "2026-11-10",
      weekday: 2,
      minutes: 23 * 60 + 30,
    });
    expect(spClock(sp("2026-11-11T00:00"))).toEqual({ date: "2026-11-11", weekday: 3, minutes: 0 });
    expect(spClock(sp("2026-11-15T12:05"))).toEqual({
      date: "2026-11-15",
      weekday: 0,
      minutes: 12 * 60 + 5,
    });
  });
  it("toMinutes aceita HH:MM e HH:MM:SS", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("23:59:59")).toBe(1439);
  });
});

describe("ruleMatches", () => {
  it("regra desligada nunca vale", () => {
    expect(ruleMatches(regra({ enabled: false }), sp("2026-11-11T12:00"))).toBe(false);
  });
  it("sem restrição vale sempre", () => {
    expect(ruleMatches(regra(), sp("2026-11-11T12:00"))).toBe(true);
  });
  it("dia da semana", () => {
    const seg_a_sex = regra({ days: [1, 2, 3, 4, 5] });
    expect(ruleMatches(seg_a_sex, sp("2026-11-11T12:00"))).toBe(true); // quarta
    expect(ruleMatches(seg_a_sex, sp("2026-11-14T12:00"))).toBe(false); // sábado
    expect(ruleMatches(regra({ days: [] }), sp("2026-11-14T12:00"))).toBe(true); // vazio = todos
  });
  it("validade inclui o primeiro e o último dia", () => {
    const r = regra({ valid_from: "2026-11-10", valid_until: "2026-11-12" });
    expect(ruleMatches(r, sp("2026-11-09T23:59"))).toBe(false);
    expect(ruleMatches(r, sp("2026-11-10T00:00"))).toBe(true);
    expect(ruleMatches(r, sp("2026-11-12T23:59"))).toBe(true);
    expect(ruleMatches(r, sp("2026-11-13T00:00"))).toBe(false);
  });
  it("janela de horário é fechada no começo e aberta no fim", () => {
    const r = regra({ start_time: "11:00", end_time: "15:00" });
    expect(ruleMatches(r, sp("2026-11-11T10:59"))).toBe(false);
    expect(ruleMatches(r, sp("2026-11-11T11:00"))).toBe(true);
    expect(ruleMatches(r, sp("2026-11-11T14:59"))).toBe(true);
    expect(ruleMatches(r, sp("2026-11-11T15:00"))).toBe(false);
  });
  it("janela que vira a noite", () => {
    const r = regra({ start_time: "22:00", end_time: "02:00" });
    expect(ruleMatches(r, sp("2026-11-11T23:30"))).toBe(true);
    expect(ruleMatches(r, sp("2026-11-12T01:59"))).toBe(true);
    expect(ruleMatches(r, sp("2026-11-12T02:00"))).toBe(false);
    expect(ruleMatches(r, sp("2026-11-11T12:00"))).toBe(false);
  });
  it("início igual ao fim vale o dia todo", () => {
    expect(
      ruleMatches(regra({ start_time: "00:00", end_time: "00:00" }), sp("2026-11-11T18:00")),
    ).toBe(true);
  });
  it("combina dia, validade e horário", () => {
    const r = regra({
      days: [5],
      start_time: "18:00",
      end_time: "23:00",
      valid_until: "2026-11-30",
    });
    expect(ruleMatches(r, sp("2026-11-13T19:00"))).toBe(true); // sexta
    expect(ruleMatches(r, sp("2026-11-12T19:00"))).toBe(false); // quinta
    expect(ruleMatches(r, sp("2026-12-04T19:00"))).toBe(false); // sexta, mas vencida
  });
});

describe("pickRuleDestination", () => {
  const agora = sp("2026-11-11T12:00");
  it("sem regra que case, devolve null (vale o destino normal do código)", () => {
    expect(pickRuleDestination([], agora)).toBeNull();
    expect(pickRuleDestination([regra({ enabled: false })], agora)).toBeNull();
  });
  it("a primeira regra por posição que casa vence", () => {
    const a = regra({ id: "a", position: 2, destination_url: "https://exemplo.com/a" });
    const b = regra({ id: "b", position: 1, destination_url: "https://exemplo.com/b" });
    expect(pickRuleDestination([a, b], agora)).toBe("https://exemplo.com/b");
  });
  it("pula a regra que não casa", () => {
    const fora = regra({ position: 0, days: [0], destination_url: "https://exemplo.com/domingo" });
    const dentro = regra({ position: 1, destination_url: "https://exemplo.com/sempre" });
    expect(pickRuleDestination([fora, dentro], agora)).toBe("https://exemplo.com/sempre");
  });
  it("não altera a lista recebida", () => {
    const lista = [regra({ id: "x", position: 5 }), regra({ id: "y", position: 1 })];
    pickRuleDestination(lista, agora);
    expect(lista.map((r) => r.id)).toEqual(["x", "y"]);
  });
});

describe("describeRule", () => {
  it("resume em português", () => {
    expect(
      describeRule(
        regra({
          days: [1, 2, 3, 4, 5],
          start_time: "11:00:00",
          end_time: "15:00:00",
          valid_until: "2026-12-31",
        }),
      ),
    ).toBe("seg, ter, qua, qui, sex · 11:00–15:00 · até 31/12/2026");
    expect(describeRule(regra())).toBe("todos os dias");
    expect(describeRule(regra({ days: [0, 1, 2, 3, 4, 5, 6] }))).toBe("todos os dias");
    expect(describeRule(regra({ valid_from: "2026-11-01", valid_until: "2026-11-30" }))).toBe(
      "todos os dias · de 01/11/2026 a 30/11/2026",
    );
    expect(describeRule(regra({ valid_from: "2026-11-01" }))).toBe(
      "todos os dias · a partir de 01/11/2026",
    );
  });
});
