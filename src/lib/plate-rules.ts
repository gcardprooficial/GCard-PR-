// Regras de destino do GCard Plus: horário, dia da semana e validade. Lógica pura (o /r e a tela usam a mesma).
// Fuso fixo de São Paulo. A primeira regra (por posição) que casa vence; sem regra que case, vale o destino normal.

export type PlateRule = {
  id: string;
  label: string | null;
  destination_url: string;
  days: number[] | null; // 0 = domingo … 6 = sábado; null/vazio = todos os dias
  start_time: string | null; // "HH:MM" ou "HH:MM:SS"
  end_time: string | null;
  valid_from: string | null; // YYYY-MM-DD (inclusive)
  valid_until: string | null; // YYYY-MM-DD (inclusive)
  enabled: boolean;
  position: number;
};

const SP = "America/Sao_Paulo";

/** Data (YYYY-MM-DD), dia da semana (0-6) e minutos desde 00:00 em São Paulo. */
export function spClock(now: Date): { date: string; weekday: number; minutes: number } {
  const date = now.toLocaleDateString("en-CA", { timeZone: SP });
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: SP, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date, weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

export function ruleMatches(r: PlateRule, now: Date): boolean {
  if (!r.enabled) return false;
  const c = spClock(now);
  if (r.valid_from && c.date < r.valid_from) return false;
  if (r.valid_until && c.date > r.valid_until) return false;
  if (r.days && r.days.length > 0 && !r.days.includes(c.weekday)) return false;
  if (r.start_time && r.end_time) {
    const s = toMinutes(r.start_time);
    const e = toMinutes(r.end_time);
    if (s === e) return true; // janela igual = o dia todo
    const inWindow = s < e ? c.minutes >= s && c.minutes < e : c.minutes >= s || c.minutes < e; // janela que vira a noite
    if (!inWindow) return false;
  }
  return true;
}

/** Destino da regra que vale agora, ou null (usa o destino normal do código). */
export function pickRuleDestination(rules: PlateRule[], now: Date = new Date()): string | null {
  const hit = [...rules].sort((a, b) => a.position - b.position).find((r) => ruleMatches(r, now));
  return hit ? hit.destination_url : null;
}

const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Resumo legível: "seg a sex · 11:00–15:00 · até 31/12". */
export function describeRule(r: PlateRule): string {
  const parts: string[] = [];
  const d = (r.days ?? []).slice().sort();
  if (d.length === 0 || d.length === 7) parts.push("todos os dias");
  else parts.push(d.map((x) => DAY_NAMES[x]).join(", "));
  if (r.start_time && r.end_time && r.start_time !== r.end_time) parts.push(`${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`);
  const br = (iso: string) => iso.split("-").reverse().join("/");
  if (r.valid_from && r.valid_until) parts.push(`de ${br(r.valid_from)} a ${br(r.valid_until)}`);
  else if (r.valid_from) parts.push(`a partir de ${br(r.valid_from)}`);
  else if (r.valid_until) parts.push(`até ${br(r.valid_until)}`);
  return parts.join(" · ");
}
