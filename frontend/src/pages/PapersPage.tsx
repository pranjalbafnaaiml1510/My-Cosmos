import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterPanel } from "../components/tables/FilterPanel";
import { COLUMNS, ResearchTable, toCsv } from "../components/tables/ResearchTable";
import { AsyncView, Chip, EmptyState } from "../components/ui/primitives";
import { CosmicLoader } from "../components/cosmic/OrbitalDecoration";
import { useAsync } from "../hooks/useAsync";
import { api, DATA_MODE } from "../services";
import type { FacetKey, PaperQuery, PaperSortKey } from "../types";

const MULTI: FacetKey[] = ["country", "topic", "mission", "organization", "technology", "method"];
const PAGE_SIZES = [10, 25, 50, 100];
const COLS_KEY = "cosmos.explorer.columns";

/** URL search params are the single source of truth, so every view is linkable. */
function readQuery(p: URLSearchParams): PaperQuery {
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  const q: PaperQuery = {
    q: p.get("q") ?? undefined, year_from: num("year_from"), year_to: num("year_to"),
    sort: (p.get("sort") as PaperSortKey) ?? undefined, order: (p.get("order") as "asc" | "desc") ?? undefined,
    page: num("page") ?? 1, page_size: num("page_size") ?? 25,
  };
  MULTI.forEach((k) => { const v = p.getAll(k); if (v.length) q[k] = v; });
  return q;
}

function writeQuery(q: PaperQuery): URLSearchParams {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else if (v !== undefined && v !== "" && !(k === "page" && v === 1) && !(k === "page_size" && v === 25)) p.set(k, String(v));
  });
  return p;
}

function loadCols(): string[] {
  try { const v = JSON.parse(localStorage.getItem(COLS_KEY) ?? "null"); if (Array.isArray(v)) return v; } catch { /* storage unavailable */ }
  return COLUMNS.filter((c) => c.id !== "organization").map((c) => c.id);
}

