import { useState } from "react";
import type { FacetKey, Facets, PaperQuery } from "../../types";

const FACETS: { key: FacetKey; label: string }[] = [
  { key: "topic", label: "Topic" },
  { key: "country", label: "Country" },
  { key: "mission", label: "Mission" },
  { key: "technology", label: "Technology" },
  { key: "method", label: "Research method" },
  { key: "organization", label: "Organization" },
];

function FacetGroup({ label, options, selected, onChange }: {
  label: string; options: { value: string; count: number }[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(selected.length > 0);
  const [find, setFind] = useState("");
  const shown = options.filter((o) => o.value.toLowerCase().includes(find.toLowerCase()));
  return (
    <fieldset className="min-w-0 border-b border-lavender-100 py-3 last:border-0">
      <legend className="w-full">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="flex w-full items-center justify-between text-sm font-semibold text-navy-700">
          <span>{label}{selected.length > 0 && <span className="ml-1.5 rounded-full bg-lavender-100 px-1.5 text-xs text-violet-600">{selected.length}</span>}</span>
          <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </button>
      </legend>
      {open && (
        <div className="mt-2">
          {options.length > 8 && (
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={`Find ${label.toLowerCase()}…`} aria-label={`Filter ${label} options`}
              className="mb-2 w-full rounded-lg border border-lavender-100 bg-white/70 px-2 py-1 text-xs focus:border-lavender-300 focus:outline-none" />
          )}
          <ul className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
            {shown.map((o) => {
              const on = selected.includes(o.value);
              return (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-lavender-50">
                    <input type="checkbox" checked={on} className="accent-violet-500"
                      onChange={() => onChange(on ? selected.filter((s) => s !== o.value) : [...selected, o.value])} />
                    <span className="flex-1 truncate text-navy-700">{o.value}</span>
                    <span className="tabular-nums text-xs text-navy-500">{o.count}</span>
                  </label>
                </li>
              );
            })}
            {!shown.length && <li className="px-1 text-xs text-navy-500">No options match.</li>}
          </ul>
        </div>
      )}
    </fieldset>
  );
}

export function FilterPanel({ facets, query, onChange }: { facets: Facets; query: PaperQuery; onChange: (patch: Partial<PaperQuery>) => void }) {
  const [y0, y1] = facets.years;
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
  const active = FACETS.some((f) => (query[f.key] as string[] | undefined)?.length) || query.year_from || query.year_to;
  return (
    <aside aria-label="Filters" className="glass p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-navy-700">Filters</h2>
        {active && (
          <button type="button" className="text-xs font-medium text-violet-600 hover:underline"
            onClick={() => onChange({ year_from: undefined, year_to: undefined, ...Object.fromEntries(FACETS.map((f) => [f.key, []])) })}>
            Clear all
          </button>
        )}
      </div>
      <fieldset className="min-w-0 border-b border-lavender-100 py-3">
        <legend className="text-sm font-semibold text-navy-700">Year</legend>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <select aria-label="From year" value={query.year_from ?? ""} onChange={(e) => onChange({ year_from: e.target.value ? +e.target.value : undefined })}
            className="flex-1 rounded-lg border border-lavender-100 bg-white/70 px-2 py-1">
            <option value="">{y0}</option>{years.map((y) => <option key={y}>{y}</option>)}
          </select>
          <span className="text-navy-500">–</span>
          <select aria-label="To year" value={query.year_to ?? ""} onChange={(e) => onChange({ year_to: e.target.value ? +e.target.value : undefined })}
            className="flex-1 rounded-lg border border-lavender-100 bg-white/70 px-2 py-1">
            <option value="">{y1}</option>{years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
      </fieldset>
      {FACETS.map((f) => (
        <FacetGroup key={f.key} label={f.label} options={facets[f.key]}
          selected={(query[f.key] as string[] | undefined) ?? []} onChange={(v) => onChange({ [f.key]: v })} />
      ))}
    </aside>
  );
}
