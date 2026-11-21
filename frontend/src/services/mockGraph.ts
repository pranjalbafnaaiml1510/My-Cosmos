/** In-browser port of backend/app/graph.py: entity co-occurrence with per-kind neighbour caps. */
import { COUNTRIES, DOMAINS, slug } from "../data/mock/taxonomy";
import type { GraphEdge, GraphKind, GraphNeighborhood, GraphNode, Paper } from "../types";

const PER_KIND = 4;

function entityIds(p: Paper): Map<string, [GraphKind, string]> {
  const out = new Map<string, [GraphKind, string]>();
  for (const t of p.derived.topics) {
    out.set(`topic:${slug(t)}`, ["topic", t]);
    const d = DOMAINS.find((x) => x.topics.includes(t));
    if (d) out.set(`domain:${d.id}`, ["domain", d.name]);
  }
  if (p.country) out.set(`country:${COUNTRIES.find((c) => c.name === p.country)?.id ?? slug(p.country)}`, ["country", p.country]);
  const lists: [GraphKind, string[]][] = [["mission", p.derived.missions], ["technology", p.derived.technologies], ["method", p.derived.methods], ["organization", p.organizations]];
  for (const [kind, values] of lists) for (const v of values) out.set(`${kind}:${slug(v)}`, [kind, v]);
  return out;
}

export function buildGraph(papers: Paper[], years: number[]) {
  const paperEntities = papers.map(entityIds);
  const meta = new Map<string, [GraphKind, string]>();
  const papersOf = new Map<string, number[]>();
  paperEntities.forEach((ents, i) => ents.forEach((m, id) => { meta.set(id, m); (papersOf.get(id) ?? papersOf.set(id, []).get(id)!).push(i); }));

  const node = (id: string): GraphNode | null => {
    if (id === "root") return { id, kind: "root", label: "Space Research", paper_count: papers.length };
    const m = meta.get(id);
    return m ? { id, kind: m[0], label: m[1], paper_count: papersOf.get(id)!.length } : null;
  };

  return (id: string): GraphNeighborhood | null => {
    const center = node(id);
    if (!center) return null;
    let nodes: GraphNode[], edges: GraphEdge[], idx: number[];
    if (id === "root") {
      nodes = DOMAINS.map((d) => node(`domain:${d.id}`)).filter((n): n is GraphNode => !!n);
      edges = nodes.map((n) => ({ source: "root", target: n.id, weight: n.paper_count }));
      idx = papers.map((_, i) => i);
    } else {
      idx = papersOf.get(id)!;
      const co = new Map<string, number>();
      idx.forEach((i) => paperEntities[i].forEach((_, x) => x !== id && co.set(x, (co.get(x) ?? 0) + 1)));
      const byKind = new Map<GraphKind, [string, number][]>();
      [...co].sort((a, b) => b[1] - a[1]).forEach(([x, n]) => {
        const k = meta.get(x)![0];
        (byKind.get(k) ?? byKind.set(k, []).get(k)!).push([x, n]);
      });
      const picked: [string, number][] = [];
      const own = center.kind === "domain"
        ? new Set(DOMAINS.find((d) => `domain:${d.id}` === id)!.topics.map((t) => `topic:${slug(t)}`)) : new Set<string>();
      byKind.forEach((items, k) => {
        if (center.kind === "domain" && k === "topic") picked.push(...items.filter(([x]) => own.has(x))); // exactly its own topics
        else if (center.kind === "domain" && k === "domain") return; // siblings already shown via the root
        else picked.push(...items.slice(0, PER_KIND));
      });
      picked.sort((a, b) => b[1] - a[1]);
      nodes = picked.map(([x]) => node(x)!);
      edges = picked.map(([x, n]) => ({ source: id, target: x, weight: n }));
    }
    const yc = new Map<number, number>();
    idx.forEach((i) => yc.set(papers[i].publication_year, (yc.get(papers[i].publication_year) ?? 0) + 1));
    return { center, nodes, edges, yearly: years.map((year) => ({ year, count: yc.get(year) ?? 0 })) };
  };
}
