/** Horário de funcionamento e regra de produção: um lugar só, usado no site, nos e-mails e no assistente. */
export const BUSINESS_HOURS = "segunda a sexta, das 9h às 17h";

export const PRODUCTION_SHORT = `Produção e envio: ${BUSINESS_HOURS}. Não trabalhamos aos sábados, domingos e feriados.`;

export const PRODUCTION_LONG =
  `Atenção: a produção e o despacho acontecem apenas de ${BUSINESS_HOURS}. ` +
  `Não trabalhamos aos sábados, domingos e feriados. ` +
  `Pedidos feitos ou pagos no fim de semana entram na fila na segunda-feira, ` +
  `e o código de rastreio só é enviado depois do despacho, em dia útil.`;

// ---- Dias úteis (calendário de Brasília) -------------------------------------------------

const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC ao meio-dia. */
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** Feriados nacionais + Carnaval e Corpus Christi (a produção para). ponytail: sem feriado municipal de Indaiatuba -- some em EXTRA_HOLIDAYS. */
const EXTRA_HOLIDAYS: string[] = [];
function holidays(year: number) {
  const p = easter(year);
  const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `${year}-${md}`);
  const moving = [-48, -47, -2, 60].map((n) => ymd(addDays(p, n))); // Carnaval (seg/ter), Sexta Santa, Corpus Christi
  return new Set([...fixed, ...moving, ...EXTRA_HOLIDAYS.filter((h) => h.startsWith(String(year)))]);
}

/** Data (ano-mês-dia) de hoje em Brasília. */
function brazilToday(now: Date) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function isBusinessDay(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays(d.getUTCFullYear()).has(dateStr);
}

/** Hoje (Brasília) é sábado, domingo ou feriado? Se sim, devolve o próximo dia útil para o aviso. */
export function nonBusinessDayNotice(now: Date = new Date()): { nextBusinessDay: string } | null {
  const today = brazilToday(now);
  if (isBusinessDay(today)) return null;
  let d = new Date(`${today}T12:00:00Z`);
  do d = addDays(d, 1);
  while (!isBusinessDay(ymd(d)));
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return { nextBusinessDay: `${weekday} (${date})` };
}
