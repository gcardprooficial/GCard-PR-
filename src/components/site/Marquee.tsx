import type { ReactNode } from "react";

/** Faixa que corre da direita para a esquerda, sem parar (pausa no hover; respeita reduced-motion). */
export function Marquee({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`marquee overflow-hidden ${className}`}>
      <div className="marquee-track flex w-max gap-4 px-2">
        <div className="flex shrink-0 gap-4">{children}</div>
        <div className="flex shrink-0 gap-4" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Celular com uma amostra do painel do cliente (/ativar). */
export function PhoneMockup() {
  const rows = [
    ["GCARD-00394", "Barbearia do Zé", true],
    ["GCARD-00395", "Studio Bella", true],
    ["GCARD-00396", "Aguardando ativação", false],
  ] as const;
  return (
    <div className="mx-auto w-[260px] rounded-[2.4rem] border-[6px] border-white/15 bg-background p-3 shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-foreground/15" />
      <p className="text-xs text-muted-foreground">Olá 👋</p>
      <p className="font-display text-base font-black leading-tight">Seu painel de placas</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          ["Placas", "48"],
          ["Ativadas", "31"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-muted p-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground">{k}</p>
            <p className="font-display text-xl font-black">{v}</p>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map(([code, name, on]) => (
          <li key={code} className="flex items-center justify-between rounded-xl border border-border bg-card px-2.5 py-2">
            <span>
              <span className="block text-[10px] font-bold text-muted-foreground">{code}</span>
              <span className="block text-xs font-bold">{name}</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${on ? "bg-g-green/15 text-g-green" : "bg-primary/25"}`}>
              {on ? "Ativa" : "Ativar"}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl bg-primary py-2.5 text-center text-xs font-black text-primary-foreground">+ Ativar placa</div>
    </div>
  );
}
