import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Config só de teste: não usa a config do app (TanStack Start, Nitro), para os testes rodarem rápido e isolados.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"], globals: false },
});
