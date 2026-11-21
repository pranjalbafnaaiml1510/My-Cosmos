/**
 * Mock adapter: computes every response from the synthetic demo corpus using the same
 * schema as production. Search here is lexical overlap only — the production backend
 * replaces it with embedding retrieval + reranking.
 */
import { generateCorpus, YEAR_MAX, YEAR_MIN } from "../data/mock/generateCorpus";
import { COUNTRIES, DOMAINS, slug } from "../data/mock/taxonomy";
import type { EmergingSignal, Paper, Ranked, PaperQuery, PaperRow, SearchResult, TopicLink, TopicSummary, YearCount } from "../types";
import type { DataSource } from "./dataSource";
import { buildAssistant } from "./mockAssistant";
import { buildGraph } from "./mockGraph";
import { buildOpportunities } from "./mockOpportunities";
import { buildRecommender } from "./mockRecommend";
import { buildTrends } from "./mockTrends";

const corpus = generateCorpus();
const byId = new Map(corpus.map((p) => [p.paper_id, p]));
const recommend = buildRecommender(corpus);
const years = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

const graph = buildGraph(corpus, years);
const trends = buildTrends(corpus, years);
const opportunities = buildOpportunities(corpus, years);

const yearlyFor = (papers: Paper[]): YearCount[] =>
  years.map((year) => ({ year, count: papers.filter((p) => p.publication_year === year).length }));

const papersWithTopic = (t: string) => corpus.filter((p) => p.derived.topics.includes(t));

const topicSummaries: TopicSummary[] = DOMAINS.flatMap((d) =>
  d.topics.map((name) => {
    const ps = papersWithTopic(name);
    return { id: slug(name), name, domain_id: d.id, paper_count: ps.length, share: ps.length / corpus.length, yearly: yearlyFor(ps) };
  }),
);

const rank = (values: string[], toId: (v: string) => string): Ranked[] => {
  const m = new Map<string, number>();
  values.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()].map(([value, count]) => ({ id: toId(value), value, count })).sort((a, b) => b.count - a.count);
};

const RECENT_YEARS = 3;
/** Growth signal: recent yearly rate ÷ earlier yearly rate, per topic, within a paper subset. */
function emergingWithin(ps: Paper[], minPapers = 8): EmergingSignal[] {
  // Growth of each topic's *share* within ps, so subset-wide growth doesn't count as a signal.
  const all = yearlyFor(ps);
  const subBase = all.slice(0, -RECENT_YEARS).reduce((s, y) => s + y.count, 0) / (years.length - RECENT_YEARS);
  const subGrowth = subBase ? all.slice(-RECENT_YEARS).reduce((s, y) => s + y.count, 0) / RECENT_YEARS / subBase : 1;
  return DOMAINS.flatMap((d) => d.topics).map((name) => {
    const tp = ps.filter((p) => p.derived.topics.includes(name));
    const yearly = yearlyFor(tp);
    const recent = yearly.slice(-RECENT_YEARS).reduce((s, y) => s + y.count, 0);
    const base = yearly.slice(0, -RECENT_YEARS).reduce((s, y) => s + y.count, 0);
    const baseRate = base / (years.length - RECENT_YEARS) || 0.5;
    return { topic_id: slug(name), topic: name, paper_count: tp.length, recent_count: recent, growth_ratio: recent / RECENT_YEARS / baseRate / (subGrowth || 1), yearly };
  }).filter((s) => s.paper_count >= minPapers).sort((a, b) => b.growth_ratio - a.growth_ratio);
}

/** Simulated network latency so loading states are exercised honestly (kept small). */
const respond = <T,>(v: T) => new Promise<T>((res) => setTimeout(() => res(v), 120));

const tokenize = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const STOP = new Set(["what", "are", "the", "how", "being", "used", "which", "for", "and", "with", "researchers", "working", "research", "that", "techniques", "make", "capable", "connects"]);

