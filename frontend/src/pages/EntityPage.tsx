import { Link, useParams } from "react-router-dom";
import { YearBars } from "../components/charts/YearBars";
import { OrbitalDecoration } from "../components/cosmic/OrbitalDecoration";
import { EmergingTopicCard } from "../components/research/cards";
import { RankedList } from "../components/research/RankedList";
import { EntityPapers } from "../components/tables/EntityPapers";
import { AsyncView, EmptyState, GlassCard, SectionHeader } from "../components/ui/primitives";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";
import type { EntityKind, EntityProfile, Ranked } from "../types";

const META: Record<EntityKind, { plural: string; index: string; filterKey: "topic" | "country" | "mission" }> = {
  topic: { plural: "Topics", index: "/topics", filterKey: "topic" },
  country: { plural: "Countries", index: "/countries", filterKey: "country" },
  mission: { plural: "Missions", index: "/missions", filterKey: "mission" },
};

const papersHref = (params: Record<string, string>) => `/papers?${new URLSearchParams(params)}`;

function Hero({ p }: { p: EntityProfile }) {
  const m = META[p.kind];
  const stats: [string, string][] = [
    [p.paper_count.toLocaleString(), "papers"],
    [`${(p.share * 100).toFixed(1)}%`, "of corpus"],
    ...(p.kind !== "country" ? [[String(p.country_count), "countries"] as [string, string]] : []),
    [String(p.organization_count), "organizations"],
  ];
  return (
    <section className="relative overflow-hidden pb-10 pt-10">
      <OrbitalDecoration className="absolute -right-16 -top-10 hidden h-72 w-72 opacity-70 md:block" />
      <div className="container-cosmos relative">
        <nav aria-label="Breadcrumb" className="text-sm text-navy-500">
          <Link to={m.index} className="hover:text-violet-600">{m.plural}</Link>
          {p.kind === "topic" && p.badge && <> <span aria-hidden>/</span> <span>{p.badge}</span></>}
        </nav>
        <Link to={`/map?focus=${encodeURIComponent(`${p.kind}:${p.id}`)}`}
          className="float-right mt-2 hidden rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-violet-600 hover:bg-white sm:inline-block">
          View in Research Map →
        </Link>
        <h1 className="mt-2 text-4xl font-bold text-navy-900 sm:text-5xl">
          {p.kind === "country" && p.badge && <span aria-hidden className="mr-3 inline-grid h-12 min-w-12 place-items-center rounded-2xl bg-white/70 px-2 align-middle text-2xl shadow-glass">{p.badge}</span>}{p.name}
        </h1>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {stats.map(([v, l]) => (
            <div key={l}><dt className="sr-only">{l}</dt><dd><span className="font-display text-2xl font-semibold tabular-nums text-navy-900">{v}</span> <span className="text-navy-500">{l}</span></dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Profile({ p }: { p: EntityProfile }) {
  const key = META[p.kind].filterKey;
  const cross = (other: string) => (r: Ranked) => papersHref({ [key]: p.name, [other]: r.value });
  const lists = [
    p.kind !== "topic" && { title: "Top topics", items: p.top_topics, href: (r: Ranked) => `/topics/${r.id}`, papers: cross("topic") },
    p.kind === "topic" && { title: "Related topics", items: p.top_topics, href: (r: Ranked) => `/topics/${r.id}`, papers: cross("topic") },
    p.kind !== "country" && { title: "Top countries", items: p.top_countries, href: (r: Ranked) => `/countries/${r.id}`, papers: cross("country") },
    p.kind !== "mission" && { title: "Missions", items: p.top_missions, href: (r: Ranked) => `/missions/${r.id}`, papers: cross("mission") },
    { title: "Technologies", items: p.top_technologies, papers: cross("technology") },
    { title: "Research methods", items: p.top_methods, papers: cross("method") },
    { title: "Organizations", items: p.top_organizations, papers: cross("organization") },
  ].filter(Boolean) as { title: string; items: Ranked[]; href?: (r: Ranked) => string; papers: (r: Ranked) => string }[];

  return (
    <div className="container-cosmos space-y-16">
      <section>
        <SectionHeader eyebrow="Research activity" title="Papers over time" description="Publication counts by year within this corpus." />
        <GlassCard className="p-5"><YearBars data={p.yearly} label={`${p.name}: papers per year`} /></GlassCard>
      </section>

      {p.emerging.length > 0 && (
        <section>
          <SectionHeader eyebrow="Emerging research" title={`Growing within ${p.name}`}
            description="Topics whose last three years outpace their earlier yearly baseline in this subset. A corpus signal, not a judgement of importance." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{p.emerging.map((s) => <EmergingTopicCard key={s.topic_id} s={s} />)}</div>
        </section>
      )}

      <section>
        <SectionHeader eyebrow="Connections" title="Explore what's connected"
          description="Click a name to open its page, or “papers →” to see the papers at that intersection." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => <RankedList key={l.title} title={l.title} items={l.items} hrefFor={l.href} papersHrefFor={l.papers} />)}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Research table" title="Papers" />
        <EntityPapers filter={{ [key]: [p.name] }} explorerHref={papersHref({ [key]: p.name })} />
      </section>
    </div>
  );
}

export function EntityPage({ kind }: { kind: EntityKind }) {
  const { id = "" } = useParams();
  const s = useAsync(() => api.getProfile(kind, id), [kind, id]);
  return (
    <AsyncView state={s} loading="Analyzing research…">
      {(p) => p ? <><Hero p={p} /><Profile p={p} /></> : (
        <div className="container-cosmos py-16">
          <EmptyState title={`No ${kind} called “${id}” in this corpus.`} hint={`Browse all ${META[kind].plural.toLowerCase()} instead.`} />
          <p className="text-center"><Link to={META[kind].index} className="text-violet-600 hover:underline">View {META[kind].plural.toLowerCase()} →</Link></p>
        </div>
      )}
    </AsyncView>
  );
}
