/**
 * In-browser port of backend/app/recommend.py. Same groups, weights and reasons; the semantic
 * signal is token-set overlap instead of embeddings (reported as method "lexical").
 */
import type { Paper, Recommendation, RecommendationKind, RecommendationSet } from "../types";

const TEMPORAL_SPAN = 5, PER_GROUP = 6, NEIGHBORS_PER_TOPIC = 5;
const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const jaccard = (a: Set<string>, b: Set<string>) => {
  let n = 0; a.forEach((x) => b.has(x) && n++);
  const u = a.size + b.size - n;
  return u ? n / u : 0;
};
const inter = <T,>(a: Set<T>, b: Iterable<T>) => [...b].filter((x) => a.has(x));
const entitySet = (p: Paper) => new Set([...p.derived.methods, ...p.derived.technologies, ...p.derived.missions]);

export function buildRecommender(papers: Paper[]) {
  const tok = papers.map((p) => tokens(`${p.title} ${p.abstract}`));
  const pairs = new Map<string, Map<string, number>>();
  const bump = (a: string, b: string) => { const m = pairs.get(a) ?? new Map(); m.set(b, (m.get(b) ?? 0) + 1); pairs.set(a, m); };
  for (const p of papers) {
    const ts = [...new Set(p.derived.topics)];
    ts.forEach((a, i) => ts.slice(i + 1).forEach((b) => { bump(a, b); bump(b, a); }));
  }
  const neighbors = new Map([...pairs].map(([t, m]) => [t, new Set([...m].sort((x, y) => y[1] - x[1]).slice(0, NEIGHBORS_PER_TOPIC).map(([k]) => k))]));
  const index = new Map(papers.map((p, i) => [p.paper_id, i]));

  return (paperId: string): RecommendationSet | null => {
    const i = index.get(paperId);
    if (i === undefined) return null;
    const p = papers[i];
    const topics = new Set(p.derived.topics), ents = entitySet(p), methods = new Set(p.derived.methods);
    const neighborTopics = new Set([...topics].flatMap((t) => [...(neighbors.get(t) ?? [])]).filter((t) => !topics.has(t)));
    type Cand = [number, number, Recommendation["signals"]];
    const very: Cand[] = [], related: Cand[] = [], adjacent: Cand[] = [];

    papers.forEach((c, j) => {
      if (j === i) return;
      const ct = new Set(c.derived.topics), ce = entitySet(c);
      const sig = {
        semantic: jaccard(tok[i], tok[j]),
        topic: jaccard(topics, ct),
        entity: jaccard(ents, ce),
        temporal: Math.max(0, 1 - Math.abs(p.publication_year - c.publication_year) / TEMPORAL_SPAN),
      };
      const sharedT = inter(topics, ct);
      if (sharedT.length >= Math.max(1, topics.size / 2)) {
        very.push([0.6 * sig.semantic + 0.25 * sig.topic + 0.1 * sig.entity + 0.05 * sig.temporal, j, sig]);
      } else if ((sharedT.length || inter(ents, ce).length) && !inter(methods, c.derived.methods).length) {
        related.push([0.35 * sig.semantic + 0.3 * sig.topic + 0.3 * sig.entity + 0.05 * sig.temporal, j, sig]);
      } else if (!sharedT.length && inter(neighborTopics, ct).length) {
        adjacent.push([0.5 * sig.semantic + (0.3 * inter(neighborTopics, ct).length) / ct.size + 0.2 * sig.entity, j, sig]);
      }
    });

    const taken = new Set<number>();
    const top = (items: Cand[], kind: RecommendationKind) => {
      const out: Recommendation[] = [];
      for (const [score, j, sig] of items.sort((a, b) => b[0] - a[0])) {
        if (taken.has(j)) continue;
        taken.add(j);
        out.push(toRec(p, papers[j], kind, score, sig, neighborTopics));
        if (out.length === PER_GROUP) break;
      }
      return out;
    };
    return { paper_id: paperId, method: "lexical", very_similar: top(very, "very_similar"), related: top(related, "related"), adjacent: top(adjacent, "adjacent") };
  };
}

function toRec(p: Paper, c: Paper, kind: RecommendationKind, score: number, sig: Recommendation["signals"], neighborTopics: Set<string>): Recommendation {
  const sorted = (xs: string[]) => [...xs].sort();
  const reasons = sorted(inter(new Set(p.derived.topics), c.derived.topics)).map((t) => `Shares topic: ${t}`);
  if (kind === "adjacent") reasons.push(...sorted(inter(neighborTopics, c.derived.topics)).map((t) => `Neighboring field: ${t}`));
  reasons.push(...sorted(inter(new Set(p.derived.missions), c.derived.missions)).map((m) => `Same mission: ${m}`));
  reasons.push(...sorted(inter(new Set(p.derived.technologies), c.derived.technologies)).map((t) => `Also uses ${t}`));
  const same = inter(new Set(p.derived.methods), c.derived.methods);
  if (c.derived.methods.length && p.derived.methods.length && !same.length) reasons.push(`Different approach: ${sorted(c.derived.methods).join(", ")}`);
  else if (same.length) reasons.push(`Same method: ${sorted(same).join(", ")}`);
  if (Math.abs(p.publication_year - c.publication_year) <= 1) reasons.push("Published within a year");
  const pct = (v: number) => Math.round(v * 100);
  return {
    paper: c, kind, score: pct(score),
    signals: { semantic: pct(sig.semantic), topic: pct(sig.topic), entity: pct(sig.entity), temporal: pct(sig.temporal) },
    reasons: reasons.slice(0, 4),
  };
}
