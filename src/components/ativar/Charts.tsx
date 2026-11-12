// Gráficos em SVG puro (sem biblioteca): área suave e rosca. Cores vêm das variáveis do tema.

/** Área com linha suave, grade com valores e datas nas pontas. `values` na ordem dos dias. */
export function AreaChart({ values, labels, height = 160 }: { values: number[]; labels?: [string, string]; height?: number }) {
  const w = 640;
  const h = height;
  const left = 30;
  const right = 8;
  const top = 10;
  const bottom = 6;
  const max = Math.max(1, ...values);
  // topo "redondo" para a grade ficar com números limpos
  const nice = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const n = values.length;
  const x = (i: number) => (n <= 1 ? (left + w - right) / 2 : left + (i * (w - left - right)) / (n - 1));
  const y = (v: number) => top + (1 - v / nice) * (h - top - bottom);
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  const line = pts.reduce((d, [px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [p0x, p0y] = pts[i - 2] ?? pts[i - 1]!;
    const [p1x, p1y] = pts[i - 1]!;
    const [p3x, p3y] = pts[i + 1] ?? [px, py];
    const c1x = p1x + (px - p0x) / 6, c1y = p1y + (py - p0y) / 6;
    const c2x = px - (p3x - p1x) / 6, c2y = py - (p3y - p1y) / 6;
    return `${d} C${c1x},${c1y} ${c2x},${c2y} ${px},${py}`;
  }, "");
  const base = h - bottom;
  const area = pts.length ? `${line} L${pts[pts.length - 1]![0]},${base} L${pts[0]![0]},${base} Z` : "";
  const last = pts[pts.length - 1];
  const grid = [0, 0.5, 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Gráfico de leituras por dia">
        <defs>
          <linearGradient id="plusArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {grid.map((g) => (
          <g key={g}>
            <line x1={left} x2={w - right} y1={y(nice * g)} y2={y(nice * g)} stroke="currentColor" strokeOpacity={g === 0 ? 0.18 : 0.08} strokeDasharray={g === 0 ? undefined : "3 4"} />
            <text x={left - 6} y={y(nice * g) + 3.5} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.55">{Math.round(nice * g)}</text>
          </g>
        ))}
        {area && <path d={area} fill="url(#plusArea)" />}
        {line && <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {last && n > 1 && (
          <g>
            <circle cx={last[0]} cy={last[1]} r="6" fill="var(--primary)" opacity="0.25" />
            <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--primary)" stroke="var(--card)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {labels && (
        <div className="flex justify-between text-[11px] text-muted-foreground" style={{ paddingLeft: 30 }}>
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Rosca de 3 fatias (NFC, QR, sem origem). */
export function Donut({ parts, size = 132 }: { parts: { value: number; color: string; label: string }[]; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 44;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="16" />
      {total > 0 &&
        parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={p.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 60 60)"
            />
          );
          acc += len;
          return el;
        })}
      <text x="60" y="58" textAnchor="middle" className="fill-current font-display text-[20px] font-black">{total}</text>
      <text x="60" y="73" textAnchor="middle" className="fill-current text-[8px] opacity-60">leituras</text>
    </svg>
  );
}
