/**
 * In-browser port of backend/app/opportunities.py. Same components, regression, weights and lenses.
 * Closeness uses bag-of-words centroids instead of embeddings (reported as method "lexical").
 */
import { DOMAINS, slug } from "../data/mock/taxonomy";
import type { Opportunity, OpportunityQuery, OpportunityReport, Paper } from "../types";

const MIN_PARENT = 20, MIN_MOMENTUM_PAPERS = 3, FULL_EVIDENCE_PAPERS = 8, RECENT_YEARS = 3;
const W = { closeness: 0.4, gap: 0.35, momentum: 0.15, foundation: 0.1 };

type Vec = Map<string, number>;
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);

function centroid(vecs: Vec[]): Vec | null {
  if (!vecs.length) return null;
  const c: Vec = new Map();
  vecs.forEach((v) => v.forEach((x, k) => c.set(k, (c.get(k) ?? 0) + x)));
  const n = Math.sqrt([...c.values()].reduce((s, x) => s + x * x, 0));
  if (!n) return null;
  c.forEach((x, k) => c.set(k, x / n));
  return c;
}
const dot = (a: Vec, b: Vec) => { let s = 0; a.forEach((x, k) => (s += x * (b.get(k) ?? 0))); return s; };

function polyfit(xs: number[], ys: number[]): [number, number] {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const beta = den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : 0;
  return [beta, my - beta * mx];
}
function percentile(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b), r = (p / 100) * (s.length - 1), lo = Math.floor(r);
  return s.length ? s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (r - lo) : 0;
}

