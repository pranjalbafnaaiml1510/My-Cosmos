import { Link } from "react-router-dom";
import { OrbitalDecoration } from "../components/cosmic/OrbitalDecoration";
import { CountryTable } from "../components/research/CountryTable";
import { EmergingTopicCard, PaperCard } from "../components/research/cards";
import { TopicConstellation } from "../components/research/TopicConstellation";
import { SearchBar } from "../components/ui/SearchBar";
import { AsyncView, GlassCard, SectionHeader, StatCard } from "../components/ui/primitives";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";

const EXAMPLES = [
  "What are researchers working on in autonomous spacecraft?",
  "How is AI being used in space missions?",
  "Which countries are leading research in spacecraft propulsion?",
  "What research connects robotics and planetary exploration?",
];

function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-16 sm:pt-24">
      <OrbitalDecoration className="absolute -right-24 top-6 hidden h-[28rem] w-[28rem] opacity-80 md:block" />
      <div className="container-cosmos relative">
        <p className="eyebrow animate-rise">Space Research Intelligence</p>
        <h1 className="mt-3 max-w-3xl animate-rise text-4xl font-bold leading-[1.05] text-navy-900 sm:text-6xl">
          Explore humanity's knowledge <span className="bg-gradient-to-r from-violet-500 to-blush-300 bg-clip-text text-transparent">beyond Earth.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-navy-500">
          Research papers transformed into an interactive map of space science, spacecraft technology and discovery.
        </p>
        <div className="mt-8 max-w-2xl"><SearchBar /></div>
        <div className="mt-4 flex max-w-3xl flex-wrap gap-2" aria-label="Example questions">
          {EXAMPLES.map((q) => (
            <Link key={q} to={`/search?q=${encodeURIComponent(q)}`}
              className="rounded-full border border-lavender-200 bg-white/60 px-3 py-1.5 text-sm text-navy-700 transition hover:border-lavender-300 hover:bg-white">
              {q}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const s = useAsync(() => api.getStats(), []);
  return (
    <section className="container-cosmos" aria-labelledby="universe-h">
      <h2 id="universe-h" className="eyebrow mb-4">Research Universe</h2>
      <AsyncView state={s} loading="Counting the stars…">
        {(st) => (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard value={st.papers} label="Research papers" />
            <StatCard value={st.countries} label="Countries" />
            <StatCard value={st.topics} label="Research topics" />
            <StatCard value={st.organizations} label="Organizations" />
            <StatCard value={st.missions} label="Missions" />
          </div>
        )}
      </AsyncView>
    </section>
  );
}

function Signals() {
  const s = useAsync(() => api.getEmerging(6), []);
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Research signals" title="Emerging in this corpus"
        description="Topics whose share of papers rose in the last three years, beyond the corpus's own growth. A corpus signal, not a judgement of importance."
        action={<Link to="/trends" className="text-sm font-medium text-violet-600 hover:underline">All trends →</Link>} />
      <AsyncView state={s} loading="Analyzing research…">
        {(sig) => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sig.map((x) => <EmergingTopicCard key={x.topic_id} s={x} />)}</div>}
      </AsyncView>
    </section>
  );
}

function Constellation() {
  const s = useAsync(() => Promise.all([api.getDomains(), api.getTopics(), api.getTopicLinks(45)]), []);
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Explore the research universe" title="Topic constellation"
        description="Each star is a research topic, sized by paper count. Lines join topics that frequently appear on the same paper."
        action={<Link to="/map" className="text-sm font-medium text-violet-600 hover:underline">Open Research Map →</Link>} />
      <AsyncView state={s} loading="Mapping connections…">
        {([d, t, l]) => <TopicConstellation domains={d} topics={t} links={l} />}
      </AsyncView>
    </section>
  );
}

function Domains() {
  const s = useAsync(() => api.getDomains(), []);
  const { domainIcon } = useTaxonomy();
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Explore by domain" title="Areas of space research" />
      <AsyncView state={s}>
        {(ds) => (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {ds.map((d) => (
              <Link key={d.id} to={`/topics?domain=${d.id}`}
                className="glass group p-4 transition hover:-translate-y-0.5 hover:bg-white/80">
                <span aria-hidden className="text-2xl">{domainIcon(d.id)}</span>
                <p className="mt-2 font-semibold leading-tight text-navy-900 group-hover:text-violet-600">{d.name}</p>
                <p className="mt-1 text-xs tabular-nums text-navy-500">{d.paper_count.toLocaleString()} papers · {d.topics.length} topics</p>
              </Link>
            ))}
          </div>
        )}
      </AsyncView>
    </section>
  );
}

function Global() {
  const s = useAsync(() => Promise.all([api.getCountries(), api.getStats()]), []);
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Global research" title="Where the research comes from"
        description="Country is taken from author affiliation metadata, never inferred from paper text."
        action={<Link to="/countries" className="text-sm font-medium text-violet-600 hover:underline">All countries →</Link>} />
      <AsyncView state={s}>{([c, st]) => <CountryTable countries={c.slice(0, 8)} total={st.papers} />}</AsyncView>
    </section>
  );
}

function Recent() {
  const s = useAsync(() => api.getRecentPapers(4), []);
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Featured research" title="Recently published"
        action={<Link to="/papers" className="text-sm font-medium text-violet-600 hover:underline">Research explorer →</Link>} />
      <AsyncView state={s}>{(ps) => <div className="grid gap-4 lg:grid-cols-2">{ps.map((p) => <PaperCard key={p.paper_id} paper={p} />)}</div>}</AsyncView>
    </section>
  );
}

export function ExplorePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Signals />
      <Constellation />
      <Domains />
      <Global />
      <Recent />
      <section className="container-cosmos mt-20">
        <GlassCard className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-lavender-100/80 to-mint-100/80 p-8">
          <div>
            <p className="eyebrow">Research opportunities</p>
            <p className="mt-1 max-w-xl text-lg font-semibold text-navy-900">Find small but growing topic intersections worth a closer human look.</p>
          </div>
          <Link to="/opportunities" className="rounded-full bg-violet-500 px-5 py-2.5 font-medium text-white hover:bg-violet-600">Explore signals</Link>
        </GlassCard>
      </section>
    </>
  );
}
