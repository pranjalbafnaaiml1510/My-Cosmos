/** In-browser port of backend/app/trends.py. Same corpus-relative growth, z-score and status rules. */
import { COUNTRIES, DOMAINS, slug } from "../data/mock/taxonomy";
import type { Paper, SeriesRow, TopicTrend, TrendReport, TrendStatus, YearCount } from "../types";

export function classify(ratio: number, z: number, recent: number): TrendStatus {
  if (ratio >= 1.5 && z >= 2 && recent >= 5) return "emerging";
  if (ratio >= 1.15 && z >= 1) return "growing";
  if (ratio <= 0.75 && z <= -1.5) return "declining";
  return "stable";
}

const slope = (xs: number[], ys: number[]) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildTrends(papers: Paper[], years: number[]) {
  const yearly = (ps: Paper[]): YearCount[] => {
    const c = new Map<number, number>();
    ps.forEach((p) => c.set(p.publication_year, (c.get(p.publication_year) ?? 0) + 1));
    return years.map((year) => ({ year, count: c.get(year) ?? 0 }));
  };
  const series = (values: (p: Paper) => string[], toId: (v: string) => string, limit: number): SeriesRow[] => {
    const groups = new Map<string, Paper[]>();
    papers.forEach((p) => values(p).forEach((v) => (groups.get(v) ?? groups.set(v, []).get(v)!).push(p)));
    return [...groups].map(([k, ps]) => ({ id: toId(k), label: k, yearly: yearly(ps), total: ps.length }))
      .sort((a, b) => b.total - a.total).slice(0, limit);
  };

  return (recentYears = 3): TrendReport => {
    const R = Math.max(1, Math.min(recentYears, years.length - 2));
    const nBase = years.length - R;
    const totals = yearly(papers);
    const cBase = totals.slice(0, nBase).reduce((s, y) => s + y.count, 0);
    const cRecent = totals.slice(nBase).reduce((s, y) => s + y.count, 0);
    const corpusGrowth = cBase ? (cRecent / R) / (cBase / nBase) : 1;

    const topics: TopicTrend[] = DOMAINS.flatMap((d) => d.topics.map((name) => {
      const ys = yearly(papers.filter((p) => p.derived.topics.includes(name)));
      const counts = ys.map((y) => y.count);
      const base = counts.slice(0, nBase).reduce((a, b) => a + b, 0), recent = counts.slice(nBase).reduce((a, b) => a + b, 0);
      const baseRate = base / nBase;
      const expected = baseRate * R * corpusGrowth;
      const raw = baseRate ? (recent / R) / baseRate : recent ? Infinity : 1;
      const ratio = raw / corpusGrowth;
      const z = (recent - expected) / Math.sqrt(Math.max(expected, 1));
      return {
        topic_id: slug(name), topic: name, domain_id: d.id, yearly: ys, total: base + recent, recent,
        baseline_rate: r2(baseRate), recent_rate: r2(recent / R), growth_ratio: r2(Math.min(ratio, 99)),
        slope: r2(slope(years, counts)), z: r2(z), status: classify(ratio, z, recent),
      };
    })).sort((a, b) => b.z - a.z);

    const countryId = (n: string) => COUNTRIES.find((c) => c.name === n)?.id ?? slug(n);
    return {
      years, recent_years: R, corpus_growth: r2(corpusGrowth), totals, topics,
      countries: series((p) => (p.country ? [p.country] : []), countryId, 12),
      technologies: series((p) => p.derived.technologies, slug, 12),
      methods: series((p) => p.derived.methods, slug, 12),
    };
  };
}
