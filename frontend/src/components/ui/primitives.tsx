import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCountUp } from "../../hooks/useAsync";
import type { AsyncState } from "../../hooks/useAsync";
import { CosmicLoader } from "../cosmic/OrbitalDecoration";

export function GlassCard({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "article" | "section" }) {
  return <Tag className={`glass ${className}`}>{children}</Tag>;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-semibold text-navy-900 sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-navy-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const v = useCountUp(value);
  return (
    <GlassCard className="px-5 py-4">
      <p className="font-display text-3xl font-semibold text-navy-900 tabular-nums">{v.toLocaleString()}{suffix}</p>
      <p className="mt-1 text-sm text-navy-500">{label}</p>
    </GlassCard>
  );
}

const CHIP_TONES = {
  topic: "bg-lavender-100 text-violet-600 hover:bg-lavender-200",
  entity: "bg-dusty-100 text-navy-700 hover:bg-dusty-200",
  method: "bg-mint-100 text-navy-700 hover:bg-mint-200",
  signal: "bg-blush-100 text-navy-700 hover:bg-blush-200",
} as const;

export function Chip({ children, tone = "topic", to }: { children: ReactNode; tone?: keyof typeof CHIP_TONES; to?: string }) {
  const cls = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${CHIP_TONES[tone]}`;
  return to ? <Link to={to} className={cls}>{children}</Link> : <span className={cls}>{children}</span>;
}

export function RelevanceBadge({ overall, semantic, keyword, topic, entity, lexical = false }: {
  overall: number; semantic: number; keyword?: number; topic: number; entity: number; lexical?: boolean;
}) {
  const rows: [string, number][] = [
    [lexical ? "Term overlap" : "Semantic match", semantic],
    ...(keyword != null ? [["Keyword match", keyword] as [string, number]] : []),
    ["Topic match", topic],
    ["Entity match", entity],
  ];
  return (
    <div className="w-full shrink-0 rounded-xl bg-lavender-50 p-3 text-xs sm:w-56">
      <p className="font-semibold text-violet-600">RELEVANCE {overall}%</p>
      <dl className="mt-2 space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <dt className="w-24 text-navy-500">{k}</dt>
            <dd className="flex flex-1 items-center gap-1.5">
              <span className="block h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-lavender-400" style={{ width: `${v}%` }} /></span>
              <span className="w-6 text-right tabular-nums text-navy-700">{v}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <span aria-hidden className="mb-3 text-3xl">🔭</span>
      <p className="font-medium text-navy-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-navy-500">{hint}</p>}
    </div>
  );
}

/** Renders loading / error / ready states consistently across the app. */
export function AsyncView<T>({ state, loading, children }: { state: AsyncState<T>; loading?: string; children: (data: T) => ReactNode }) {
  if (state.status === "loading") return <CosmicLoader label={loading} />;
  if (state.status === "error") return <EmptyState title="Couldn't reach the research universe." hint={state.error.message} />;
  return <>{children(state.data)}</>;
}
