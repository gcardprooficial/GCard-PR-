import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export type PresetKey =
  | "hoje" | "ontem" | "7d" | "30d" | "90d" | "mes" | "mes_passado" | "trimestre" | "ano" | "ano_passado" | "tudo" | "custom" | "meses";
export type PeriodValue = { preset: PresetKey; from: string; to: string; months: string[] };

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "trimestre", label: "Este trimestre" },
  { key: "ano", label: "Este ano" },
  { key: "ano_passado", label: "Ano passado" },
  { key: "tudo", label: "Todo o período" },
];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lastDayOfMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return ymd(new Date(y, m, 0));
};
const br = (iso: string) => iso.split("-").reverse().join("/");

export const periodPreset = (preset: PresetKey): PeriodValue => ({ preset, from: "", to: "", months: [] });

/** Datas inclusivas (AAAA-MM-DD). null = sem limite daquele lado. */
export function resolvePeriod(v: PeriodValue, now: Date = new Date()): { from: string | null; to: string | null } {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = t.getFullYear();
  const m = t.getMonth();
  switch (v.preset) {
    case "hoje": return { from: ymd(t), to: ymd(t) };
    case "ontem": { const d = addDays(t, -1); return { from: ymd(d), to: ymd(d) }; }
    case "7d": return { from: ymd(addDays(t, -6)), to: ymd(t) };
    case "30d": return { from: ymd(addDays(t, -29)), to: ymd(t) };
    case "90d": return { from: ymd(addDays(t, -89)), to: ymd(t) };
    case "mes": return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case "mes_passado": return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "trimestre": { const q = Math.floor(m / 3) * 3; return { from: ymd(new Date(y, q, 1)), to: ymd(new Date(y, q + 3, 0)) }; }
    case "ano": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "ano_passado": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "meses": {
      const ms = [...v.months].sort();
      if (ms.length === 0) return { from: null, to: null };
      return { from: `${ms[0]}-01`, to: lastDayOfMonth(ms[ms.length - 1]!) };
    }
    case "custom": return { from: v.from || null, to: v.to || null };
    default: return { from: null, to: null };
  }
}

/** A data (AAAA-MM-DD) cai dentro do período? Com meses soltos, só vale se o mês dela foi marcado. */
export function inPeriod(v: PeriodValue, date: string): boolean {
  if (v.preset === "meses" && v.months.length) return v.months.includes(date.slice(0, 7));
  const { from, to } = resolvePeriod(v);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function describePeriod(v: PeriodValue): string {
  if (v.preset === "meses") {
    if (v.months.length === 0) return "Escolha os meses";
    const ms = [...v.months].sort();
    const name = (ym: string) => `${MESES[Number(ym.slice(5)) - 1]}/${ym.slice(2, 4)}`;
    return ms.length <= 3 ? ms.map(name).join(", ") : `${ms.length} meses (${name(ms[0]!)} a ${name(ms[ms.length - 1]!)})`;
  }
  if (v.preset === "custom") {
    const { from, to } = resolvePeriod(v);
    if (!from && !to) return "Datas personalizadas";
    return `${from ? br(from) : "início"} a ${to ? br(to) : "hoje"}`;
  }
  return PRESETS.find((p) => p.key === v.preset)?.label ?? "Período";
}

/** Filtro de período no estilo de ferramentas profissionais: atalhos, datas livres e vários meses juntos. */
export function PeriodFilter({ value, onChange, allowMonths = true }: { value: PeriodValue; onChange: (v: PeriodValue) => void; allowMonths?: boolean }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const { from: rf, to: rt } = resolvePeriod(value);
  const toggleMonth = (ym: string) => {
    const has = value.months.includes(ym);
    const months = has ? value.months.filter((x) => x !== ym) : [...value.months, ym];
    onChange({ preset: "meses", from: "", to: "", months });
  };
  const years = new Set(value.months.map((x) => x.slice(0, 4)));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <CalendarDays size={16} />
        <span>{describePeriod(value)}</span>
        {value.preset !== "tudo" && value.preset !== "meses" && (rf || rt) && <span className="xs muted">{rf ? br(rf) : "…"} – {rt ? br(rt) : "…"}</span>}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div role="dialog" aria-label="Escolher período" className="card" style={{ position: "absolute", zIndex: 40, top: "calc(100% + 8px)", left: 0, width: "min(560px, 92vw)", padding: 14, display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div className="col" style={{ gap: 2, flex: "1 1 170px" }}>
            <div className="xs muted" style={{ padding: "0 8px 4px" }}>Atalhos</div>
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className="nav" style={{ justifyContent: "space-between", padding: "7px 10px" }} onClick={() => { onChange(periodPreset(p.key)); setOpen(false); }}>
                <span>{p.label}</span>
                {value.preset === p.key && <Check size={15} color="var(--brand)" />}
              </button>
            ))}
          </div>
          <div className="col" style={{ gap: 14, flex: "1 1 260px" }}>
            <div className="col" style={{ gap: 8 }}>
              <div className="xs muted">Datas livres</div>
              <div className="row" style={{ gap: 8 }}>
                <label className="col grow" style={{ gap: 2 }}><span className="xs muted">De</span><input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
                <label className="col grow" style={{ gap: 2 }}><span className="xs muted">Até</span><input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
              </div>
              <button type="button" className="btn primary" disabled={!from && !to} onClick={() => { onChange({ preset: "custom", from, to, months: [] }); setOpen(false); }}>Aplicar datas</button>
            </div>
            {allowMonths && (
              <div className="col" style={{ gap: 8 }}>
                <div className="row between">
                  <div className="xs muted">Vários meses juntos</div>
                  <div className="row" style={{ gap: 4 }}>
                    <button type="button" className="btn" style={{ padding: "2px 8px" }} aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)}><ChevronLeft size={14} /></button>
                    <b className="sm" style={{ minWidth: 40, textAlign: "center" }}>{year}</b>
                    <button type="button" className="btn" style={{ padding: "2px 8px" }} aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)}><ChevronRight size={14} /></button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {MESES.map((nome, i) => {
                    const ym = `${year}-${pad(i + 1)}`;
                    const on = value.preset === "meses" && value.months.includes(ym);
                    return (
                      <button key={ym} type="button" className={`chip ${on ? "on" : ""}`} style={{ justifyContent: "center" }} aria-pressed={on} onClick={() => toggleMonth(ym)}>{nome}</button>
                    );
                  })}
                </div>
                <div className="row between">
                  <span className="xs muted">{value.preset === "meses" && value.months.length ? `${value.months.length} mês(es) marcado(s)${years.size > 1 ? ` em ${years.size} anos` : ""}` : "Marque quantos quiser"}</span>
                  {value.preset === "meses" && value.months.length > 0 && <button type="button" className="btn ghost" style={{ padding: "2px 8px" }} onClick={() => onChange(periodPreset("tudo"))}>Limpar</button>}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <button type="button" className="btn" style={{ padding: "4px 10px" }} onClick={() => onChange({ preset: "meses", from: "", to: "", months: MESES.map((_, i) => `${year}-${pad(i + 1)}`) })}>Ano todo ({year})</button>
                  <button type="button" className="btn" style={{ padding: "4px 10px" }} onClick={() => setOpen(false)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
