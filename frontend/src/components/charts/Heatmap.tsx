import { Link } from "react-router-dom";
import type { SeriesRow } from "../../types";

/**
 * Rows × years activity grid, rendered as a real table so it reads correctly without sight.
 * `normalize="row"` shades each row against its own peak (shows *when* a row was active);
 * `"global"` shades against the overall peak (shows *how much*).
 */
export function Heatmap({ rows, years, hrefFor, normalize = "row", caption }: {
  rows: SeriesRow[]; years: number[]; hrefFor?: (r: SeriesRow) => string; normalize?: "row" | "global"; caption: string;
}) {
  const globalMax = Math.max(1, ...rows.flatMap((r) => r.yearly.map((y) => y.count)));
  return (
    <div className="glass overflow-x-auto p-4">
      <table className="w-full min-w-[640px] border-separate border-spacing-[3px] text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-40 text-left font-semibold text-navy-500"><span className="sr-only">Name</span></th>
            {years.map((y) => <th key={y} scope="col" className="font-normal tabular-nums text-navy-500">{String(y).slice(2)}<span className="sr-only">{y}</span></th>)}
            <th scope="col" className="pl-2 text-right font-semibold text-navy-500">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const max = normalize === "row" ? Math.max(1, ...r.yearly.map((y) => y.count)) : globalMax;
            return (
              <tr key={r.id}>
                <th scope="row" className="truncate pr-2 text-left font-medium text-navy-900">
                  {hrefFor ? <Link to={hrefFor(r)} className="hover:text-violet-600">{r.label}</Link> : r.label}
                </th>
                {r.yearly.map((y) => {
                  const k = y.count / max;
                  return (
                    <td key={y.year} title={`${r.label}, ${y.year}: ${y.count} papers`}
                      className="h-7 rounded-md text-center tabular-nums"
                      style={{ background: `rgba(122, 104, 184, ${0.06 + 0.8 * k})`, color: k > 0.55 ? "white" : "#4a5378" }}>
                      {y.count}
                    </td>
                  );
                })}
                <td className="pl-2 text-right font-semibold tabular-nums text-navy-700">{r.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
