import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { slug } from "../../lib/slug";
import type { PaperRow, PaperSortKey } from "../../types";
import { Chip } from "../ui/primitives";

export interface Column {
  id: string;
  label: string;
  sortKey?: PaperSortKey;
  /** Plain-text value, used for CSV export. */
  text: (r: PaperRow) => string;
  render?: (r: PaperRow) => ReactNode;
  className?: string;
}

const list = (xs: string[]) => xs.join("; ");

export const COLUMNS: Column[] = [
  {
    id: "paper", label: "Paper", sortKey: "title", text: (r) => r.paper.title, className: "min-w-[18rem]",
    render: (r) => <Link to={`/papers/${r.paper.paper_id}`} className="font-medium text-navy-900 hover:text-violet-600">{r.paper.title}</Link>,
  },
  { id: "year", label: "Year", sortKey: "publication_year", text: (r) => String(r.paper.publication_year), className: "tabular-nums" },
  { id: "country", label: "Country", sortKey: "country", text: (r) => r.paper.country ?? "—" },
  { id: "organization", label: "Organization", text: (r) => list(r.paper.organizations) },
  {
    id: "topic", label: "Topic", text: (r) => list(r.paper.derived.topics),
    render: (r) => <div className="flex flex-wrap gap-1">{r.paper.derived.topics.map((t) => <Chip key={t} to={`/topics/${slug(t)}`}>{t}</Chip>)}</div>,
  },
  { id: "mission", label: "Mission", text: (r) => list(r.paper.derived.missions) || "—" },
  { id: "technology", label: "Technology", text: (r) => list(r.paper.derived.technologies) },
  { id: "method", label: "Method", text: (r) => list(r.paper.derived.methods) },
  {
    id: "relevance", label: "Relevance", sortKey: "relevance", text: (r) => (r.relevance == null ? "" : String(r.relevance)),
    render: (r) => r.relevance == null ? <span className="text-navy-500/60">—</span> : (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-12 rounded-full bg-lavender-100"><span className="block h-full rounded-full bg-lavender-400" style={{ width: `${r.relevance}%` }} /></span>
        <span className="tabular-nums">{r.relevance}%</span>
      </span>
    ),
  },
];

export function toCsv(rows: PaperRow[], cols: Column[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(c.text(r))).join(","))].join("\n");
}

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  return <span aria-hidden className={`ml-1 text-[10px] ${dir ? "text-violet-600" : "text-navy-500/40"}`}>{dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}</span>;
}

export function ResearchTable({ rows, columns, sort, order, onSort }: {
  rows: PaperRow[]; columns: Column[]; sort?: PaperSortKey; order?: "asc" | "desc"; onSort: (k: PaperSortKey) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="glass overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Research papers. Column headers with arrows can be sorted.</caption>
        <thead className="sticky top-0 border-b border-lavender-100 bg-white/80 text-xs uppercase tracking-wider text-navy-500 backdrop-blur">
          <tr>
            <th scope="col" className="w-10 px-3 py-3"><span className="sr-only">Expand</span></th>
            {columns.map((c) => {
              const dir = c.sortKey && c.sortKey === sort ? order ?? "desc" : null;
              return (
                <th key={c.id} scope="col" className={`whitespace-nowrap px-3 py-3 font-semibold ${c.className ?? ""}`}
                  aria-sort={dir ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortKey
                    ? <button type="button" onClick={() => onSort(c.sortKey!)} className="inline-flex items-center uppercase hover:text-violet-600">{c.label}<SortIcon dir={dir} /></button>
                    : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = r.paper.paper_id, open = expanded.has(id);
            return (
              <Fragment key={id}>
                <tr className={`border-b border-lavender-50 align-top transition-colors hover:bg-lavender-50/60 ${open ? "bg-lavender-50/60" : ""}`}>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => toggle(id)} aria-expanded={open} aria-controls={`detail-${id}`}
                      className="grid h-6 w-6 place-items-center rounded-full text-navy-500 hover:bg-lavender-100">
                      <span className="sr-only">{open ? "Collapse" : "Expand"} details</span>
                      <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                    </button>
                  </td>
                  {columns.map((c) => <td key={c.id} className={`px-3 py-3 text-navy-700 ${c.className ?? ""}`}>{c.render ? c.render(r) : c.text(r)}</td>)}
                </tr>
                {open && (
                  <tr id={`detail-${id}`} className="border-b border-lavender-100 bg-lavender-50/40">
                    <td />
                    <td colSpan={columns.length} className="px-3 pb-4 pt-1">
                      <div className="max-w-4xl animate-rise">
                        <p className="text-sm leading-relaxed text-navy-700">{r.paper.abstract}</p>
                        <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-navy-500 sm:grid-cols-2">
                          <div><dt className="inline font-semibold">Authors: </dt><dd className="inline">{r.paper.authors.join(", ")}</dd></div>
                          <div><dt className="inline font-semibold">Venue: </dt><dd className="inline">{r.paper.journal ?? r.paper.conference ?? "—"}</dd></div>
                          <div><dt className="inline font-semibold">Published: </dt><dd className="inline">{r.paper.publication_date}</dd></div>
                          <div><dt className="inline font-semibold">DOI: </dt><dd className="inline">{r.paper.doi ?? "Not available"}</dd></div>
                        </dl>
                        <Link to={`/papers/${id}`} className="mt-3 inline-block text-sm font-medium text-violet-600 hover:underline">Open paper intelligence →</Link>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
