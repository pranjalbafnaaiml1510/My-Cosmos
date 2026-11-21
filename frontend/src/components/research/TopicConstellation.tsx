import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Domain, TopicLink, TopicSummary } from "../../types";

const TONES = ["#bfaeea", "#9fb7d6", "#eaa9be", "#94d5bc", "#a08dd9", "#7895bf"];

/**
 * Domains sit on an outer orbit; their topics cluster around them as stars sized by paper count.
 * Co-occurrence links are drawn faintly and highlight on hover. Click a star to open the topic.
 */
export function TopicConstellation({ domains, topics, links }: { domains: Domain[]; topics: TopicSummary[]; links: TopicLink[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const nav = useNavigate();
  const W = 900, H = 560, cx = W / 2, cy = H / 2;

  const layout = useMemo(() => {
    const maxCount = Math.max(1, ...topics.map((t) => t.paper_count));
    const pos = new Map<string, { x: number; y: number; r: number; t: TopicSummary; tone: string }>();
    const dpos = domains.map((d, i) => {
      const a = (i / domains.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 300, y = cy + Math.sin(a) * 190;
      const ts = topics.filter((t) => t.domain_id === d.id);
      ts.forEach((t, j) => {
        const b = a + ((j - (ts.length - 1) / 2) * 0.55);
        pos.set(t.id, { x: x + Math.cos(b + Math.PI) * 58 * (j % 2 ? 1 : 0.7), y: y + Math.sin(b + Math.PI) * 48 * (j % 2 ? 1 : 0.7), r: 4 + (t.paper_count / maxCount) * 9, t, tone: TONES[i % TONES.length] });
      });
      return { d, x, y };
    });
    return { pos, dpos };
  }, [domains, topics, cx, cy]);

  const active = hover ? new Set([hover, ...links.filter((l) => l.source === hover || l.target === hover).flatMap((l) => [l.source, l.target])]) : null;
  const hovered = hover ? layout.pos.get(hover) : null;

  return (
    <figure className="glass relative overflow-hidden p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label="Topic constellation">
        <ellipse cx={cx} cy={cy} rx={300} ry={190} fill="none" stroke="#d9cef5" strokeDasharray="3 6" />
        <circle cx={cx} cy={cy} r={34} fill="#ece6fb" />
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-violet-600 text-[11px] font-semibold tracking-widest">SPACE RESEARCH</text>
        {links.map((l) => {
          const a = layout.pos.get(l.source), b = layout.pos.get(l.target);
          if (!a || !b) return null;
          const on = active?.has(l.source) && active?.has(l.target) && (l.source === hover || l.target === hover);
          return <line key={`${l.source}-${l.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "#7a68b8" : "#bfaeea"} strokeOpacity={on ? 0.9 : 0.25} strokeWidth={on ? 1.6 : 0.8} />;
        })}
        {layout.dpos.map(({ d, x, y }) => (
          <text key={d.id} x={x} y={y + (y < cy ? -62 : 72)} textAnchor="middle" className="fill-navy-700 text-[12px] font-semibold">{d.name}</text>
        ))}
        {[...layout.pos.entries()].map(([id, p]) => (
          <g key={id} tabIndex={0} role="link" aria-label={`${p.t.name}: ${p.t.paper_count} papers`} className="cursor-pointer outline-none"
            onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(id)} onBlur={() => setHover(null)}
            onClick={() => nav(`/topics/${id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/topics/${id}`)}>
            <circle cx={p.x} cy={p.y} r={p.r + 6} fill={p.tone} opacity={active && !active.has(id) ? 0.08 : 0.25} />
            <circle cx={p.x} cy={p.y} r={p.r} fill={p.tone} stroke="white" strokeWidth={1.5} opacity={active && !active.has(id) ? 0.3 : 1} />
          </g>
        ))}
      </svg>
      <figcaption className="pointer-events-none absolute left-4 top-4 min-h-[3rem] text-sm">
        {hovered ? (
          <span className="glass inline-block px-3 py-2">
            <span className="font-semibold text-navy-900">{hovered.t.name}</span>
            <span className="ml-2 tabular-nums text-navy-500">{hovered.t.paper_count} papers · {(hovered.t.share * 100).toFixed(1)}% of corpus</span>
          </span>
        ) : <span className="text-navy-500">Hover a star to see a topic · click to explore</span>}
      </figcaption>
    </figure>
  );
}
