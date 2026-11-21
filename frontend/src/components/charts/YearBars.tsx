import { useState } from "react";
import type { YearCount } from "../../types";

/** Papers-per-year bar chart with hover readout and a hidden data table for screen readers. */
export function YearBars({ data, label = "Papers per year" }: { data: YearCount[]; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 200, padL = 32, padB = 24, padT = 12;
  const max = Math.max(1, ...data.map((d) => d.count));
  const ticks = [0, Math.round(max / 2), max];
  const bw = (W - padL) / data.length;
  const y = (v: number) => H - padB - (v / max) * (H - padB - padT);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#ece6fb" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-navy-500 text-[10px] tabular-nums">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * bw + bw * 0.18, w = bw * 0.64, on = hover === i;
          return (
            <g key={d.year} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * bw} y={padT} width={bw} height={H - padB - padT} fill="transparent" />
              <rect x={x} y={y(d.count)} width={w} height={Math.max(0, H - padB - y(d.count))} rx={4}
                fill={on ? "#7a68b8" : "#bfaeea"} className="transition-colors" />
              {on && <text x={x + w / 2} y={y(d.count) - 5} textAnchor="middle" className="fill-navy-900 text-[11px] font-semibold tabular-nums">{d.count}</text>}
              {(i % 2 === 0 || data.length <= 8) && (
                <text x={x + w / 2} y={H - 8} textAnchor="middle" className="fill-navy-500 text-[10px] tabular-nums">{d.year}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Year</th><th>Papers</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.year}><td>{d.year}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
