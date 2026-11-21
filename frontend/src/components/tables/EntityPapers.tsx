import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services";
import type { PaperQuery, PaperSortKey } from "../../types";
import { CosmicLoader } from "../cosmic/OrbitalDecoration";
import { EmptyState } from "../ui/primitives";
import { COLUMNS, ResearchTable } from "./ResearchTable";

const COLS = COLUMNS.filter((c) => ["paper", "year", "country", "topic", "method"].includes(c.id));

/** Compact, paged paper table scoped to a fixed filter, with a hand-off to the full explorer. */
export function EntityPapers({ filter, explorerHref }: { filter: PaperQuery; explorerHref: string }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ sort: PaperSortKey; order: "asc" | "desc" }>({ sort: "publication_year", order: "desc" });
  const key = JSON.stringify([filter, page, sort]);
  const s = useAsync(() => api.queryPapers({ ...filter, ...sort, page, page_size: 10 }), [key]);

  if (s.status === "loading") return <CosmicLoader label="Gathering papers…" />;
  if (s.status === "error") return <EmptyState title="Couldn't load papers." hint={s.error.message} />;
  const { items, total } = s.data;
  if (!total) return <EmptyState title="No papers found." />;
  const pages = Math.ceil(total / 10);
  return (
    <div>
      <ResearchTable rows={items} columns={COLS} sort={sort.sort} order={sort.order}
        onSort={(k) => { setPage(1); setSort((p) => ({ sort: k, order: p.sort === k && p.order === "desc" ? "asc" : "desc" })); }} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-full px-3 py-1 hover:bg-white/70 disabled:opacity-40" aria-label="Previous page">‹</button>
          <span className="tabular-nums text-navy-500">Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-full px-3 py-1 hover:bg-white/70 disabled:opacity-40" aria-label="Next page">›</button>
        </div>
        <Link to={explorerHref} className="font-medium text-violet-600 hover:underline">Open all {total.toLocaleString()} in Research Explorer →</Link>
      </div>
    </div>
  );
}
