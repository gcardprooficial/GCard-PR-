// GCard Plus: relatório mensal e alerta de destino fora do ar (lógica pura, testável).

const SP = "America/Sao_Paulo";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: SP }); // YYYY-MM-DD

/** Dia 1 (em São Paulo): hora de mandar o relatório do mês anterior. Devolve o período ou null. */
export function reportPeriod(now: Date): { period: string; from: string; to: string } | null {
  const today = ymd(now);
  if (today.slice(8) !== "01") return null;
  const prevLast = new Date(`${today}T12:00:00-03:00`);
  prevLast.setUTCDate(prevLast.getUTCDate() - 1);
  const last = ymd(prevLast);
  return { period: last.slice(0, 7), from: `${last.slice(0, 7)}-01`, to: last };
}

/** Semana (segunda a domingo) em que o alerta de destino fora do ar já foi dado: 1 alerta por código por semana. */
export function weekKey(now: Date): string {
  const d = new Date(`${ymd(now)}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Fora do ar = erro de rede/tempo esgotado ou 404/410/5xx. 401/403/429 (site que barra robô) NÃO é fora do ar. */
export function isDown(result: { status?: number; error?: boolean }): boolean {
  if (result.error) return true;
  const s = result.status ?? 0;
  return s === 404 || s === 410 || s >= 500;
}

export type DailyRow = { plate_id: string; nfc: number; qr: number; leituras: number };

/** Soma por código; códigos sem leitura entram com zero. */
export function sumByPlate(rows: DailyRow[], plateIds: string[]) {
  const m = new Map(plateIds.map((id) => [id, { nfc: 0, qr: 0, total: 0 }]));
  for (const r of rows) {
    const c = m.get(r.plate_id);
    if (!c) continue;
    c.nfc += Number(r.nfc);
    c.qr += Number(r.qr);
    c.total += Number(r.leituras);
  }
  return m;
}
