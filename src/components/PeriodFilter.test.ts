import { describe, expect, it } from "vitest";
import { describePeriod, inPeriod, periodPreset, resolvePeriod, type PeriodValue } from "./PeriodFilter";

const NOW = new Date(2026, 10, 12); // 12/11/2026

describe("resolvePeriod", () => {
  it("este mês e mês passado", () => {
    expect(resolvePeriod(periodPreset("mes"), NOW)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(resolvePeriod(periodPreset("mes_passado"), NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("últimos 7 dias inclui hoje", () => {
    expect(resolvePeriod(periodPreset("7d"), NOW)).toEqual({ from: "2026-11-06", to: "2026-11-12" });
  });
  it("trimestre e ano", () => {
    expect(resolvePeriod(periodPreset("trimestre"), NOW)).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(resolvePeriod(periodPreset("ano_passado"), NOW)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });
  it("todo o período não limita", () => {
    expect(resolvePeriod(periodPreset("tudo"), NOW)).toEqual({ from: null, to: null });
  });
  it("vários meses: vai do primeiro ao último dia", () => {
    const v: PeriodValue = { preset: "meses", from: "", to: "", months: ["2026-03", "2026-01"] };
    expect(resolvePeriod(v, NOW)).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });
});

describe("inPeriod", () => {
  it("meses soltos deixam o mês do meio de fora", () => {
    const v: PeriodValue = { preset: "meses", from: "", to: "", months: ["2026-01", "2026-03"] };
    expect(inPeriod(v, "2026-01-15")).toBe(true);
    expect(inPeriod(v, "2026-02-15")).toBe(false);
    expect(inPeriod(v, "2026-03-31")).toBe(true);
  });
  it("datas livres são inclusivas", () => {
    const v: PeriodValue = { preset: "custom", from: "2026-05-10", to: "2026-05-20", months: [] };
    expect(inPeriod(v, "2026-05-10")).toBe(true);
    expect(inPeriod(v, "2026-05-20")).toBe(true);
    expect(inPeriod(v, "2026-05-21")).toBe(false);
  });
  it("todo o período aceita qualquer data", () => {
    expect(inPeriod(periodPreset("tudo"), "1999-01-01")).toBe(true);
  });
});

describe("describePeriod", () => {
  it("resume meses marcados", () => {
    expect(describePeriod({ preset: "meses", from: "", to: "", months: ["2026-01", "2026-02"] })).toBe("Jan/26, Fev/26");
    expect(describePeriod({ preset: "meses", from: "", to: "", months: ["2026-01", "2026-02", "2026-03", "2026-04"] })).toBe("4 meses (Jan/26 a Abr/26)");
  });
});
