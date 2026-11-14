import { describe, expect, it } from "vitest";
import { addScannedCode, countScanned, scanGap, scanGapLabel } from "./scan-cap";

const HEX = (n: number) => n.toString(16).padStart(32, "0");

describe("bipador: trava na quantidade do pedido", () => {
  it("aceita até a quantidade do pedido e a última vem como complete", () => {
    let text = "";
    const statuses: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const r = addScannedCode(text, `GCARD-0000${i}`, 3);
      text = r.text;
      statuses.push(r.status);
    }
    expect(statuses).toEqual(["ok", "ok", "complete"]);
    expect(countScanned(text)).toBe(3);
  });

  it("não deixa colocar a seguinte depois de completo (25 de 25, não aceita a 26)", () => {
    let text = "";
    for (let i = 1; i <= 25; i++) text = addScannedCode(text, `GCARD-${String(i).padStart(5, "0")}`, 25).text;
    expect(countScanned(text)).toBe(25);
    const r = addScannedCode(text, "GCARD-00026", 25);
    expect(r.status).toBe("over");
    expect(r.text).toBe(text);
    expect(countScanned(r.text)).toBe(25);
  });

  it("a mesma placa lida de novo não conta duas vezes (código curto ou hex)", () => {
    const a = addScannedCode("", "GCARD-00007", 5);
    expect(addScannedCode(a.text, "GCARD-00007", 5).status).toBe("dup");
    const b = addScannedCode(a.text, HEX(255), 5);
    expect(addScannedCode(b.text, HEX(255).toUpperCase(), 5).status).toBe("dup");
    expect(countScanned(b.text)).toBe(2);
  });

  it("ignora o que não é código de placa", () => {
    const r = addScannedCode("GCARD-00001", "7891234567890", 5);
    expect(r.status).toBe("invalid");
    expect(countScanned(r.text)).toBe(1);
  });

  it("aceita o link /r/<token> com o token em hex", () => {
    const r = addScannedCode("", `https://gcardpro.com.br/r/${HEX(4096)}`, 2);
    expect(r.status).toBe("ok");
    expect(countScanned(r.text)).toBe(1);
  });
});

describe("montar lote: só com a quantidade exata", () => {
  it("falta, sobra e completo", () => {
    expect(scanGap("GCARD-00001\nGCARD-00002", 25)).toBe(-23);
    expect(scanGapLabel("GCARD-00001\nGCARD-00002", 25)).toBe("Faltam 23 para montar o lote");
    expect(scanGap("GCARD-00001\nGCARD-00002", 2)).toBe(0);
    expect(scanGapLabel("GCARD-00001\nGCARD-00002", 2)).toBe("Completo: pode montar o lote");
    expect(scanGapLabel("GCARD-00001\nGCARD-00002\nGCARD-00003", 2)).toBe("Sobram 1: tire 1 código da lista");
  });
});
