import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphKind, GraphNode } from "../../types";

export const KIND_STYLE: Record<GraphKind, { fill: string; ring: string; label: string }> = {
  root: { fill: "#7a68b8", ring: "#5f4f9c", label: "Corpus" },
  domain: { fill: "#bfaeea", ring: "#a08dd9", label: "Domain" },
  topic: { fill: "#d9cef5", ring: "#a08dd9", label: "Topic" },
  country: { fill: "#c7d6ea", ring: "#7895bf", label: "Country" },
  mission: { fill: "#f5cfdb", ring: "#eaa9be", label: "Mission" },
  technology: { fill: "#c4eadb", ring: "#94d5bc", label: "Technology" },
  method: { fill: "#e3f5ee", ring: "#94d5bc", label: "Method" },
  organization: { fill: "#e4ecf6", ring: "#9fb7d6", label: "Organization" },
};

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { weight: number };

const radius = (n: GraphNode, maxCount: number) => (n.kind === "root" ? 30 : 8 + 18 * Math.sqrt(n.paper_count / maxCount));

/**
 * Force-directed view of the nodes the user has expanded so far. Node positions persist across
 * expansions so the map grows outward instead of reshuffling.
 */
export function KnowledgeGraph({ nodes, edges, selected, expanded, onSelect }: {
  nodes: GraphNode[]; edges: GraphEdge[]; selected: string | null; expanded: Set<string>; onSelect: (id: string) => void;
}) {
  const pos = useRef(new Map<string, SimNode>());
  const [, setFrame] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const maxCount = useMemo(() => Math.max(1, ...nodes.filter((n) => n.kind !== "root").map((n) => n.paper_count)), [nodes]);

  const simNodes = useMemo(() => nodes.map((n) => {
    const prev = pos.current.get(n.id);
    const parent = edges.find((e) => e.target === n.id && pos.current.has(e.source));
    const p = parent ? pos.current.get(parent.source)! : undefined;
    const sn: SimNode = Object.assign(prev ?? { x: (p?.x ?? 0) + (Math.random() - 0.5) * 40, y: (p?.y ?? 0) + (Math.random() - 0.5) * 40 }, n);
    pos.current.set(n.id, sn);
    return sn;
  }), [nodes, edges]);

  const simLinks = useMemo<SimLink[]>(() => edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })), [edges]);

  useEffect(() => {
    const root = simNodes.find((n) => n.id === "root");
    if (root) { root.fx = 0; root.fy = 0; }
    const sim = forceSimulation(simNodes)
      .force("link", forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance((l) => ((l.source as SimNode).kind === "root" ? 150 : 95)).strength(0.5))
      .force("charge", forceManyBody().strength(-260))
      .force("collide", forceCollide<SimNode>((d) => radius(d, maxCount) + 14))
      .force("x", forceX(0).strength(0.03))
      .force("y", forceY(0).strength(0.05));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sim.stop();
      sim.tick(300);
      setFrame((f) => f + 1);
    } else {
      sim.alpha(0.9).on("tick", () => setFrame((f) => f + 1));
    }
    return () => { sim.stop(); };
  }, [simNodes, simLinks, maxCount]);

  // Fit the view to the current layout.
  const xs = simNodes.map((n) => n.x ?? 0), ys = simNodes.map((n) => n.y ?? 0);
  const pad = 90;
  const minX = Math.min(-200, ...xs) - pad, maxX = Math.max(200, ...xs) + pad;
  const minY = Math.min(-150, ...ys) - pad, maxY = Math.max(150, ...ys) + pad;

  const focus = hover ?? selected;
  const linked = new Set(focus ? edges.filter((e) => e.source === focus || e.target === focus).flatMap((e) => [e.source, e.target]) : []);
  const maxW = Math.max(1, ...edges.map((e) => e.weight));

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-full w-full select-none" role="group" aria-label="Knowledge graph. Use Tab to move between nodes and Enter to expand one.">
      <g aria-hidden>
        {simLinks.map((l) => {
          const s = l.source as SimNode, t = l.target as SimNode;
          const on = focus && (s.id === focus || t.id === focus);
          return <line key={`${s.id}>${t.id}`} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={on ? "#7a68b8" : "#bfaeea"}
            strokeOpacity={focus ? (on ? 0.85 : 0.12) : 0.45} strokeWidth={0.8 + 3 * (l.weight / maxW)} />;
        })}
      </g>
      {simNodes.map((n) => {
        const r = radius(n, maxCount), st = KIND_STYLE[n.kind];
        const dim = focus && !linked.has(n.id) && n.id !== focus;
        const isSel = n.id === selected;
        const showLabel = n.kind === "domain" || expanded.has(n.id) || n.id === focus || linked.has(n.id);
        return (
          <g key={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`} tabIndex={0} role="button"
            aria-label={`${st.label}: ${n.label}, ${n.paper_count} papers${expanded.has(n.id) ? ", expanded" : ""}`} aria-pressed={isSel}
            className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-violet-500"
            opacity={dim ? 0.3 : 1} style={{ transition: "opacity .2s" }}
            onClick={() => onSelect(n.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(n.id))}
            onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
            <circle r={r + 5} fill="none" stroke={isSel ? "#5f4f9c" : "transparent"} strokeWidth={2} strokeDasharray={expanded.has(n.id) ? undefined : "3 3"} />
            <circle r={r} fill={st.fill} stroke={st.ring} strokeWidth={1.5} />
            {n.kind === "root"
              ? <text textAnchor="middle" y={4} className="pointer-events-none fill-white text-[9px] font-semibold tracking-widest">SPACE</text>
              : showLabel && <text textAnchor="middle" y={r + 13} className="pointer-events-none fill-navy-900 text-[10px] font-medium [paint-order:stroke] [stroke:#fbf8f3] [stroke-width:3px]">
                  {n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
                </text>}
          </g>
        );
      })}
    </svg>
  );
}
