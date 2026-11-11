import { afterEach, describe, expect, it } from "vitest";
import { isShellV2On } from "./features";

// Chave da casca nova: desligada por padrão, liga para todos ou só para uma lista de e-mails.

const antes = {
  all: process.env["FEATURE_SHELL_V2"],
  list: process.env["FEATURE_SHELL_V2_EMAILS"],
};
function set(all?: string, list?: string) {
  if (all === undefined) delete process.env["FEATURE_SHELL_V2"];
  else process.env["FEATURE_SHELL_V2"] = all;
  if (list === undefined) delete process.env["FEATURE_SHELL_V2_EMAILS"];
  else process.env["FEATURE_SHELL_V2_EMAILS"] = list;
}
afterEach(() => set(antes.all, antes.list));

describe("isShellV2On", () => {
  it("sem nenhuma variável, ninguém vê a casca nova", () => {
    set();
    expect(isShellV2On("ana@exemplo.com")).toBe(false);
    expect(isShellV2On(null)).toBe(false);
  });
  it("FEATURE_SHELL_V2=true liga para todos, até sem e-mail", () => {
    set("true");
    expect(isShellV2On("ana@exemplo.com")).toBe(true);
    expect(isShellV2On(undefined)).toBe(true);
  });
  it("só o valor exato 'true' liga", () => {
    for (const v of ["1", "TRUE", "sim", "false", ""]) {
      set(v);
      expect(isShellV2On("ana@exemplo.com"), v).toBe(false);
    }
  });
  it("a lista liga só quem está nela, sem diferenciar maiúsculas nem espaços", () => {
    set(undefined, " Ana@Exemplo.com , bia@exemplo.com ");
    expect(isShellV2On("ana@exemplo.com")).toBe(true);
    expect(isShellV2On("  BIA@exemplo.com ")).toBe(true);
    expect(isShellV2On("carla@exemplo.com")).toBe(false);
  });
  it("lista vazia ou sem e-mail não liga ninguém", () => {
    set(undefined, "");
    expect(isShellV2On("ana@exemplo.com")).toBe(false);
    set(undefined, "ana@exemplo.com");
    expect(isShellV2On(null)).toBe(false);
    expect(isShellV2On("")).toBe(false);
  });
});
