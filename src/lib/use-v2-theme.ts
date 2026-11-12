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

/** Modo claro/escuro do site público (landing, produtos, carrinho). Mesma escolha guardada que o painel usa. */
export function useSiteTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try { if (localStorage.getItem("gcard-theme") === "dark") setTheme("dark"); } catch { /* sem armazenamento */ }
  }, []);
  // Cada página tem o seu contêiner .v2: o atributo vai em todos, a cada renderização.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".v2").forEach((el) => { if (el.dataset["theme"] !== theme) el.dataset["theme"] = theme; });
  });
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { localStorage.setItem("gcard-theme", next); } catch { /* sem armazenamento */ }
  };
  return { theme, toggle };
}
