// Bip de confirmação do bipador, sem arquivo de áudio (só WebAudio). Um contexto só, reaproveitado a cada bip.
// Celulares (principalmente iPhone) só liberam som depois de um toque na tela: chame unlockAudio() no primeiro toque.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Libera o áudio (chamar dentro de um toque ou clique). Devolve true se o som já está liberado. */
export function unlockAudio(): boolean {
  try {
    const c = getCtx();
    if (!c) return false;
    if (c.state === "suspended") void c.resume();
    return c.state === "running";
  } catch {
    return false;
  }
}

/** true se o som já está liberado (sem tentar liberar). */
export function audioReady(): boolean {
  return ctx?.state === "running";
}

/** ok: bip agudo curto (placa lida). erro: dois bips graves (não entrou: lote completo, repetida ou não é placa). */
export function beep(kind: "ok" | "erro" = "ok"): void {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    const tone = (freq: number, start: number, len: number, vol: number) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = kind === "ok" ? "sine" : "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, c.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + len);
      osc.connect(gain).connect(c.destination);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + len + 0.02);
    };
    if (kind === "ok") tone(1000, 0, 0.14, 0.35);
    else {
      tone(280, 0, 0.16, 0.25);
      tone(220, 0.2, 0.22, 0.25);
    }
  } catch {
    // sem áudio (bloqueado pelo navegador etc.): não atrapalha a leitura
  }
}
