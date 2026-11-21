import type { YearCount } from "../../types";

/** Compact sparkline with an accessible text summary. */
export function ResearchTrend({ data, height = 44, className = "" }: { data: YearCount[]; height?: number; className?: string }) {
  const w = 160;
  const max = Math.max(1, ...data.map((d) => d.count));
  const pts = data.map((d, i) => [(i / Math.max(1, data.length - 1)) * w, height - (d.count / max) * (height - 6) - 3]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const first = data[0], last = data[data.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={`w-full ${className}`} role="img"
      aria-label={first && last ? `${first.count} papers in ${first.year}, ${last.count} in ${last.year}` : "No data"}>
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#bfaeea" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#bfaeea" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="#7a68b8" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
