"use client";

import { useEffect } from "react";

// Dispara 1 evento de funil quando a tela monta. Best-effort — ignora erro.
export function PlateFunnelPing({ event }: { event: string }) {
  useEffect(() => {
    let key = "";
    try {
      key = localStorage.getItem("orbita_plate_sk") ?? "";
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem("orbita_plate_sk", key);
      }
    } catch {
      /* localStorage bloqueado — segue sem session key */
    }
    fetch("/api/plate/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, sessionKey: key || undefined }),
    }).catch(() => {});
  }, [event]);

  return null;
}