export function buildOpportunities(papers: Paper[], years: number[]) {
  let cache: Opportunity[] | null = null;
  const vecs: Vec[] = papers.map((p) => {
    const v: Vec = new Map();
    tokens(`${p.title} ${p.abstract}`).forEach((t) => v.set(t, (v.get(t) ?? 0) + 1));
    return v;
  });
  const allTopics = DOMAINS.flatMap((d) => d.topics);
  const domainOf = (t: string) => DOMAINS.find((d) => d.topics.includes(t))?.id;
  const members = new Map(allTopics.map((t) => [t, new Set(papers.flatMap((p, i) => (p.derived.topics.includes(t) ? [i] : [])))]));

  const compute = (): Opportunity[] => {
    const N = papers.length, nBase = years.length - RECENT_YEARS;
    const totals = new Map<number, number>();
    papers.forEach((p) => totals.set(p.publication_year, (totals.get(p.publication_year) ?? 0) + 1));
    const cBase = years.slice(0, nBase).reduce((s, y) => s + (totals.get(y) ?? 0), 0);
    const cRecent = years.slice(nBase).reduce((s, y) => s + (totals.get(y) ?? 0), 0);
    const corpusGrowth = cBase ? (cRecent / RECENT_YEARS) / (cBase / nBase) : 1;
    const topics = allTopics.filter((t) => members.get(t)!.size >= MIN_PARENT);
    const biggest = Math.max(1, ...topics.map((t) => members.get(t)!.size));

    const raw = [];
    for (let i = 0; i < topics.length; i++) for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i], b = topics[j], A = members.get(a)!, B = members.get(b)!;
      const both = [...A].filter((x) => B.has(x));
      const bothSet = new Set(both);
      const ca = centroid([...A].filter((x) => !bothSet.has(x)).map((x) => vecs[x]));
      const cb = centroid([...B].filter((x) => !bothSet.has(x)).map((x) => vecs[x]));
      const close = ca && cb ? dot(ca, cb) : 0;
      const indep = (A.size * B.size) / N;
      const yc = new Map<number, number>();
      both.forEach((x) => yc.set(papers[x].publication_year, (yc.get(papers[x].publication_year) ?? 0) + 1));
      const yearly = years.map((year) => ({ year, count: yc.get(year) ?? 0 }));
      const base = yearly.slice(0, nBase).reduce((s, y) => s + y.count, 0), recent = yearly.slice(nBase).reduce((s, y) => s + y.count, 0);
      let momLabel: Opportunity["momentum"], mom: number;
      if (both.length < MIN_MOMENTUM_PAPERS) { momLabel = "none"; mom = 0; }
      else if (base === 0) { momLabel = "new"; mom = 1; }
      else {
        const ratio = ((recent / RECENT_YEARS) / (base / nBase)) / corpusGrowth;
        momLabel = ratio >= 1.25 ? "increasing" : ratio <= 0.8 ? "decreasing" : "steady";
        mom = Math.min(1, Math.max(0, (ratio - 0.5) / 1.5));
      }
      mom *= Math.min(1, both.length / FULL_EVIDENCE_PAPERS);
      raw.push({ a, b, both, close, indep, yearly, recent, momLabel, mom, found: Math.min(A.size, B.size) / biggest });
    }

    const closes = raw.map((r) => r.close), lo = Math.min(...closes), hi = Math.max(...closes);
    const ys = raw.map((r) => Math.log((r.both.length + 0.5) / r.indep));
    const [beta, alpha] = polyfit(closes, ys);
    const fitted = closes.map((c) => alpha + beta * c);
    const mean = ys.reduce((s, y, k) => s + (y - fitted[k]), 0) / ys.length;
    const sd = Math.sqrt(ys.reduce((s, y, k) => s + (y - fitted[k] - mean) ** 2, 0) / ys.length) || 1;

    return raw.map((r, k) => {
      const comp = {
        closeness: hi > lo ? (r.close - lo) / (hi - lo) : 0,
        gap: Math.min(1, Math.max(0, -(ys[k] - fitted[k]) / (2 * sd))),
        momentum: r.mom,
        foundation: r.found,
      };
      const A = members.get(r.a)!, B = members.get(r.b)!;
      const topShared = (values: (p: Paper) => string[], n: number) => {
        const count = (S: Set<number>) => { const m = new Map<string, number>(); S.forEach((x) => values(papers[x]).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1))); return m; };
        const ma = count(A), mb = count(B);
        return [...ma.keys()].filter((v) => mb.has(v)).map((v) => [v, Math.min(ma.get(v)!, mb.get(v)!)] as const)
          .sort((x, y) => y[1] - x[1]).slice(0, n).map(([v]) => v);
      };
      const pct = (v: number) => Math.round(v * 100);
      return {
        id: `${slug(r.a)}|${slug(r.b)}`, topic_a: r.a, topic_a_id: slug(r.a), topic_b: r.b, topic_b_id: slug(r.b),
        cross_domain: domainOf(r.a) !== domainOf(r.b),
        papers: r.both.length, expected: Math.round(Math.max(0, Math.exp(fitted[k]) * r.indep - 0.5) * 10) / 10,
        recent: r.recent, momentum: r.momLabel,
        score: Math.round(100 * (W.closeness * comp.closeness + W.gap * comp.gap + W.momentum * comp.momentum + W.foundation * comp.foundation)),
        components: { closeness: pct(comp.closeness), gap: pct(comp.gap), momentum: pct(comp.momentum), foundation: pct(comp.foundation) },
        connected_topics: topShared((p) => p.derived.topics.filter((t) => t !== r.a && t !== r.b), 4),
        shared_technologies: topShared((p) => p.derived.technologies, 3),
        shared_methods: topShared((p) => p.derived.methods, 3),
        yearly: r.yearly,
        sample_paper_ids: [...r.both].sort((x, y) => papers[y].publication_date.localeCompare(papers[x].publication_date)).slice(0, 5).map((x) => papers[x].paper_id),
      };
    }).sort((x, y) => y.score - x.score);
  };

  return (q: OpportunityQuery): OpportunityReport => {
    const all = (cache ??= compute());
    const lens = q.lens ?? "underexplored";
    let items = all.filter((o) => o.papers >= (q.min_papers ?? 1) && (!q.cross_domain_only || o.cross_domain));
    if (q.domain) {
      const names = new Set(DOMAINS.find((d) => d.id === q.domain)?.topics ?? []);
      items = items.filter((o) => names.has(o.topic_a) || names.has(o.topic_b));
    }
    if (lens === "growing") {
      const cap = percentile(all.filter((o) => o.papers >= MIN_MOMENTUM_PAPERS).map((o) => o.papers), 75);
      items = items.filter((o) => o.papers >= MIN_MOMENTUM_PAPERS && (o.momentum === "increasing" || o.momentum === "new") && o.papers <= cap)
        .sort((x, y) => y.components.momentum - x.components.momentum || y.score - x.score);
    } else {
      items = items.filter((o) => o.components.gap > 0);
    }
    return { method: "lexical", lens, recent_years: RECENT_YEARS, total_pairs: items.length, items: items.slice(0, q.limit ?? 24) };
  };
}
