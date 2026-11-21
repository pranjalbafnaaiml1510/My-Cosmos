import { Link, useSearchParams } from "react-router-dom";
import { DISCLAIMER, ResearchOpportunityCard } from "../components/research/ResearchOpportunityCard";
import { AsyncView, EmptyState, GlassCard } from "../components/ui/primitives";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";
import type { Opportunity, OpportunityLens, OpportunityReport } from "../types";

const LENSES: { id: OpportunityLens; label: string; blurb: string }[] = [
  { id: "underexplored", label: "Under-explored intersections", blurb: "Topic pairs that are semantically close but share fewer papers than is typical for pairs that close." },
  { id: "growing", label: "Growing intersections", blurb: "Small intersections (3+ papers) whose recent activity is rising faster than the corpus." },
];

const METHOD_NOTE: Record<OpportunityReport["method"], string> = {
  lexical: "Demo mode: closeness uses word overlap between topics' papers, so topics with similar names can look closer than they are.",
  lsa: "Closeness uses latent semantic embeddings. On templated demo abstracts, topics with similar names can look closer than they are.",
  neural: "Closeness uses neural sentence embeddings of each topic's papers.",
};

function Table({ items }: { items: Opportunity[] }) {
  return (
    <div className="glass overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">Opportunity signals</caption>
        <thead className="border-b border-lavender-100 text-xs uppercase tracking-wider text-navy-500">
          <tr>{["Intersection", "Papers", "Typical", "Recent", "Momentum", "Closeness", "Gap", "Score"].map((h, i) => <th key={h} scope="col" className={`px-3 py-3 font-semibold ${i ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id} className="border-b border-lavender-50 last:border-0 hover:bg-lavender-50/60">
              <th scope="row" className="px-3 py-2 font-medium">
                <Link to={`/topics/${o.topic_a_id}`} className="hover:text-violet-600">{o.topic_a}</Link> <span className="text-violet-500">×</span>{" "}
                <Link to={`/topics/${o.topic_b_id}`} className="hover:text-violet-600">{o.topic_b}</Link>
                {o.papers < 3 && <span className="ml-2 text-xs font-normal text-navy-500">(thin evidence)</span>}
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{o.papers}</td>
              <td className="px-3 py-2 text-right tabular-nums">~{o.expected.toFixed(1)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{o.recent}</td>
              <td className="px-3 py-2 text-right">{o.momentum}</td>
              <td className="px-3 py-2 text-right tabular-nums">{o.components.closeness}</td>
              <td className="px-3 py-2 text-right tabular-nums">{o.components.gap}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{o.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OpportunitiesPage() {
  const [params, setParams] = useSearchParams();
  const lens = (params.get("lens") as OpportunityLens) || "underexplored";
  const domain = params.get("domain") ?? "";
  const cross = params.get("cross") === "1";
  const minPapers = Number(params.get("min") ?? 1);
  const { domains } = useTaxonomy();
  const view = params.get("view") === "table" ? "table" : "cards";
  const set = (k: string, v: string | null) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p, { replace: true }); };

  const s = useAsync(() => api.getOpportunities({ lens, domain: domain || undefined, cross_domain_only: cross, min_papers: minPapers, limit: 30 }), [lens, domain, cross, minPapers]);
  const active = LENSES.find((l) => l.id === lens)!;

  return (
    <div className="container-cosmos py-10">
      <p className="eyebrow">Research opportunities</p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Where might research go next?</h1>
      <p className="mt-2 max-w-2xl text-navy-500">Signals from topic intersections in the corpus, for a human to look into.</p>

      <GlassCard className="mt-6 border-blush-200 bg-blush-100/60 p-4 text-sm text-navy-700" as="section">
        <p className="font-semibold text-navy-900">{DISCLAIMER}</p>
        <p className="mt-1">A small intersection can mean a genuine opening, but also that the combination isn't useful, is studied under other names, or falls outside this corpus. Check the papers before drawing conclusions.</p>
      </GlassCard>

      <div role="tablist" aria-label="Signal type" className="mt-8 flex flex-wrap gap-2">
        {LENSES.map((l) => (
          <button key={l.id} role="tab" type="button" aria-selected={lens === l.id} onClick={() => set("lens", l.id === "underexplored" ? null : l.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${lens === l.id ? "bg-violet-500 text-white" : "bg-white/60 text-navy-700 hover:bg-white"}`}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-navy-500">{active.blurb}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">Domain
          <select value={domain} onChange={(e) => set("domain", e.target.value || null)} className="rounded-lg border border-lavender-100 bg-white/70 px-2 py-1">
            <option value="">All domains</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        {lens === "underexplored" && (
          <label className="flex items-center gap-2">Min. papers
            <select value={minPapers} onChange={(e) => set("min", e.target.value === "1" ? null : e.target.value)} className="rounded-lg border border-lavender-100 bg-white/70 px-2 py-1">
              {[1, 2, 3, 5].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-violet-500" checked={cross} onChange={(e) => set("cross", e.target.checked ? "1" : null)} />Cross-domain only
        </label>
        <div role="group" aria-label="View" className="ml-auto inline-flex rounded-full bg-white/60 p-1">
          {(["cards", "table"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => set("view", v === "cards" ? null : v)}
              className={`rounded-full px-3 py-1 capitalize ${view === v ? "bg-violet-500 text-white" : "text-navy-700"}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <AsyncView state={s} loading="Analyzing research…">
          {(r) => (
            <>
              <p className="mb-4 text-xs text-navy-500">
                {r.total_pairs} signal{r.total_pairs === 1 ? "" : "s"} found{r.total_pairs > r.items.length ? `, showing the top ${r.items.length}` : ""}. {METHOD_NOTE[r.method]}{" "}
                *Typical = the overlap a regression across all topic pairs predicts for this closeness.
              </p>
              {r.items.length === 0 ? <EmptyState title="No signals match these filters." hint="Try another domain, fewer minimum papers, or the other lens." />
                : view === "table" ? <Table items={r.items} />
                : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{r.items.map((o) => <ResearchOpportunityCard key={o.id} o={o} lens={r.lens} />)}</div>}
            </>
          )}
        </AsyncView>
      </div>
    </div>
  );
}
