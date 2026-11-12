import { useEffect, useState } from "react";

/** Modo claro/escuro das áreas logadas (revendedor e administração). Guarda a escolha no navegador, sem quebrar se ele bloquear o armazenamento. */
export function useV2Theme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try { if (localStorage.getItem("gcard-theme") === "dark") setTheme("dark"); } catch { /* sem armazenamento */ }
  }, []);
  // Sem lista de dependências: o painel só aparece depois do login, e o atributo precisa ser posto quando ele surge.
  useEffect(() => {
    const root = document.querySelector(".v2.gpanel") as HTMLElement | null;
    if (root && root.dataset["theme"] !== theme) root.dataset["theme"] = theme;
  });
  useEffect(() => {
    try { localStorage.setItem("gcard-theme", theme); } catch { /* sem armazenamento */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) };
}