export const mockAdapter: DataSource = {
  getStats: () =>
    respond({
      papers: corpus.length,
      countries: new Set(corpus.map((p) => p.country)).size,
      topics: topicSummaries.length,
      organizations: new Set(corpus.flatMap((p) => p.organizations)).size,
      missions: new Set(corpus.flatMap((p) => p.derived.missions)).size,
      year_range: [YEAR_MIN, YEAR_MAX] as [number, number],
      synthetic: corpus.some((p) => p.is_synthetic),
    }),

  getTaxonomy: () => respond({
    domains: DOMAINS.map((d) => ({ ...d, topics: [...d.topics] })),
    countries: COUNTRIES.map(({ id, name, flag }) => ({ id, name, flag })),
  }),

  getDomains: () =>
    respond(DOMAINS.map((d) => ({
      id: d.id, name: d.name, topics: d.topics,
      paper_count: corpus.filter((p) => p.derived.topics.some((t) => d.topics.includes(t))).length,
    }))),

  getTopics: () => respond(topicSummaries),

  getTopicLinks: (limit = 40) => {
    const counts = new Map<string, number>();
    for (const p of corpus) {
      const [a, b] = p.derived.topics;
      if (!b) continue;
      const key = [slug(a), slug(b)].sort().join("|");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const links: TopicLink[] = [...counts.entries()]
      .map(([k, weight]) => { const [source, target] = k.split("|"); return { source, target, weight }; })
      .sort((x, y) => y.weight - x.weight)
      .slice(0, limit);
    return respond(links);
  },

  getEmerging: (limit = 6) => respond(trends().topics.filter((t) => t.status === "emerging" || t.status === "growing").slice(0, limit)
    .map((t) => ({ topic_id: t.topic_id, topic: t.topic, paper_count: t.total, recent_count: t.recent, growth_ratio: t.growth_ratio, yearly: t.yearly }))),

  getCountries: () =>
    respond(COUNTRIES.map((c) => {
      const ps = corpus.filter((p) => p.country === c.name);
      const tc = new Map<string, number>();
      ps.forEach((p) => p.derived.topics.forEach((t) => tc.set(t, (tc.get(t) ?? 0) + 1)));
      return {
        id: c.id, name: c.name, flag: c.flag, paper_count: ps.length,
        top_topics: [...tc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t),
        organizations: new Set(ps.flatMap((p) => p.organizations)).size,
      };
    }).sort((a, b) => b.paper_count - a.paper_count)),

  getRecentPapers: (limit = 6) =>
    respond([...corpus].sort((a, b) => b.publication_date.localeCompare(a.publication_date)).slice(0, limit)),

  getPaper: (id) => respond(byId.get(id) ?? null),

  search: (query, limit = 20) => {
    const q = tokenize(query).filter((w) => !STOP.has(w));
    const GENERIC = new Set(["spacecraft", "space", "systems"]);
    const interpretation = topicSummaries
      .map((t) => ({
        name: t.name,
        hits: tokenize(t.name).filter((w) => q.some((x) => w.startsWith(x.slice(0, 5)))).reduce((s, w) => s + (GENERIC.has(w) ? 0.2 : 1), 0),
      }))
      .filter((t) => t.hits >= 0.5)
      .sort((a, b) => b.hits - a.hits)
      .map((t) => t.name)
      .slice(0, 4);
    const scored: SearchResult[] = [];
    for (const p of corpus) {
      const text = new Set(tokenize(`${p.title} ${p.abstract}`));
      const kw = new Set(p.derived.keywords.flatMap(tokenize));
      const lex = q.length ? q.filter((w) => text.has(w)).length / q.length : 0;
      const topicHits = p.derived.topics.filter((t) => interpretation.includes(t));
      const entHits = q.filter((w) => kw.has(w)).length;
      if (!lex && !topicHits.length) continue;
      const semantic = Math.round(lex * 100);
      const topic = Math.round((topicHits.length / Math.max(1, interpretation.length)) * 100);
      const entity = Math.round(Math.min(1, entHits / Math.max(1, q.length)) * 100);
      scored.push({
        paper: p,
        relevance: {
          overall: Math.round(0.5 * semantic + 0.3 * topic + 0.2 * entity),
          semantic, topic, entity,
          matched_concepts: [...topicHits, ...p.derived.keywords.filter((k) => q.some((w) => k.includes(w)))].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4),
        },
      });
    }
    scored.sort((a, b) => b.relevance.overall - a.relevance.overall);
    return respond({ query, interpretation, total: scored.length, retrieval: "lexical" as const, results: scored.slice(0, limit) });
  },

  queryPapers: (q) => {
    const terms = tokenize(q.q ?? "");
    const fieldOf: Record<string, (p: Paper) => string[]> = {
      country: (p) => (p.country ? [p.country] : []),
      topic: (p) => p.derived.topics,
      mission: (p) => p.derived.missions,
      organization: (p) => p.organizations,
      technology: (p) => p.derived.technologies,
      method: (p) => p.derived.methods,
    };
    let rows: PaperRow[] = [];
    for (const p of corpus) {
      if (q.year_from && p.publication_year < q.year_from) continue;
      if (q.year_to && p.publication_year > q.year_to) continue;
      const ok = Object.entries(fieldOf).every(([k, fn]) => {
        const want = q[k as keyof PaperQuery] as string[] | undefined;
        return !want?.length || fn(p).some((v) => want.includes(v));
      });
      if (!ok) continue;
      let relevance: number | null = null;
      if (terms.length) {
        const text = new Set(tokenize(`${p.title} ${p.abstract} ${p.derived.keywords.join(" ")}`));
        const hits = terms.filter((t) => text.has(t)).length;
        if (!hits) continue;
        relevance = Math.round((hits / terms.length) * 100);
      }
      rows.push({ paper: p, relevance });
    }
    const sort = q.sort ?? (terms.length ? "relevance" : "publication_year");
    const dir = (q.order ?? (sort === "title" || sort === "country" ? "asc" : "desc")) === "asc" ? 1 : -1;
    const key = (r: PaperRow): string | number =>
      sort === "relevance" ? r.relevance ?? 0 : sort === "title" ? r.paper.title : sort === "country" ? r.paper.country ?? "" : r.paper.publication_date;
    rows = rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    const page = Math.max(1, q.page ?? 1), size = q.page_size ?? 25;
    return respond({ items: rows.slice((page - 1) * size, page * size), total: rows.length, page, page_size: size });
  },

  ask: (req) => askMock(req),

  getOpportunities: (q) => respond(opportunities(q)),

  getTrends: (recentYears) => respond(trends(recentYears)),

  getGraph: (id) => respond(graph(id)),

  getRecommendations: (id) => respond(recommend(id)),

  getMissions: () => {
    const names = [...new Set(corpus.flatMap((p) => p.derived.missions))];
    return respond(names.map((name) => {
      const ps = corpus.filter((p) => p.derived.missions.includes(name));
      return {
        id: slug(name), name, paper_count: ps.length,
        countries: new Set(ps.map((p) => p.country)).size,
        top_topics: rank(ps.flatMap((p) => p.derived.topics), slug).slice(0, 3).map((r) => r.value),
      };
    }).sort((a, b) => b.paper_count - a.paper_count));
  },

  getProfile: (kind, id) => {
    let name: string | undefined, badge: string | null = null, ps: Paper[] = [];
    if (kind === "topic") {
      const t = topicSummaries.find((x) => x.id === id);
      if (t) { name = t.name; badge = DOMAINS.find((d) => d.id === t.domain_id)?.name ?? null; ps = papersWithTopic(t.name); }
    } else if (kind === "country") {
      const c = COUNTRIES.find((x) => x.id === id);
      if (c) { name = c.name; badge = c.flag; ps = corpus.filter((p) => p.country === c.name); }
    } else {
      name = [...new Set(corpus.flatMap((p) => p.derived.missions))].find((m) => slug(m) === id);
      if (name) ps = corpus.filter((p) => p.derived.missions.includes(name!));
    }
    if (!name) return respond(null);
    const countryId = (n: string) => COUNTRIES.find((c) => c.name === n)?.id ?? slug(n);
    const topTopics = rank(ps.flatMap((p) => p.derived.topics), slug).filter((r) => kind !== "topic" || r.value !== name);
    return respond({
      kind, id, name, badge,
      paper_count: ps.length,
      share: ps.length / corpus.length,
      country_count: new Set(ps.map((p) => p.country)).size,
      organization_count: new Set(ps.flatMap((p) => p.organizations)).size,
      yearly: yearlyFor(ps),
      top_topics: topTopics.slice(0, 8),
      top_countries: rank(ps.flatMap((p) => (p.country ? [p.country] : [])), countryId).slice(0, 8),
      top_organizations: rank(ps.flatMap((p) => p.organizations), slug).slice(0, 6),
      top_missions: rank(ps.flatMap((p) => p.derived.missions), slug).slice(0, 6),
      top_technologies: rank(ps.flatMap((p) => p.derived.technologies), slug).slice(0, 6),
      top_methods: rank(ps.flatMap((p) => p.derived.methods), slug).slice(0, 6),
      emerging: kind === "topic" ? [] : emergingWithin(ps).slice(0, 3),
    });
  },

  getFacets: () => {
    const count = (vals: string[]) => {
      const m = new Map<string, number>();
      vals.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
      return [...m.entries()].map(([value, c]) => ({ value, count: c })).sort((a, b) => b.count - a.count);
    };
    return respond({
      country: count(corpus.flatMap((p) => (p.country ? [p.country] : []))),
      topic: count(corpus.flatMap((p) => p.derived.topics)),
      mission: count(corpus.flatMap((p) => p.derived.missions)),
      organization: count(corpus.flatMap((p) => p.organizations)),
      technology: count(corpus.flatMap((p) => p.derived.technologies)),
      method: count(corpus.flatMap((p) => p.derived.methods)),
      years: [YEAR_MIN, YEAR_MAX] as [number, number],
    });
  },
};


// Defined after the adapter because it reuses the adapter's own search.
const askMock = buildAssistant(corpus, (q, limit) => mockAdapter.search(q, limit));
