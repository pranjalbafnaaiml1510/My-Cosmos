# Lesson 10 — The Research Table

**Time:** 35 minutes | **You need:** Lesson 09 finished

## Goal

By the end of this lesson `/papers` will be a real research database view:

- a **table** of papers (not cards!),
- **filters** for topic and country, plus a keyword search,
- **sorting** (newest, oldest, title),
- **pagination** (25 per page),
- **expandable rows** that show the abstract,
- every filter stored in the **address**, so a view can be shared as a link.

## Understand

### Why a table?

The spec is clear: *"The application must contain proper data tables. Do NOT turn everything into cards."* Cards are friendly to browse; tables are better to **compare** and **scan** many papers at once.

### The address as memory: URL search params

In `/papers?topic=Computer%20Vision&country=India&page=2`, everything after `?` is the **search params**. If the filters live there:

- the browser's **Back** button undoes a filter change,
- you can **bookmark** or send a filtered view,
- the topic chips from Lesson 09 (`/papers?topic=...`) simply work.

React Router's `useSearchParams()` reads them and lets you change them, like `useState`.

### Pagination

1,500 rows at once is slow and unreadable. We show 25 at a time. The data source returns `{ items, total, page, page_size }`, so the page knows how many pages exist: `Math.ceil(total / page_size)`.

### Expandable rows

Each row has a small `›` button. Clicking it opens a second row underneath with the abstract. We remember which rows are open in a `Set` held in state.

## Do it now

### Step 1 — The papers page

**File:** `my_cosmos/frontend/src/pages/PapersPage.tsx`

```tsx
import { Fragment, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { AsyncView } from "../components/AsyncView";
import { Chip, CosmicLoader, EmptyState } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import type { PaperSort } from "../types";

const PAGE_SIZE = 25;

export function PapersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const topic = params.get("topic") ?? "";
  const country = params.get("country") ?? "";
  const sort = (params.get("sort") as PaperSort) || "newest";
  const page = Number(params.get("page") ?? 1);

  const facets = useAsync(() => api.getFacets(), []);
  const result = useAsync(
    () => api.queryPapers({ q, topic: topic || undefined, country: country || undefined, sort, page, page_size: PAGE_SIZE }),
    [q, topic, country, sort, page],
  );
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [text, setText] = useState(q);

  /** Change one filter; any filter change returns to page 1. */
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="container-cosmos py-10">
      <p className="eyebrow">Research explorer</p>
      <h1 className="mt-1 text-3xl font-semibold">Papers</h1>
      <p className="mt-2 text-navy-500">Filter, sort and inspect the corpus. The address keeps your filters, so you can share the view.</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3 text-sm">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); update("q", text.trim()); }}>
          <label htmlFor="kw" className="sr-only">Keyword</label>
          <input id="kw" value={text} onChange={(e) => setText(e.target.value)} placeholder="Keyword…"
            className="glass h-10 rounded-full px-4 focus:outline-none" />
          <button type="submit" className="h-10 rounded-full bg-violet-500 px-4 font-medium text-white hover:bg-violet-600">Filter</button>
        </form>
        <AsyncView state={facets} loading="Loading filters…">
          {(f) => (
            <>
              <label className="flex flex-col gap-1">Topic
                <select value={topic} onChange={(e) => update("topic", e.target.value)} className="h-10 rounded-lg border border-lavender-100 bg-white/70 px-2">
                  <option value="">All topics</option>
                  {f.topics.map((t) => <option key={t.value} value={t.value}>{t.value} ({t.count})</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">Country
                <select value={country} onChange={(e) => update("country", e.target.value)} className="h-10 rounded-lg border border-lavender-100 bg-white/70 px-2">
                  <option value="">All countries</option>
                  {f.countries.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.count})</option>)}
                </select>
              </label>
            </>
          )}
        </AsyncView>
        <label className="flex flex-col gap-1">Sort
          <select value={sort} onChange={(e) => update("sort", e.target.value)} className="h-10 rounded-lg border border-lavender-100 bg-white/70 px-2">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
        {(q || topic || country) && (
          <button type="button" onClick={() => { setText(""); setParams({}); }} className="h-10 text-violet-600 hover:underline">Clear all</button>
        )}
      </div>

      {/* Results */}
      <div className="mt-6">
        {result.status === "loading" && <CosmicLoader label="Filtering the research universe…" />}
        {result.status === "error" && <EmptyState title="Couldn't load papers." hint={result.error.message} />}
        {result.status === "ready" && (result.data.total === 0
          ? <EmptyState title="No papers match these filters." hint="Try removing a filter." />
          : (
            <>
              <p className="mb-2 text-sm tabular-nums text-navy-500" aria-live="polite">
                {result.data.total.toLocaleString()} papers · page {page} of {Math.ceil(result.data.total / PAGE_SIZE)}
              </p>
              <div className="glass overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">Research papers</caption>
                  <thead className="border-b border-lavender-100 text-xs uppercase tracking-wider text-navy-500">
                    <tr>
                      <th scope="col" className="w-10 px-3 py-3"><span className="sr-only">Details</span></th>
                      <th scope="col" className="px-3 py-3">Paper</th>
                      <th scope="col" className="px-3 py-3">Year</th>
                      <th scope="col" className="px-3 py-3">Country</th>
                      <th scope="col" className="px-3 py-3">Topic</th>
                      <th scope="col" className="px-3 py-3">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.items.map((p) => {
                      const isOpen = open.has(p.paper_id);
                      return (
                        <Fragment key={p.paper_id}>
                          <tr className="border-b border-lavender-50 align-top hover:bg-lavender-50/60">
                            <td className="px-3 py-3">
                              <button type="button" onClick={() => toggle(p.paper_id)} aria-expanded={isOpen}
                                className="grid h-6 w-6 place-items-center rounded-full hover:bg-lavender-100">
                                <span className="sr-only">{isOpen ? "Hide" : "Show"} abstract</span>
                                <span aria-hidden className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                              </button>
                            </td>
                            <td className="px-3 py-3"><Link to={`/papers/${p.paper_id}`} className="font-medium hover:text-violet-600">{p.title}</Link></td>
                            <td className="px-3 py-3 tabular-nums">{p.publication_year}</td>
                            <td className="px-3 py-3">{p.country ?? "—"}</td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {p.derived.topics.map((t) => <Chip key={t} to={`/papers?topic=${encodeURIComponent(t)}`}>{t}</Chip>)}
                              </div>
                            </td>
                            <td className="px-3 py-3">{p.derived.methods.join(", ")}</td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-lavender-50/40">
                              <td />
                              <td colSpan={5} className="px-3 pb-4 text-navy-700">{p.abstract}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 text-sm">
                <button type="button" disabled={page <= 1} onClick={() => update("page", String(page - 1))}
                  className="rounded-full bg-white/70 px-4 py-1.5 disabled:opacity-40">‹ Previous</button>
                <button type="button" disabled={page * PAGE_SIZE >= result.data.total} onClick={() => update("page", String(page + 1))}
                  className="rounded-full bg-white/70 px-4 py-1.5 disabled:opacity-40">Next ›</button>
              </nav>
            </>
          ))}
      </div>
    </div>
  );
}
```

