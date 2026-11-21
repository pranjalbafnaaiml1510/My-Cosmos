import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CosmicLoader } from "../components/cosmic/OrbitalDecoration";
import { KIND_STYLE, KnowledgeGraph } from "../components/graph/KnowledgeGraph";
import { ResearchTrend } from "../components/research/ResearchTrend";
import { EmptyState, GlassCard } from "../components/ui/primitives";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";
import type { GraphEdge, GraphKind, GraphNeighborhood, GraphNode } from "../types";

const MAX_NODES = 90;
const FILTER_KINDS: GraphKind[] = ["topic", "country", "mission", "technology", "method", "organization"];

function pageHref(n: GraphNode): string | null {
  const key = n.id.slice(n.id.indexOf(":") + 1);
  switch (n.kind) {
    case "topic": return `/topics/${key}`;
    case "country": return `/countries/${key}`;
    case "mission": return `/missions/${key}`;
    case "domain": return `/topics?domain=${key}`;
    default: return null;
  }
}
const papersHref = (n: GraphNode) => (FILTER_KINDS.includes(n.kind) ? `/papers?${new URLSearchParams({ [n.kind]: n.label })}` : null);

function TopPapers({ node }: { node: GraphNode }) {
  const s = useAsync(() => (FILTER_KINDS.includes(node.kind) ? api.queryPapers({ [node.kind]: [node.label], page_size: 4 }) : Promise.resolve(null)), [node.id]);
  if (s.status !== "ready" || !s.data) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-500">Recent papers</h3>
      <ul className="mt-2 space-y-2">
        {s.data.items.map((r) => (
          <li key={r.paper.paper_id} className="text-sm leading-snug">
            <Link to={`/papers/${r.paper.paper_id}`} className="text-navy-900 hover:text-violet-600">{r.paper.title}</Link>
            <span className="ml-1 tabular-nums text-xs text-navy-500">{r.paper.publication_year}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidePanel({ hood, expandedCount, onSelect }: { hood: GraphNeighborhood | null; expandedCount: number; onSelect: (id: string) => void }) {
  if (!hood) return <GlassCard className="p-5"><CosmicLoader label="Mapping connections…" /></GlassCard>;
  const n = hood.center, st = KIND_STYLE[n.kind];
  const page = pageHref(n), papers = papersHref(n);
  return (
    <GlassCard className="flex flex-col gap-5 p-5" as="section">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy-500">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: st.fill, boxShadow: `0 0 0 1.5px ${st.ring}` }} />{st.label}
        </p>
        <h2 className="mt-1 text-xl font-semibold leading-tight">{n.label}</h2>
        <p className="mt-1 text-sm tabular-nums text-navy-500">{n.paper_count.toLocaleString()} papers</p>
      </div>
      <ResearchTrend data={hood.yearly} height={40} />
      {(page || papers) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {page && <Link to={page} className="rounded-full bg-violet-500 px-3 py-1.5 font-medium text-white hover:bg-violet-600">Open page</Link>}
          {papers && <Link to={papers} className="rounded-full bg-white/80 px-3 py-1.5 font-medium text-violet-600 hover:bg-white">View papers</Link>}
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-500">Strongest connections</h3>
        {hood.nodes.length === 0 ? <p className="mt-2 text-sm text-navy-500">No connections found.</p> : (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
            {hood.nodes.slice(0, 12).map((x) => {
              const w = hood.edges.find((e) => e.target === x.id)?.weight ?? 0;
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => onSelect(x.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-lavender-50">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_STYLE[x.kind].ring }} />
                    <span className="min-w-0 flex-1 truncate">{x.label}</span>
                    <span className="sr-only">{KIND_STYLE[x.kind].label},</span>
                    <span className="tabular-nums text-xs text-navy-500" title="Papers shared">{w}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-navy-500">Numbers are papers shared with {n.label}.</p>
      </div>
      <TopPapers node={n} />
      <p className="text-xs text-navy-500">{expandedCount} node{expandedCount === 1 ? "" : "s"} expanded · links = co-occurrence on the same paper</p>
    </GlassCard>
  );
}

export function ResearchMapPage() {
  const [params, setParams] = useSearchParams();
  const [nodes, setNodes] = useState<Map<string, GraphNode>>(new Map());
  const [edges, setEdges] = useState<Map<string, GraphEdge>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoods, setHoods] = useState<Map<string, GraphNeighborhood>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const expand = useCallback(async (id: string) => {
    setSelected(id);
    setParams(id === "root" ? {} : { focus: id }, { replace: true });
    let hood: GraphNeighborhood | null;
    try { hood = await api.getGraph(id); } catch (e) { setError((e as Error).message); return; }
    if (!hood) { setNotice(`“${id}” isn't in this corpus.`); return; }
    const h = hood;
    setHoods((m) => new Map(m).set(id, h));
    setExpanded((s) => new Set(s).add(id));
    const room = MAX_NODES - nodesRef.current.size;
    const fresh = h.nodes.filter((n) => !nodesRef.current.has(n.id));
    const add = fresh.slice(0, Math.max(0, room));
    setNotice(add.length < fresh.length ? `Showing ${add.length} of ${fresh.length} new connections to keep the map readable. Reset to explore elsewhere.` : null);
    const keep = new Set([...nodesRef.current.keys(), h.center.id, ...add.map((n) => n.id)]);
    setNodes((m) => { const next = new Map(m).set(h.center.id, h.center); add.forEach((n) => next.set(n.id, n)); return next; });
    setEdges((m) => { const next = new Map(m); h.edges.filter((e) => keep.has(e.target)).forEach((e) => next.set(`${e.source}>${e.target}`, e)); return next; });
  }, [setParams]);

  const reset = useCallback(async (focus?: string) => {
    setNodes(new Map()); nodesRef.current = new Map();
    setEdges(new Map()); setExpanded(new Set()); setNotice(null); setError(null);
    await expand("root");
    if (focus && focus !== "root") await expand(focus);
  }, [expand]);

  // Initial load (supports deep links like /map?focus=topic:computer-vision).
  useEffect(() => { void reset(params.get("focus") ?? undefined); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const select = (id: string) => (expanded.has(id) ? (setSelected(id), setParams(id === "root" ? {} : { focus: id }, { replace: true })) : void expand(id));

  return (
    <div className="container-cosmos py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Research map</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">The knowledge graph</h1>
          <p className="mt-2 max-w-2xl text-navy-500">Start from the centre and click any node to expand its strongest connections. Dashed rings mark nodes you haven't expanded yet.</p>
        </div>
        <button type="button" onClick={() => void reset()} className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-white">Reset map</button>
      </header>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-500" aria-label="Legend">
        {(Object.keys(KIND_STYLE) as GraphKind[]).filter((k) => k !== "root").map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_STYLE[k].fill, boxShadow: `0 0 0 1.5px ${KIND_STYLE[k].ring}` }} />{KIND_STYLE[k].label}
          </li>
        ))}
        <li>· Size = paper count · Line width = shared papers</li>
      </ul>

      {notice && <p role="status" className="mt-3 rounded-xl bg-blush-100 px-3 py-2 text-sm text-navy-700">{notice}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="glass relative h-[62vh] min-h-[420px] overflow-hidden">
          {error ? <EmptyState title="Couldn't reach the research universe." hint={error} />
            : nodes.size === 0 ? <CosmicLoader label="Mapping research…" />
            : <KnowledgeGraph nodes={[...nodes.values()]} edges={[...edges.values()]} selected={selected} expanded={expanded} onSelect={select} />}
        </div>
        <SidePanel hood={selected ? hoods.get(selected) ?? null : null} expandedCount={expanded.size} onSelect={select} />
      </div>
    </div>
  );
}
