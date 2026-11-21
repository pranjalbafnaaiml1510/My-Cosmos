import { useState } from "react";
import { Link } from "react-router-dom";
import { slug } from "../../lib/slug";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services";
import type { Opportunity, OpportunityLens } from "../../types";
import { Chip, GlassCard } from "../ui/primitives";
import { ResearchTrend } from "./ResearchTrend";

export const DISCLAIMER = "This is a corpus-derived discovery signal, not a validated research gap.";

const MOMENTUM: Record<Opportunity["momentum"], string> = {
  new: "New in the recent window",
  increasing: "Increasing recent activity",
  steady: "Steady activity",
  decreasing: "Decreasing activity",
  none: "Too few papers to judge a trend",
};

/** One plain-language sentence built only from the numbers on the card. */
export function explain(o: Opportunity, lens: OpportunityLens) {
  const one = o.papers === 1;
  const n = `${o.papers} paper${one ? "" : "s"} ${one ? "combines" : "combine"}`;
  if (lens === "growing") {
    return `${n} these topics, ${o.recent} of them in the last 3 years. Activity at this intersection is rising faster than the corpus overall, while it stays relatively small.`;
  }
  return `These topics are semantically close, yet only ${n} them, fewer than the ~${o.expected.toFixed(1)} typical for topic pairs this close. This intersection appears relatively small within the current corpus and may be worth further human investigation.`;
}

function Bar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div title={hint}>
      <div className="flex justify-between text-[11px] text-navy-500"><span>{label}</span><span className="tabular-nums">{value}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-lavender-100"><div className="h-full rounded-full bg-lavender-400" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function SamplePapers({ ids }: { ids: string[] }) {
  const s = useAsync(() => Promise.all(ids.map((id) => api.getPaper(id))), [ids.join()]);
  if (s.status !== "ready") return <p className="text-xs text-navy-500">Loading papers…</p>;
  return (
    <ul className="space-y-1.5">
      {s.data.filter((p) => p).map((p) => (
        <li key={p!.paper_id} className="text-sm leading-snug">
          <Link to={`/papers/${p!.paper_id}`} className="text-navy-900 hover:text-violet-600">{p!.title}</Link>
          <span className="ml-1 text-xs tabular-nums text-navy-500">{p!.publication_year}</span>
        </li>
      ))}
    </ul>
  );
}

export function ResearchOpportunityCard({ o, lens }: { o: Opportunity; lens: OpportunityLens }) {
  const [open, setOpen] = useState(false);
  const thin = o.papers < 3;
  return (
    <GlassCard as="article" className="flex flex-col gap-4 p-5 animate-rise">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-tight">
          <Link to={`/topics/${o.topic_a_id}`} className="hover:text-violet-600">{o.topic_a}</Link>
          <span aria-label="combined with" className="mx-1.5 text-violet-500">×</span>
          <Link to={`/topics/${o.topic_b_id}`} className="hover:text-violet-600">{o.topic_b}</Link>
        </h3>
        <span className="shrink-0 rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-violet-600" title="Signal score (0–100)">{o.score}</span>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/60 p-2"><dt className="text-[11px] text-navy-500">Papers</dt><dd className="font-display text-xl font-semibold tabular-nums">{o.papers}</dd></div>
        <div className="rounded-xl bg-white/60 p-2"><dt className="text-[11px] text-navy-500">Typical*</dt><dd className="font-display text-xl font-semibold tabular-nums">~{o.expected.toFixed(1)}</dd></div>
        <div className="rounded-xl bg-white/60 p-2"><dt className="text-[11px] text-navy-500">Last 3 yrs</dt><dd className="font-display text-xl font-semibold tabular-nums">{o.recent}</dd></div>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        <Chip tone="signal">{MOMENTUM[o.momentum]}</Chip>
        {o.cross_domain && <Chip tone="entity">Cross-domain</Chip>}
        {thin && <Chip tone="entity">Thin evidence</Chip>}
      </div>

      <p className="text-sm leading-relaxed text-navy-700">{explain(o, lens)}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Bar label="Closeness" value={o.components.closeness} hint="How semantically close the two topics are outside their overlap" />
        <Bar label="Gap" value={o.components.gap} hint="How far the overlap falls below what's typical for topics this close" />
        <Bar label="Momentum" value={o.components.momentum} hint="Recent growth of the overlap vs. the corpus, weighted by evidence" />
        <Bar label="Foundation" value={o.components.foundation} hint="How established the smaller parent topic is" />
      </div>

      {o.connected_topics.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">Connected topics</p>
          <div className="mt-1.5 flex flex-wrap gap-1">{o.connected_topics.map((t) => <Chip key={t} to={`/topics/${slug(t)}`}>{t}</Chip>)}</div>
        </div>
      )}

      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="self-start text-sm font-medium text-violet-600 hover:underline">
        {open ? "Hide details" : "Show papers & context"}
      </button>
      {open && (
        <div className="space-y-4 border-t border-lavender-100 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">Overlap papers per year</p>
            <ResearchTrend data={o.yearly} height={36} />
          </div>
          {(o.shared_technologies.length > 0 || o.shared_methods.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {o.shared_technologies.map((t) => <Chip key={t} tone="entity">{t}</Chip>)}
              {o.shared_methods.map((m) => <Chip key={m} tone="method">{m}</Chip>)}
            </div>
          )}
          {o.sample_paper_ids.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-navy-500">Most recent papers combining both</p>
              <SamplePapers ids={o.sample_paper_ids} />
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to={`/search?q=${encodeURIComponent(`${o.topic_a} ${o.topic_b}`)}`} className="rounded-full bg-white/80 px-3 py-1 text-violet-600 hover:bg-white">Search both</Link>
            <Link to={`/map?focus=${encodeURIComponent(`topic:${o.topic_a_id}`)}`} className="rounded-full bg-white/80 px-3 py-1 text-violet-600 hover:bg-white">Open in map</Link>
          </div>
        </div>
      )}
      <p className="mt-auto text-xs italic text-navy-500">{DISCLAIMER}</p>
    </GlassCard>
  );
}