### Step 2 — Add the route

**File:** `my_cosmos/frontend/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { AppShell } from "./layouts/AppShell";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { ExplorePage } from "./pages/ExplorePage";
import { PapersPage } from "./pages/PapersPage";

const soon = (title: string, lesson: string) => <ComingSoonPage title={title} lesson={lesson} />;

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <ExplorePage /> },
      { path: "/papers", element: <PapersPage /> },
      { path: "/papers/:id", element: soon("Paper page", "Lesson 13") },
      { path: "/search", element: soon("Semantic search", "Lesson 12") },
      { path: "/map", element: soon("Research map", "Lesson 14") },
      { path: "/trends", element: soon("Trends", "Lesson 15") },
      { path: "/opportunities", element: soon("Research opportunities", "Lesson 16") },
      { path: "/assistant", element: soon("Research assistant", "Lesson 17") },
      { path: "*", element: soon("Lost in space", "404") },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

## Check

- [ ] `/papers` shows a table: **1,500 papers · page 1 of 60**.
- [ ] Choosing topic **Computer Vision** and country **India** narrows the table, and the address bar shows both.
- [ ] Press the browser's **Back** button: the last filter is undone.
- [ ] The `›` button opens and closes the abstract under a row.
- [ ] **Next ›** goes to page 2. **‹ Previous** is greyed out on page 1.
- [ ] On the Explore page, clicking a topic chip opens this table already filtered.

## What just happened?

- The page has **no filter state of its own** — it reads everything from `useSearchParams()`. Change the address and the page follows.
- `useAsync(..., [q, topic, country, sort, page])` re-runs the query whenever one of those values changes. That's what the `deps` list is for.
- `update()` copies the current params, changes one, and resets `page` (page 7 of an old filter would make no sense).
- `<Fragment key=...>` lets one table item draw **two** `<tr>` rows (the row and its abstract) with a single key.
- The `Set` of open rows is **new** on every change (`new Set(s)`). React only redraws when it sees a *new* value, not a changed old one.

## Try it yourself

1. Add a **Year** filter: a `<select>` with `year` in the params. The mock adapter needs a `year` field in `PaperQuery` too. (Hint: TypeScript will tell you every place that must change.)
2. Change `PAGE_SIZE` to 10.
3. Share a link: copy the address of a filtered view into a new tab. Same table?

## If it does not work

| Problem | Fix |
|---|---|
| The table never changes when you pick a filter | Check the `deps` list `[q, topic, country, sort, page]` in `useAsync`. |
| `Warning: validateDOMNesting` | A `<tr>` must be inside `<tbody>`, and a `<td>` inside a `<tr>`. |
| Page says "page 1 of 0" | `total` is 0: your filters exclude everything. The empty state should show instead; check the `total === 0` branch. |

---

**Next:** [11_YOUR_FIRST_API_WITH_FASTAPI.md](11_YOUR_FIRST_API_WITH_FASTAPI.md)
