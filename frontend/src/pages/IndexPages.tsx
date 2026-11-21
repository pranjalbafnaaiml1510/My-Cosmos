import { Link, useSearchParams } from "react-router-dom";
import { CountryTable } from "../components/research/CountryTable";
import { ResearchTrend } from "../components/research/ResearchTrend";
import { AsyncView, Chip, GlassCard } from "../components/ui/primitives";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { slug } from "../lib/slug";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";

function PageHead({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-navy-500">{description}</p>
    </header>
  );
}

export function TopicsIndexPage() {
  const [params, setParams] = useSearchParams();
  const domain = params.get("domain");
  const s = useAsync(() => Promise.all([api.getDomains(), api.getTopics()]), []);
  const { domainIcon } = useTaxonomy();
  return (
    <div className="container-cosmos py-10">
      <PageHead eyebrow="Topics" title="Research topics" description="Every topic in the taxonomy, grouped by domain. A paper can belong to several topics." />
      <AsyncView state={s} loading="Mapping topics…">
        {([domains, topics]) => (
          <>
            <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by domain">
              {[{ id: "", name: "All domains" }, ...domains].map((d) => {
                const on = (domain ?? "") === d.id;
                return (
                  <button key={d.id} type="button" aria-pressed={on} onClick={() => setParams(d.id ? { domain: d.id } : {}, { replace: true })}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${on ? "bg-violet-500 text-white" : "bg-white/60 text-navy-700 hover:bg-white"}`}>
                    {d.name}
                  </button>
                );
              })}
            </div>
            <div className="space-y-12">
              {domains.filter((d) => !domain || d.id === domain).map((d) => (
                <section key={d.id} aria-labelledby={`dom-${d.id}`}>
                  <h2 id={`dom-${d.id}`} className="mb-4 flex items-baseline gap-3 text-xl font-semibold">
                    <span aria-hidden>{domainIcon(d.id)}</span>{d.name}
                    <span className="text-sm font-normal tabular-nums text-navy-500">{d.paper_count.toLocaleString()} papers</span>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {topics.filter((t) => t.domain_id === d.id).map((t) => (
                      <Link key={t.id} to={`/topics/${t.id}`} className="glass group block p-5 transition hover:-translate-y-0.5 hover:bg-white/80">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-semibold text-navy-900 group-hover:text-violet-600">{t.name}</h3>
                          <span className="text-sm tabular-nums text-navy-500">{t.paper_count}</span>
                        </div>
                        <ResearchTrend data={t.yearly} height={36} className="mt-3" />
                        <p className="mt-1 text-xs tabular-nums text-navy-500">{(t.share * 100).toFixed(1)}% of corpus</p>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </AsyncView>
    </div>
  );
}

export function CountriesIndexPage() {
  const s = useAsync(() => Promise.all([api.getCountries(), api.getStats()]), []);
  return (
    <div className="container-cosmos py-10">
      <PageHead eyebrow="Countries" title="Global research" description="Countries come from author affiliation metadata, never inferred from paper text. Open a country to drill into its topics and papers." />
      <AsyncView state={s} loading="Surveying the globe…">{([c, st]) => <CountryTable countries={c} total={st.papers} />}</AsyncView>
    </div>
  );
}

export function MissionsIndexPage() {
  const s = useAsync(() => api.getMissions(), []);
  return (
    <div className="container-cosmos py-10">
      <PageHead eyebrow="Missions" title="Missions & programs" description="Missions referenced by papers in the corpus, extracted as entities." />
      <AsyncView state={s} loading="Plotting trajectories…">
        {(ms) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ms.map((m) => (
              <GlassCard key={m.id} as="article" className="p-5 transition hover:-translate-y-0.5">
                <h2 className="text-lg font-semibold"><Link to={`/missions/${m.id}`} className="hover:text-violet-600">{m.name}</Link></h2>
                <p className="mt-1 text-sm tabular-nums text-navy-500">{m.paper_count} papers · {m.countries} countries</p>
                <div className="mt-3 flex flex-wrap gap-1">{m.top_topics.map((t) => <Chip key={t} to={`/topics/${slug(t)}`}>{t}</Chip>)}</div>
              </GlassCard>
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
