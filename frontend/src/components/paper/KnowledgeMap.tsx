import { useNavigate } from "react-router-dom";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { slug } from "../../lib/slug";
import type { Paper } from "../../types";

type Node = { label: string; kind: "topic" | "method" | "technology" | "mission" | "country" | "organization"; href?: string };

const STYLE: Record<Node["kind"], { fill: string; label: string }> = {
  topic: { fill: "#d9cef5", label: "Topic" },
  method: { fill: "#c4eadb", label: "Method" },
  technology: { fill: "#c7d6ea", label: "Technology" },
  mission: { fill: "#f5cfdb", label: "Mission" },
  country: { fill: "#ece6fb", label: "Country" },
  organization: { fill: "#e4ecf6", label: "Organization" },
};

/** Radial map: the paper at the centre, each extracted entity on an orbit, linked to its page where one exists. */
export function KnowledgeMap({ paper }: { paper: Paper }) {
  const nav = useNavigate();
  const d = paper.derived;
  const countryId = useTaxonomy().countryId(paper.country);
  const nodes: Node[] = [
    ...d.topics.map((t) => ({ label: t, kind: "topic" as const, href: `/topics/${slug(t)}` })),
    ...d.methods.map((m) => ({ label: m, kind: "method" as const, href: `/papers?method=${encodeURIComponent(m)}` })),
    ...d.technologies.map((t) => ({ label: t, kind: "technology" as const, href: `/papers?technology=${encodeURIComponent(t)}` })),
    ...d.missions.map((m) => ({ label: m, kind: "mission" as const, href: `/missions/${slug(m)}` })),
    ...(paper.country ? [{ label: paper.country, kind: "country" as const, href: countryId ? `/countries/${countryId}` : undefined }] : []),
    ...paper.organizations.map((o) => ({ label: o, kind: "organization" as const, href: `/papers?organization=${encodeURIComponent(o)}` })),
  ];
  const W = 640, H = 340, cx = W / 2, cy = H / 2, rx = 230, ry = 120;

  return (
    <figure className="glass p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label="Entities connected to this paper">
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#d9cef5" strokeDasharray="3 6" />
        {nodes.map((n, i) => {
          const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
          const go = () => n.href && nav(n.href);
          return (
            <g key={`${n.kind}-${n.label}`}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#bfaeea" strokeOpacity={0.5} />
              <g tabIndex={n.href ? 0 : undefined} role={n.href ? "link" : undefined} aria-label={`${STYLE[n.kind].label}: ${n.label}`}
                className={n.href ? "cursor-pointer outline-none [&:focus>rect]:stroke-violet-500 [&:hover>rect]:stroke-violet-500" : ""}
                onClick={go} onKeyDown={(e) => e.key === "Enter" && go()}>
                <rect x={x - 70} y={y - 17} width={140} height={34} rx={17} fill={STYLE[n.kind].fill} stroke="white" strokeWidth={2} />
                <text x={x} y={y - 3} textAnchor="middle" className="fill-navy-500 text-[8px] font-semibold uppercase tracking-wider">{STYLE[n.kind].label}</text>
                <text x={x} y={y + 9} textAnchor="middle" className="fill-navy-900 text-[10px] font-medium">{n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label}</text>
              </g>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={30} fill="#7a68b8" />
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-white text-[10px] font-semibold tracking-widest">PAPER</text>
      </svg>
      <figcaption className="sr-only">Click an entity to explore it.</figcaption>
    </figure>
  );
}
