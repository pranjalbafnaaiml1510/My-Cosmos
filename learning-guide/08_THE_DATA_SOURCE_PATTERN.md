# Lesson 08 — The Data Source Pattern

**Time:** 30 minutes | **You need:** Lesson 07 finished

## Goal

By the end of this lesson:

- all data access goes through **one door**, called `api`,
- the demo data sits behind that door (the **mock adapter**),
- every page shows proper **loading**, **error** and **ready** states,
- the Explore page shows real statistics in `StatCard`s.

## Understand

### The problem with Lesson 07

In Lesson 07 the Explore page called `fetch("/data/papers.json")` itself. If every page does that, then on the day we connect the real API we'd have to change **every page**. The spec says: *"Switching data mode should not require rewriting UI components."*

### The solution: one door with a contract

```
 Pages  ──────►  api  (the door)
                  │
          ┌───────┴────────┐
     mock adapter      http adapter (Lesson 11)
     (demo files)      (the FastAPI server)
```

1. An **interface** called `DataSource` lists everything pages may ask for: `getStats()`, `getPaper(id)`, and so on. It's a contract — a list of promises with no code.
2. An **adapter** is real code that keeps the contract. The **mock adapter** answers from the demo files. In Lesson 11 you write an **http adapter** that asks the API.
3. `api` is whichever adapter is switched on. Pages only ever use `api`.

Changing the data source then means changing **one line**, not fifty pages.

### `async` / `await`: a nicer `.then`

```ts
const response = await fetch(url);   // wait here until it arrives
const data = await response.json();
```

`await` only works inside a function marked `async`. An `async` function always returns a **Promise**: a box that will hold the answer later. Its type is written `Promise<CorpusStats>`.

### Three states, always

Every time we load data, the screen is in one of three states:

| State | Show |
|---|---|
| loading | `CosmicLoader` with honest text ("Counting the stars…") |
| error | `EmptyState` saying what went wrong |
| ready | the actual content |

The spec insists on this: *"Every page needs beautiful empty/loading/error states."* A small hook, `useAsync`, tracks the state for us, and `AsyncView` draws the right one.

### What is a hook?

A **hook** is a function starting with `use` that adds React powers to a component. `useState` and `useEffect` are built-in hooks. `useAsync` is our own hook, built from those two.

## Do it now

### Step 1 — The contract

Create the folder `src/api`.

**File:** `my_cosmos/frontend/src/api/dataSource.ts`

```ts
import type { CorpusStats, CountrySummary, DomainSummary, Facets, Paper, PaperPage, PaperQuery, Taxonomy } from "../types";

/**
 * Everything the pages may ask for. Pages never fetch data themselves:
 * they call `api`, which is one of the adapters that keeps this contract.
 */
export interface DataSource {
  getStats(): Promise<CorpusStats>;
  getTaxonomy(): Promise<Taxonomy>;
  getDomains(): Promise<DomainSummary[]>;
  getCountries(): Promise<CountrySummary[]>;
  getRecentPapers(limit: number): Promise<Paper[]>;
  /** null when no paper has this id */
  getPaper(id: string): Promise<Paper | null>;
  queryPapers(query: PaperQuery): Promise<PaperPage>;
  getFacets(): Promise<Facets>;
}
```

### Step 2 — The mock adapter

**File:** `my_cosmos/frontend/src/api/mock.ts`

```ts
import type { CorpusStats, CountValue, CountrySummary, DomainSummary, Facets, Paper, PaperPage, Taxonomy } from "../types";
import type { DataSource } from "./dataSource";

type Corpus = { papers: Paper[]; taxonomy: Taxonomy };
let loading: Promise<Corpus> | null = null;

/** Download the demo files once. Every later call reuses the same promise. */
function load(): Promise<Corpus> {
  if (!loading) {
    loading = Promise.all([
      fetch("/data/papers.json").then((r) => r.json() as Promise<Paper[]>),
      fetch("/data/taxonomy.json").then((r) => r.json() as Promise<Taxonomy>),
    ]).then(([papers, taxonomy]) => ({ papers, taxonomy }));
  }
  return loading;
}

/** Count how often each value appears, most common first. */
export function countValues(values: string[]): CountValue[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/** Answers every question from the demo files, inside the browser. */
export const mockSource: DataSource = {
  async getStats(): Promise<CorpusStats> {
    const { papers } = await load();
    const years = papers.map((p) => p.publication_year);
    return {
      papers: papers.length,
      countries: new Set(papers.map((p) => p.country).filter(Boolean)).size,
      topics: new Set(papers.flatMap((p) => p.derived.topics)).size,
      organizations: new Set(papers.flatMap((p) => p.organizations)).size,
      year_from: Math.min(...years),
      year_to: Math.max(...years),
      synthetic: papers.some((p) => p.is_synthetic),
    };
  },

  async getTaxonomy() {
    return (await load()).taxonomy;
  },

  async getDomains(): Promise<DomainSummary[]> {
    const { papers, taxonomy } = await load();
    return taxonomy.domains.map((d) => ({
      ...d,
      paper_count: papers.filter((p) => p.derived.topics.some((t) => d.topics.includes(t))).length,
    }));
  },

  async getCountries(): Promise<CountrySummary[]> {
    const { papers, taxonomy } = await load();
    return taxonomy.countries
      .map((c) => {
        const mine = papers.filter((p) => p.country === c.name);
        const topTopics = countValues(mine.flatMap((p) => p.derived.topics)).slice(0, 3);
        return { ...c, paper_count: mine.length, top_topics: topTopics.map((t) => t.value) };
      })
      .sort((a, b) => b.paper_count - a.paper_count);
  },

  async getRecentPapers(limit) {
    const { papers } = await load();
    return [...papers].sort((a, b) => b.publication_date.localeCompare(a.publication_date)).slice(0, limit);
  },

  async getPaper(id) {
    const { papers } = await load();
    return papers.find((p) => p.paper_id === id) ?? null;
  },

  async queryPapers(q): Promise<PaperPage> {
    const { papers } = await load();
    const words = (q.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const matches = papers.filter((p) =>
      (!q.topic || p.derived.topics.includes(q.topic)) &&
      (!q.country || p.country === q.country) &&
      words.every((w) => `${p.title} ${p.abstract}`.toLowerCase().includes(w)));
    const sort = q.sort ?? "newest";
    matches.sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title)
        : sort === "oldest" ? a.publication_date.localeCompare(b.publication_date)
          : b.publication_date.localeCompare(a.publication_date));
    const page = Math.max(1, q.page ?? 1);
    const size = q.page_size ?? 25;
    return { items: matches.slice((page - 1) * size, page * size), total: matches.length, page, page_size: size };
  },

  async getFacets(): Promise<Facets> {
    const { papers } = await load();
    return {
      topics: countValues(papers.flatMap((p) => p.derived.topics)),
      countries: countValues(papers.flatMap((p) => (p.country ? [p.country] : []))),
    };
  },
};
```

