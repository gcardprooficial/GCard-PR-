// Gráficos em SVG puro (sem biblioteca): área suave e rosca. Cores vêm das variáveis do tema.

/** Área com linha suave. `values` na ordem dos dias. */
export function AreaChart({ values, labels, height = 160 }: { values: number[]; labels?: [string, string]; height?: number }) {
  const w = 600;
  const h = height;
  const pad = 6;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => (n <= 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2 - 8);
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  // curva suave (Catmull-Rom → Bézier)
  const line = pts.reduce((d, [px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [p0x, p0y] = pts[i - 2] ?? pts[i - 1]!;
    const [p1x, p1y] = pts[i - 1]!;
    const [p3x, p3y] = pts[i + 1] ?? [px, py];
    const c1x = p1x + (px - p0x) / 6, c1y = p1y + (py - p0y) / 6;
    const c2x = px - (p3x - p1x) / 6, c2y = py - (p3y - p1y) / 6;
    return `${d} C${c1x},${c1y} ${c2x},${c2y} ${px},${py}`;
  }, "");
  const area = pts.length ? `${line} L${pts[pts.length - 1]![0]},${h} L${pts[0]![0]},${h} Z` : "";
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Gráfico de leituras por dia" preserveAspectRatio="none">
        <defs>
          <linearGradient id="plusArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="currentColor" strokeOpacity="0.08" />
        ))}
        {area && <path d={area} fill="url(#plusArea)" />}
        {line && <path d={line} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      </svg>
      {labels && (
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
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