export function PapersPage() {
  const [params, setParams] = useSearchParams();
  const query = readQuery(params);
  const key = params.toString();
  const facets = useAsync(() => api.getFacets(), []);
  const result = useAsync(() => api.queryPapers(query), [key]);
  const [visible, setVisible] = useState<string[]>(loadCols);
  const [text, setText] = useState(query.q ?? "");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { try { localStorage.setItem(COLS_KEY, JSON.stringify(visible)); } catch { /* ignore */ } }, [visible]);

  // Debounced keyword filter.
  useEffect(() => {
    if ((query.q ?? "") === text) return;
    const t = setTimeout(() => update({ q: text || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const update = (patch: Partial<PaperQuery>, resetPage = true) =>
    setParams(writeQuery({ ...query, ...patch, ...(resetPage ? { page: 1 } : {}) }), { replace: true });

  const onSort = (k: PaperSortKey) => {
    const same = query.sort === k;
    const defaultDir = k === "title" || k === "country" ? "asc" : "desc";
    update({ sort: k, order: same ? (query.order === "asc" ? "desc" : "asc") : defaultDir });
  };

  const cols = COLUMNS.filter((c) => visible.includes(c.id));
  const activeChips = MULTI.flatMap((k) => (query[k] as string[] | undefined ?? []).map((v) => ({ k, v })));

  const exportCsv = () => {
    if (result.status !== "ready") return;
    const blob = new Blob([toCsv(result.data.items, cols)], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `cosmos-papers-page${query.page}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="container-cosmos py-10">
      <p className="eyebrow">Research explorer</p>
      <h1 className="mt-1 text-3xl font-semibold">Papers</h1>
      <p className="mt-2 max-w-2xl text-navy-500">Filter, sort and inspect the corpus. Every view is linkable — the URL holds your filters.</p>
      {DATA_MODE === "mock" && <p className="mt-2 text-xs text-navy-500">Demo mode: rows are synthetic records, not real papers.</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <div className={`${showFilters ? "" : "hidden"} lg:block`}>
          <AsyncView state={facets} loading="Loading filters…">
            {(f) => <FilterPanel facets={f} query={query} onChange={(p) => update(p)} />}
          </AsyncView>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="table-search" className="sr-only">Keyword filter</label>
            <input id="table-search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by keyword…"
              className="glass h-10 min-w-[12rem] flex-1 rounded-full px-4 text-sm focus:outline-none focus:ring-4 focus:ring-lavender-200/70" />
            <button type="button" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}
              className="glass h-10 rounded-full px-4 text-sm font-medium text-navy-700 lg:hidden">Filters</button>
            <details className="relative">
              <summary className="glass flex h-10 cursor-pointer list-none items-center rounded-full px-4 text-sm font-medium text-navy-700">Columns</summary>
              <div className="glass absolute right-0 z-20 mt-2 w-48 bg-white/95 p-2">
                {COLUMNS.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-lavender-50">
                    <input type="checkbox" className="accent-violet-500" checked={visible.includes(c.id)} disabled={c.id === "paper"}
                      onChange={() => setVisible((v) => (v.includes(c.id) ? v.filter((x) => x !== c.id) : COLUMNS.map((x) => x.id).filter((id) => id === c.id || v.includes(id))))} />
                    {c.label}
                  </label>
                ))}
              </div>
            </details>
            <button type="button" onClick={exportCsv} disabled={result.status !== "ready"}
              className="h-10 rounded-full bg-violet-500 px-4 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50">
              Export CSV
            </button>
          </div>

          {activeChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Active filters">
              {activeChips.map(({ k, v }) => (
                <button key={`${k}-${v}`} type="button" onClick={() => update({ [k]: (query[k] as string[]).filter((x) => x !== v) })}
                  aria-label={`Remove filter ${v}`} className="transition hover:opacity-70">
                  <Chip tone="entity">{v} ✕</Chip>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            {result.status === "loading" && <CosmicLoader label="Filtering the research universe…" />}
            {result.status === "error" && <EmptyState title="Couldn't load papers." hint={result.error.message} />}
            {result.status === "ready" && (
              result.data.total === 0
                ? <EmptyState title="No papers match these filters." hint="Try removing a filter or widening the year range." />
                : (
                  <>
                    <p className="mb-2 text-sm tabular-nums text-navy-500" aria-live="polite">
                      Showing {(result.data.page - 1) * result.data.page_size + 1}–{Math.min(result.data.total, result.data.page * result.data.page_size)} of {result.data.total.toLocaleString()} papers
                    </p>
                    <ResearchTable rows={result.data.items} columns={cols} sort={query.sort ?? (query.q ? "relevance" : "publication_year")} order={query.order} onSort={onSort} />
                    <Pagination page={result.data.page} total={result.data.total} size={result.data.page_size}
                      onPage={(page) => { update({ page }, false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      onSize={(page_size) => update({ page_size })} />
                  </>
                )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, total, size, onPage, onSize }: { page: number; total: number; size: number; onPage: (p: number) => void; onSize: (s: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages])).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = "grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm transition";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm text-navy-500">
        Rows per page
        <select value={size} onChange={(e) => onSize(+e.target.value)} className="rounded-lg border border-lavender-100 bg-white/70 px-2 py-1">
          {PAGE_SIZES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <ul className="flex items-center gap-1">
        <li><button type="button" className={`${btn} hover:bg-white/70 disabled:opacity-40`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button></li>
        {nums.map((n, i) => (
          <li key={n} className="flex items-center">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-navy-500">…</span>}
            <button type="button" onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined}
              className={`${btn} tabular-nums ${n === page ? "bg-violet-500 text-white" : "hover:bg-white/70"}`}>{n}</button>
          </li>
        ))}
        <li><button type="button" className={`${btn} hover:bg-white/70 disabled:opacity-40`} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button></li>
      </ul>
    </nav>
  );
}