### Step 3 — The door

**File:** `my_cosmos/frontend/src/api/index.ts`

```ts
import type { DataSource } from "./dataSource";
import { mockSource } from "./mock";

/** The single door to all data. Pages import this, never an adapter. */
export const api: DataSource = mockSource;
```

### Step 4 — The `useAsync` hook

Create the folder `src/hooks`.

**File:** `my_cosmos/frontend/src/hooks/useAsync.ts`

```ts
import { useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: T };

/** Runs `load` when the component appears (and again whenever `deps` change). */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true; // ignore answers that arrive after the page has moved on
    setState({ status: "loading" });
    load().then(
      (data) => alive && setState({ status: "ready", data }),
      (error: Error) => alive && setState({ status: "error", error }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
```

### Step 5 — `AsyncView`: draw the right state

**File:** `my_cosmos/frontend/src/components/AsyncView.tsx`

```tsx
import type { ReactNode } from "react";
import type { AsyncState } from "../hooks/useAsync";
import { CosmicLoader, EmptyState } from "./ui";

/** Shows a loader, an error, or — when ready — whatever `children` draws with the data. */
export function AsyncView<T>({ state, loading, children }: {
  state: AsyncState<T>;
  loading?: string;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") return <CosmicLoader label={loading} />;
  if (state.status === "error") return <EmptyState title="Couldn't reach the research universe." hint={state.error.message} />;
  return <>{children(state.data)}</>;
}
```

### Step 6 — Use the door on the Explore page

**File:** `my_cosmos/frontend/src/pages/ExplorePage.tsx`

```tsx
import { api } from "../api";
import { AsyncView } from "../components/AsyncView";
import { StatCard } from "../components/ui";
import { useAsync } from "../hooks/useAsync";

export function ExplorePage() {
  const stats = useAsync(() => api.getStats(), []);

  return (
    <section className="container-cosmos py-20">
      <p className="eyebrow">Space Research Intelligence</p>
      <h1 className="mt-3 text-4xl font-bold sm:text-6xl">
        Explore humanity's knowledge <span className="text-violet-500">beyond Earth.</span>
      </h1>

      <div className="mt-10">
        <AsyncView state={stats} loading="Counting the stars…">
          {(s) => (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard value={s.papers} label="Research papers" />
                <StatCard value={s.countries} label="Countries" />
                <StatCard value={s.topics} label="Research topics" />
                <StatCard value={s.organizations} label="Organizations" />
              </div>
              {s.synthetic && (
                <p className="mt-3 text-sm text-navy-500">Demo data: these are synthetic records, not real research.</p>
              )}
            </>
          )}
        </AsyncView>
      </div>
    </section>
  );
}
```

## Check

- [ ] The Explore page briefly shows the orbiting loader with "Counting the stars…", then four stat cards: **1,500 / 14 / 38 / 84**.
- [ ] The demo-data sentence appears under the cards.
- [ ] `npm run build` finishes with `✓ built`.

## What just happened?

1. `ExplorePage` called `api.getStats()`. It doesn't know (or care) that `api` is the mock adapter.
2. The mock adapter's `load()` downloaded both JSON files **once** and remembered the promise in `loading`. Every later call reuses it.
3. `useAsync` started in `loading`, then switched to `ready` with the stats. React re-drew the page.
4. `AsyncView` saw `ready` and called `children(s)` — the function inside it — to draw the cards.

**The pattern in one sentence:** pages talk to `api`, `api` keeps the `DataSource` contract, and adapters do the actual work.

## Try it yourself

1. Make an error on purpose: in `mock.ts`, change `"/data/papers.json"` to `"/data/nope.json"`. Reload. You should see the error state, not a broken page. **Change it back.**
2. Add a fifth `StatCard` showing the year range. Hint: `StatCard` only takes a number, so either show `s.year_to - s.year_from` years, or give `StatCard` a `suffix`.
3. Why does `load()` keep the promise in `loading` instead of downloading the files every time? (Every call would download 1.6 MB again.)

## If it does not work

| Problem | Fix |
|---|---|
| `Property 'getFacets' is missing` | Your `mockSource` is missing a method from the contract. TypeScript checks every method in `DataSource`. |
| `Cannot find module '../api'` | The file must be `src/api/index.ts`. Importing a folder loads its `index.ts`. |
| Loader spins forever | F12 → Console. Usually the JSON path is wrong (see Lesson 07). |

---

**Next:** [09_THE_EXPLORE_PAGE.md](09_THE_EXPLORE_PAGE.md)
