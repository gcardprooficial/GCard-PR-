import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetch-all";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);
const source = (total: number) => async (from: number, to: number) => ({ data: rows(total).slice(from, to + 1), error: null });

describe("fetchAll", () => {
  it("junta várias páginas de 1.000", async () => {
    const r = await fetchAll(source(2500));
    expect(r.data).toHaveLength(2500);
    expect(r.truncated).toBe(false);
  });
  it("para na primeira página curta", async () => {
    let calls = 0;
    const r = await fetchAll(async (a, b) => { calls++; return source(300)(a, b); });
    expect(r.data).toHaveLength(300);
    expect(calls).toBe(1);
  });
  it("marca como cortado ao chegar no máximo", async () => {
    const r = await fetchAll(source(5000), 3000);
    expect(r.data).toHaveLength(3000);
    expect(r.truncated).toBe(true);
  });
  it("devolve o erro e o que já tinha", async () => {
    let n = 0;
    const r = await fetchAll(async (a, b) => (++n === 2 ? { data: null, error: new Error("x") } : source(5000)(a, b)));
    expect(r.error).toBeTruthy();
    expect(r.data).toHaveLength(1000);
  });
});
