import { Link } from "react-router-dom";
import type { Ranked } from "../../types";
import { GlassCard } from "../ui/primitives";

/**
 * A ranked list with proportional bars. Each item links to its own entity page (`hrefFor`)
 * and optionally to the explorer filtered to the intersection (`papersHrefFor`).
 */
export function RankedList({ title, items, hrefFor, papersHrefFor, empty = "No data in this corpus." }: {
  title: string; items: Ranked[]; hrefFor?: (r: Ranked) => string; papersHrefFor?: (r: Ranked) => string; empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <GlassCard className="p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-navy-700">{title}</h3>
      {items.length === 0 ? <p className="mt-3 text-sm text-navy-500">{empty}</p> : (
        <ol className="mt-3 space-y-2">
          {items.map((r, i) => (
            <li key={r.id} className="group">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-1.5 tabular-nums text-navy-500/70">{i + 1}.</span>
                  {hrefFor ? <Link to={hrefFor(r)} className="font-medium text-navy-900 hover:text-violet-600">{r.value}</Link> : <span className="font-medium text-navy-900">{r.value}</span>}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {papersHrefFor && (
                    <Link to={papersHrefFor(r)} className="text-xs text-violet-600 opacity-0 transition-opacity hover:underline focus:opacity-100 group-hover:opacity-100">papers →</Link>
                  )}
                  <span className="tabular-nums text-navy-500">{r.count}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-lavender-100">
                <div className="h-full rounded-full bg-gradient-to-r from-lavender-300 to-dusty-300" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}
