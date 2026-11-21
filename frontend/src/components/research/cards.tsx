import { Link } from "react-router-dom";
import { slug } from "../../lib/slug";
import type { EmergingSignal, Paper, RelevanceBreakdown } from "../../types";
import { Chip, GlassCard, RelevanceBadge } from "../ui/primitives";
import { ResearchTrend } from "./ResearchTrend";

export function EmergingTopicCard({ s }: { s: EmergingSignal }) {
  return (
    <GlassCard as="article" className="group p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-navy-900">
          <Link to={`/topics/${s.topic_id}`} className="hover:text-violet-600">{s.topic}</Link>
        </h3>
        <Chip tone="signal">×{s.growth_ratio.toFixed(1)} share growth</Chip>
      </div>
      <ResearchTrend data={s.yearly} className="mt-3" />
      <p className="mt-2 text-sm text-navy-500">
        <span className="tabular-nums font-medium text-navy-700">{s.recent_count}</span> papers in the last 3 years ·{" "}
        <span className="tabular-nums">{s.paper_count}</span> total
      </p>
      <p className="mt-1 text-xs text-navy-500/80">Rapidly growing in this corpus</p>
    </GlassCard>
  );
}

export function PaperCard({ paper, relevance, lexical }: { paper: Paper; relevance?: RelevanceBreakdown; lexical?: boolean }) {
  const venue = paper.journal ?? paper.conference;
  return (
    <GlassCard as="article" className="flex flex-col gap-4 p-5 sm:flex-row animate-rise">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-snug text-navy-900">
          <Link to={`/papers/${paper.paper_id}`} className="hover:text-violet-600">{paper.title}</Link>
        </h3>
        <p className="mt-1 text-xs text-navy-500">
          {paper.authors.join(", ")} · {paper.publication_year}{venue ? ` · ${venue}` : ""}{paper.country ? ` · ${paper.country}` : ""}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-navy-700">{paper.abstract}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.derived.topics.map((t) => <Chip key={t} to={`/topics/${slug(t)}`}>{t}</Chip>)}
          {paper.derived.methods.map((m) => <Chip key={m} tone="method">{m}</Chip>)}
        </div>
        {relevance && relevance.matched_concepts.length > 0 && (
          <p className="mt-2 text-xs text-navy-500">Why matched: {relevance.matched_concepts.join(" · ")}</p>
        )}
      </div>
      {relevance && <RelevanceBadge {...relevance} lexical={lexical} />}
    </GlassCard>
  );
}
