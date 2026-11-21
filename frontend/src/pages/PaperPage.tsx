import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { PaperAsk } from "../components/assistant/PaperAsk";
import { KnowledgeMap } from "../components/paper/KnowledgeMap";
import { Recommendations } from "../components/paper/Recommendations";
import { AsyncView, Chip, EmptyState, GlassCard, SectionHeader } from "../components/ui/primitives";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { slug } from "../lib/slug";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";
import type { Paper } from "../types";

const RESEARCH_TYPE: Record<Paper["research_type"], string> = {
  "journal-article": "Journal article", "conference-paper": "Conference paper", preprint: "Preprint", review: "Review",
};

/** First sentences of the abstract. Extractive, so it can't claim anything the paper doesn't. */
function extractiveSummary(abstract: string, sentences = 2) {
  return (abstract.match(/[^.!?]+[.!?]+/g) ?? [abstract]).slice(0, sentences).join(" ").trim();
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-navy-500 sm:pt-0.5">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">{children}</dd>
    </div>
  );
}

function Header({ p }: { p: Paper }) {
  const venue = p.journal ?? p.conference;
  const countryId = useTaxonomy().countryId(p.country);
  const doiHref = p.doi ? `https://doi.org/${p.doi}` : null;
  return (
    <header className="pt-10">
      <nav aria-label="Breadcrumb" className="text-sm text-navy-500"><Link to="/papers" className="hover:text-violet-600">Papers</Link></nav>
      {p.is_synthetic && (
        <p role="note" className="mt-3 inline-block rounded-xl bg-blush-100 px-3 py-1.5 text-sm text-navy-700">
          Synthetic demo record: not a real paper. It will be replaced when the production corpus is connected.
        </p>
      )}
      <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight sm:text-4xl">{p.title}</h1>
      <p className="mt-3 text-navy-700">{p.authors.join(", ")}</p>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-500">
        <div><dt className="sr-only">Published</dt><dd className="tabular-nums">{p.publication_date}</dd></div>
        {venue && <div><dt className="sr-only">Venue</dt><dd>{venue}</dd></div>}
        <div><dt className="sr-only">Type</dt><dd>{RESEARCH_TYPE[p.research_type]}</dd></div>
        {p.country && (
          <div><dt className="sr-only">Country</dt><dd>{countryId ? <Link to={`/countries/${countryId}`} className="hover:text-violet-600">{p.country}</Link> : p.country}</dd></div>
        )}
        {p.organizations.length > 0 && <div><dt className="sr-only">Affiliations</dt><dd>{p.organizations.join("; ")}</dd></div>}
        {p.citation_count != null && <div><dt className="sr-only">Citations</dt><dd className="tabular-nums">{p.citation_count} citations</dd></div>}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {doiHref
          ? <a href={doiHref} target="_blank" rel="noreferrer" className="rounded-full bg-violet-500 px-4 py-1.5 font-medium text-white hover:bg-violet-600">DOI: {p.doi}</a>
          : <span className="rounded-full bg-white/60 px-4 py-1.5 text-navy-500">No DOI available</span>}
        {p.open_access_url && <a href={p.open_access_url} target="_blank" rel="noreferrer" className="rounded-full bg-white/70 px-4 py-1.5 text-navy-700 hover:bg-white">Open-access PDF</a>}
        {p.source_url && <a href={p.source_url} target="_blank" rel="noreferrer" className="rounded-full bg-white/70 px-4 py-1.5 text-navy-700 hover:bg-white">Source</a>}
      </div>
    </header>
  );
}

function Understanding({ p }: { p: Paper }) {
  const d = p.derived;
  return (
    <GlassCard className="p-6">
      <p className="eyebrow">COSMOS understands this paper as</p>
      <dl className="mt-4 space-y-3">
        <Row label="Topics">{d.topics.map((t) => <Chip key={t} to={`/topics/${slug(t)}`}>{t}</Chip>)}</Row>
        {d.methods.length > 0 && <Row label="Methods">{d.methods.map((m) => <Chip key={m} tone="method" to={`/papers?method=${encodeURIComponent(m)}`}>{m}</Chip>)}</Row>}
        {d.technologies.length > 0 && <Row label="Technologies">{d.technologies.map((t) => <Chip key={t} tone="entity" to={`/papers?technology=${encodeURIComponent(t)}`}>{t}</Chip>)}</Row>}
        {d.missions.length > 0 && <Row label="Missions">{d.missions.map((m) => <Chip key={m} tone="signal" to={`/missions/${slug(m)}`}>{m}</Chip>)}</Row>}
        {d.keywords.length > 0 && <Row label="Keywords"><span className="text-sm text-navy-700">{d.keywords.join(" · ")}</span></Row>}
      </dl>
      <p className="mt-4 text-xs text-navy-500">These tags are NLP-derived and kept separate from the original metadata.</p>
    </GlassCard>
  );
}

export function PaperPage() {
  const { id = "" } = useParams();
  const paper = useAsync(() => api.getPaper(id), [id]);
  const recs = useAsync(() => api.getRecommendations(id), [id]);

  return (
    <AsyncView state={paper} loading="Analyzing research…">
      {(p) => !p ? (
        <div className="container-cosmos py-16">
          <EmptyState title="This paper isn't in the corpus." />
          <p className="text-center"><Link to="/papers" className="text-violet-600 hover:underline">Browse papers →</Link></p>
        </div>
      ) : (
        <article className="container-cosmos space-y-14">
          <Header p={p} />

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <section aria-labelledby="abstract-h">
              <h2 id="abstract-h" className="eyebrow">Abstract</h2>
              <p className="mt-3 text-lg leading-relaxed text-navy-700">{p.abstract}</p>
              <div className="mt-6 rounded-2xl border border-lavender-100 bg-white/50 p-5">
                <h3 className="text-sm font-semibold text-navy-900">In brief</h3>
                <p className="mt-2 text-navy-700">{extractiveSummary(p.abstract)}</p>
                <p className="mt-2 text-xs text-navy-500">Extractive summary: the opening sentences of the abstract, quoted without rewording.</p>
              </div>
            </section>
            <Understanding p={p} />
          </div>

          <section>
            <SectionHeader eyebrow="Connected knowledge" title="What this paper connects to" description="Click any entity to explore it across the corpus." />
            <KnowledgeMap paper={p} />
          </section>

          <section>
            <SectionHeader eyebrow="Related research" title="Where to read next"
              description="Ranked by semantic similarity together with topic, entity and publication-time overlap. Not by text similarity alone." />
            <AsyncView state={recs} loading="Connecting the knowledge…">
              {(r) => r ? <Recommendations set={r} /> : <EmptyState title="No recommendations available." />}
            </AsyncView>
          </section>

          <section>
            <PaperAsk key={p.paper_id} paperId={p.paper_id} />
          </section>
        </article>
      )}
    </AsyncView>
  );
}
