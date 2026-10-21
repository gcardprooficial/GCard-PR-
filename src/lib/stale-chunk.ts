// Aba aberta antes de uma publicação pede um arquivo (assets/painel-XXXX.js) que já não existe: "Failed to fetch dynamically imported module".
// A cura é recarregar a página uma vez para pegar a versão nova. Trava: no máximo 1 recarga a cada 60 s, para nunca virar laço.

const KEY = "gcard_chunk_reload_at";
const WINDOW_MS = 60_000;

export const isChunkError = (message: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message);

/** Pode recarregar agora? (nunca duas vezes dentro da janela) */
export const mayReload = (lastAt: number | null, now: number) => lastAt === null || now - lastAt > WINDOW_MS;

let installed = false;
export function installStaleChunkReload() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const reloadOnce = () => {
    let last: number | null = null;
    try {
      const v = sessionStorage.getItem(KEY);
      last = v ? Number(v) : null;
    } catch {
      last = null;
    }
    if (!mayReload(last, Date.now())) return; // já recarregou há pouco: deixa a tela de erro aparecer
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* sem armazenamento: a trava fica só na janela de memória da aba */
    }
    window.location.reload();
  };
  // Evento do Vite quando o carregamento antecipado de um módulo falha.
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  // import() dinâmico que falha fora do pré-carregamento.
  window.addEventListener("unhandledrejection", (e) => {
    const m = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
    if (isChunkError(m)) {
      e.preventDefault();
      reloadOnce();
    }
  });
}
