import { useState } from "react";
import { Link } from "react-router-dom";
import type { Recommendation, RecommendationKind, RecommendationSet } from "../../types";
import { EmptyState, GlassCard } from "../ui/primitives";

const TABS: { kind: RecommendationKind; label: string; blurb: string }[] = [
  { kind: "very_similar", label: "Very similar", blurb: "Semantically close papers that share most of this paper's topics." },
  { kind: "related", label: "Related", blurb: "Shared topics or entities, but a different research method." },
  { kind: "adjacent", label: "Adjacent", blurb: "Neighboring fields: topics that often co-occur with this paper's, without overlapping it." },
];

function Signals({ s, lexical }: { s: Recommendation["signals"]; lexical: boolean }) {
  const rows: [string, number][] = [[lexical ? "Text" : "Semantic", s.semantic], ["Topic", s.topic], ["Entity", s.entity], ["Time", s.temporal]];
  return (
    <dl className="grid grid-cols-4 gap-2 text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-navy-500">{k}</dt>
          <dd className="mt-0.5 h-1 overflow-hidden rounded-full bg-lavender-100"><span className="block h-full bg-lavender-400" style={{ width: `${v}%` }} /></dd>
          <dd className="sr-only">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Recommendations({ set }: { set: RecommendationSet }) {
  const [tab, setTab] = useState<RecommendationKind>("very_similar");
  const items = set[tab];
  const active = TABS.find((t) => t.kind === tab)!;
  return (
    <div>
      <div role="tablist" aria-label="Recommendation type" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.kind} role="tab" type="button" aria-selected={tab === t.kind} aria-controls="rec-panel" onClick={() => setTab(t.kind)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${tab === t.kind ? "bg-violet-500 text-white" : "bg-white/60 text-navy-700 hover:bg-white"}`}>
            {t.label} <span className="tabular-nums opacity-70">{set[t.kind].length}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-navy-500">{active.blurb}</p>
      <div id="rec-panel" role="tabpanel" className="mt-4 grid gap-4 md:grid-cols-2">
        {items.length === 0 && <div className="md:col-span-2"><EmptyState title="No strong connection found." /></div>}
        {items.map((r) => (
          <GlassCard as="article" key={r.paper.paper_id} className="flex flex-col gap-3 p-4 animate-rise">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold leading-snug">
                <Link to={`/papers/${r.paper.paper_id}`} className="hover:text-violet-600">{r.paper.title}</Link>
              </h3>
              <span className="shrink-0 rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-violet-600">{r.score}%</span>
            </div>
            <p className="text-xs text-navy-500">{r.paper.publication_year}{r.paper.country ? ` · ${r.paper.country}` : ""}</p>
            <ul className="flex flex-wrap gap-1.5 text-xs">
              {r.reasons.map((x) => <li key={x} className="rounded-full bg-white/80 px-2 py-0.5 text-navy-700">{x}</li>)}
            </ul>
            <Signals s={r.signals} lexical={set.method === "lexical"} />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
