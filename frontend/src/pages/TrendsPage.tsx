import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Heatmap } from "../components/charts/Heatmap";
import { LineChart, SERIES_COLORS } from "../components/charts/LineChart";
import { YearBars } from "../components/charts/YearBars";
import { ResearchTrend } from "../components/research/ResearchTrend";
import { AsyncView, GlassCard, SectionHeader } from "../components/ui/primitives";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";
import type { TopicTrend, TrendReport, TrendStatus } from "../types";

export const STATUS: Record<TrendStatus, { label: string; cls: string }> = {
  emerging: { label: "Emerging topic signal", cls: "bg-blush-100 text-navy-900" },
  growing: { label: "Increasing activity", cls: "bg-mint-100 text-navy-900" },
  stable: { label: "Stable", cls: "bg-white/80 text-navy-500" },
  declining: { label: "Declining in this corpus", cls: "bg-dusty-100 text-navy-700" },
};

export function StatusBadge({ s }: { s: TrendStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[s].cls}`}>{STATUS[s].label}</span>;
}

function Methodology({ r }: { r: TrendReport }) {
  const last = r.years[r.years.length - 1];
  return (
    <details className="glass mt-6 p-4 text-sm text-navy-700">
      <summary className="cursor-pointer font-semibold text-navy-900">How these signals are computed</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>The <b>recent window</b> is the last {r.recent_years} years ({r.years[r.years.length - r.recent_years]}–{last}); everything earlier is the <b>baseline</b>.</li>
        <li>The whole corpus publishes ×{r.corpus_growth.toFixed(2)} as many papers per year in the window as in the baseline. Topic growth is measured <b>relative to that</b>, so a topic only shows a signal when its share of papers changes.</li>
        <li><b>Growth ×</b> = topic's recent/baseline rate ÷ corpus's. <b>z</b> = (recent papers − papers its baseline share predicts) ÷ √predicted (Poisson approximation). <b>Slope</b> = least-squares papers/year across all years.</li>
        <li>Emerging: growth ≥ 1.5×, z ≥ 2 and ≥ 5 recent papers. Increasing: ≥ 1.15× and z ≥ 1. Declining: ≤ 0.75× and z ≤ −1.5.</li>
        <li>With {r.topics.length} topics tested at once, a few signals can appear by chance. {last} may also be incomplete if the corpus was collected mid-year.</li>
        <li>These describe <b>this corpus</b> only. Growth here is not evidence that a field is scientifically more important.</li>
      </ul>
    </details>
  );
}

function SignalColumn({ title, items, empty }: { title: string; items: TopicTrend[]; empty: string }) {
  return (
    <GlassCard className="p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-navy-700">{title} <span className="tabular-nums text-navy-500">{items.length}</span></h3>
      {items.length === 0 ? <p className="mt-3 text-sm text-navy-500">{empty}</p> : (
        <ul className="mt-3 space-y-3">
          {items.slice(0, 6).map((t) => (
            <li key={t.topic_id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <Link to={`/topics/${t.topic_id}`} className="truncate font-medium hover:text-violet-600">{t.topic}</Link>
                <span className="shrink-0 tabular-nums text-navy-500">×{t.growth_ratio.toFixed(2)} · z {t.z.toFixed(1)}</span>
              </div>
              <ResearchTrend data={t.yearly} height={26} />
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

type SortKey = "topic" | "status" | "total" | "recent" | "growth_ratio" | "slope" | "z";
const STATUS_ORDER: TrendStatus[] = ["emerging", "growing", "stable", "declining"];

function TopicTable({ topics }: { topics: TopicTrend[] }) {
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "z", asc: false });
  const [filter, setFilter] = useState<TrendStatus | "all">("all");
  const rows = useMemo(() => {
    const val = (t: TopicTrend) => (sort.k === "status" ? STATUS_ORDER.indexOf(t.status) : t[sort.k]);
    return topics.filter((t) => filter === "all" || t.status === filter)
      .sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1); });
  }, [topics, sort, filter]);
  const cols: [SortKey, string, boolean][] = [["topic", "Topic", false], ["status", "Signal", false], ["total", "Papers", true], ["recent", "Recent", true], ["growth_ratio", "Growth ×", true], ["slope", "Slope /yr", true], ["z", "z", true]];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by signal">
        {(["all", ...STATUS_ORDER] as const).map((s) => (
          <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm transition ${filter === s ? "bg-violet-500 text-white" : "bg-white/60 text-navy-700 hover:bg-white"}`}>
            {s === "all" ? "All topics" : STATUS[s].label} <span className="tabular-nums opacity-70">{s === "all" ? topics.length : topics.filter((t) => t.status === s).length}</span>
          </button>
        ))}
      </div>
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Topic trend statistics. Column headers sort the table.</caption>
          <thead className="border-b border-lavender-100 text-xs uppercase tracking-wider text-navy-500">
            <tr>
              {cols.map(([k, label, num]) => (
                <th key={k} scope="col" className={`px-3 py-3 font-semibold ${num ? "text-right" : ""}`}
                  aria-sort={sort.k === k ? (sort.asc ? "ascending" : "descending") : undefined}>
                  <button type="button" className="uppercase hover:text-violet-600" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : !num }))}>
                    {label}<span aria-hidden className="ml-1 text-[10px]">{sort.k === k ? (sort.asc ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
              ))}
              <th scope="col" className="w-36 px-3 py-3 font-semibold">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.topic_id} className="border-b border-lavender-50 last:border-0 hover:bg-lavender-50/60">
                <th scope="row" className="px-3 py-2 font-medium"><Link to={`/topics/${t.topic_id}`} className="hover:text-violet-600">{t.topic}</Link></th>
                <td className="px-3 py-2"><StatusBadge s={t.status} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{t.total}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.recent}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.growth_ratio.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.slope > 0 ? "+" : ""}{t.slope.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.z.toFixed(2)}</td>
                <td className="px-3 py-1"><ResearchTrend data={t.yearly} height={24} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopicComparison({ r }: { r: TrendReport }) {
  const [picked, setPicked] = useState<string[]>(() => r.topics.filter((t) => t.status === "emerging").slice(0, 3).map((t) => t.topic_id).concat(r.topics[r.topics.length - 1].topic_id));
  const [mode, setMode] = useState<"count" | "share">("share");
  const series = picked.map((id) => {
    const t = r.topics.find((x) => x.topic_id === id)!;
    return { id, label: t.topic, values: t.yearly.map((y, i) => (mode === "count" ? y.count : y.count / Math.max(1, r.totals[i].count))) };
  });
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= SERIES_COLORS.length ? p : [...p, id]));
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Measure" className="inline-flex rounded-full bg-white/60 p-1 text-sm">
          {(["share", "count"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${mode === m ? "bg-violet-500 text-white" : "text-navy-700"}`}>
              {m === "share" ? "Share of year's papers" : "Paper count"}
            </button>
          ))}
        </div>
        <p className="text-xs text-navy-500">Pick up to {SERIES_COLORS.length} topics below.</p>
      </div>
      {series.length ? (
        <LineChart years={r.years} series={series} label={`Topic ${mode === "share" ? "share of papers" : "paper counts"} by year`}
          format={mode === "share" ? (v) => `${(v * 100).toFixed(1)}%` : (v) => String(Math.round(v))} />
      ) : <p className="py-16 text-center text-sm text-navy-500">Select a topic to plot it.</p>}
      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Topics to compare">
        {[...r.topics].sort((a, b) => a.topic.localeCompare(b.topic)).map((t) => {
          const i = picked.indexOf(t.topic_id);
          return (
            <button key={t.topic_id} type="button" aria-pressed={i >= 0} onClick={() => toggle(t.topic_id)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition ${i >= 0 ? "border-transparent text-white" : "border-lavender-200 bg-white/60 text-navy-700 hover:bg-white"}`}
              style={i >= 0 ? { background: SERIES_COLORS[i] } : undefined}>
              {t.topic}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

export function TrendsPage() {
  const [params, setParams] = useSearchParams();
  const windowYears = Number(params.get("window") ?? 3);
  const s = useAsync(() => api.getTrends(windowYears), [windowYears]);
  return (
    <div className="container-cosmos py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Research evolution</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">How the research is changing</h1>
          <p className="mt-2 max-w-2xl text-navy-500">Publication activity over time, and which topics are gaining or losing share of the corpus.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-700">
          Recent window
          <select value={windowYears} onChange={(e) => setParams({ window: e.target.value }, { replace: true })} className="rounded-lg border border-lavender-100 bg-white/70 px-2 py-1">
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>last {n} years</option>)}
          </select>
        </label>
      </header>

      <AsyncView state={s} loading="Analyzing research…">
        {(r) => {
          const by = (st: TrendStatus) => r.topics.filter((t) => t.status === st);
          return (
            <>
              <Methodology r={r} />
              <div className="mt-12 space-y-16">
                <section>
                  <SectionHeader eyebrow="Corpus" title="Papers per year" description={`${r.totals.reduce((a, b) => a + b.count, 0).toLocaleString()} papers, ${r.years[0]}–${r.years[r.years.length - 1]}.`} />
                  <GlassCard className="p-5"><YearBars data={r.totals} label="Corpus papers per year" /></GlassCard>
                </section>

                <section>
                  <SectionHeader eyebrow="Signals" title="Emerging, increasing and declining" description="Sorted by z. Click a topic to see its countries, missions and papers." />
                  <div className="grid gap-4 md:grid-cols-3">
                    <SignalColumn title="Emerging topic signals" items={by("emerging")} empty="No topic clears the emerging threshold in this window." />
                    <SignalColumn title="Increasing activity" items={by("growing")} empty="No topics in this band." />
                    <SignalColumn title="Declining in this corpus" items={[...by("declining")].reverse()} empty="No topic is losing share significantly." />
                  </div>
                </section>

                <section>
                  <SectionHeader eyebrow="Compare" title="Topic trajectories" description="Share of each year's papers is the default: it isn't distorted by how many papers the corpus has per year." />
                  <TopicComparison key={r.recent_years} r={r} />
                </section>

                <section>
                  <SectionHeader eyebrow="All topics" title="Trend statistics" />
                  <TopicTable topics={r.topics} />
                </section>

                <section>
                  <SectionHeader eyebrow="Countries" title="Country activity over time" description="Papers per year by author-affiliation country. Shading is relative to each row's own peak year." />
                  <Heatmap rows={r.countries} years={r.years} hrefFor={(c) => `/countries/${c.id}`} caption="Papers per country per year" />
                </section>

                <section>
                  <SectionHeader eyebrow="Technologies" title="Technology evolution" description="Papers per year mentioning each technology. Shading is relative to each row's own peak year." />
                  <Heatmap rows={r.technologies} years={r.years} hrefFor={(t) => `/papers?technology=${encodeURIComponent(t.label)}`} caption="Papers per technology per year" />
                </section>

                <section>
                  <SectionHeader eyebrow="Methods" title="Research methods over time" />
                  <Heatmap rows={r.methods} years={r.years} hrefFor={(m) => `/papers?method=${encodeURIComponent(m.label)}`} caption="Papers per research method per year" />
                </section>
              </div>
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
