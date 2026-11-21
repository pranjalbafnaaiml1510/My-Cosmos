import { useState } from "react";

export const SERIES_COLORS = ["#7a68b8", "#5d86b8", "#c9708f", "#3f9c7a", "#b98a2e", "#8a7f9e"];

export interface Series { id: string; label: string; values: number[] }

/**
 * Multi-series line chart over years. Hovering a year shows every series' value; a visually hidden
 * table carries the same numbers for screen readers.
 */
export function LineChart({ years, series, format = (v) => String(v), label }: {
  years: number[]; series: Series[]; format?: (v: number) => string; label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 280, L = 44, R = 16, T = 16, B = 28;
  const max = Math.max(1e-9, ...series.flatMap((s) => s.values));
  const x = (i: number) => L + (i / Math.max(1, years.length - 1)) * (W - L - R);
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const ticks = [0, max / 2, max];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#ece6fb" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="fill-navy-500 text-[10px] tabular-nums">{format(t)}</text>
          </g>
        ))}
        {years.map((yr, i) => (
          <g key={yr}>
            {(i % 2 === 0 || years.length <= 8) && <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-navy-500 text-[10px] tabular-nums">{yr}</text>}
            <rect x={x(i) - (W - L - R) / years.length / 2} y={T} width={(W - L - R) / years.length} height={H - B - T} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#bfaeea" strokeDasharray="3 3" />}
        {series.map((s, si) => (
          <g key={s.id}>
            <path d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} fill="none"
              stroke={SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r={4} fill="white" stroke={SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth={2} />}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex min-h-[1.5rem] flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
        {hover !== null && <span className="font-semibold tabular-nums text-navy-900">{years[hover]}</span>}
        {series.map((s, si) => (
          <span key={s.id} className="flex items-center gap-1.5 text-navy-700">
            <span className="h-0.5 w-4 rounded" style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }} />
            {s.label}{hover !== null && <span className="tabular-nums text-navy-500">{format(s.values[hover])}</span>}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th scope="col">Year</th>{series.map((s) => <th key={s.id} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{years.map((yr, i) => <tr key={yr}><th scope="row">{yr}</th>{series.map((s) => <td key={s.id}>{format(s.values[i])}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}
