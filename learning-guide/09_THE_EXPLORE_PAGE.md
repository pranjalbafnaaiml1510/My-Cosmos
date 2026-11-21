# Lesson 09 — The Explore Page

**Time:** 30 minutes | **You need:** Lesson 08 finished

## Goal

By the end of this lesson the home page will have:

- a **hero** with a big search box and example questions,
- the **Research Universe** statistics,
- **Explore by domain** tiles,
- a **Global research** table of countries,
- **Recently published** paper cards.

## Understand

### Building a page from sections

A big page is easier to understand when each section is its own small component:

```tsx
export function ExplorePage() {
  return (<><Hero /><Stats /><Domains /><Global /><Recent /></>);
}
```

Each section loads its own data with `useAsync`, so a slow section never blocks the others.

`<>...</>` is a **fragment**: a wrapper that adds no extra HTML.

### Lists in React: `.map` and `key`

To draw one card per item, use `.map`:

```tsx
{papers.map((p) => <PaperCard key={p.paper_id} paper={p} />)}
```

React needs a unique `key` on each item, so it can tell them apart when the list changes. Use an id, not the position.

### Forms in React

The search box is a **controlled input**: its text lives in state.

```tsx
const [q, setQ] = useState("");
<input value={q} onChange={(e) => setQ(e.target.value)} />
```

On submit we call `e.preventDefault()` (stop the browser reloading the page) and then `navigate("/search?q=...")`.

### Connected exploration

The spec's heart: *"Navigate from a topic → papers → entities → countries… without feeling lost."* So almost everything is clickable: a topic chip opens the papers for that topic, a country row opens that country's papers.

## Do it now

### Step 1 — The search bar

**File:** `my_cosmos/frontend/src/components/SearchBar.tsx`

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/** Big rounded search box. Submitting opens /search?q=... */
export function SearchBar({ initial = "" }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();

  return (
    <form role="search" className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }}>
      <label htmlFor="cosmos-search" className="sr-only">Search the research corpus</label>
      <input id="cosmos-search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Ask the research universe…"
        className="glass h-14 w-full rounded-full pl-6 pr-28 text-lg placeholder:text-navy-500/60 focus:outline-none focus:ring-4 focus:ring-lavender-200/70" />
      <button type="submit"
        className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-full bg-violet-500 px-5 font-medium text-white hover:bg-violet-600">
        Search
      </button>
    </form>
  );
}
```

### Step 2 — The paper card

`aside` is an optional slot on the right. In Lesson 12 the search page puts the relevance score there.

**File:** `my_cosmos/frontend/src/components/PaperCard.tsx`

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Paper } from "../types";
import { Chip, GlassCard } from "./ui";

export function PaperCard({ paper, aside }: { paper: Paper; aside?: ReactNode }) {
  const venue = paper.journal ?? paper.conference;
  return (
    <GlassCard className="flex animate-rise flex-col gap-4 p-5 sm:flex-row">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-snug">
          <Link to={`/papers/${paper.paper_id}`} className="hover:text-violet-600">{paper.title}</Link>
        </h3>
        <p className="mt-1 text-xs text-navy-500">
          {paper.authors.join(", ")} · {paper.publication_year}
          {venue && ` · ${venue}`}
          {paper.country && ` · ${paper.country}`}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-navy-700">{paper.abstract}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.derived.topics.map((t) => <Chip key={t} to={`/papers?topic=${encodeURIComponent(t)}`}>{t}</Chip>)}
          {paper.derived.methods.map((m) => <Chip key={m} tone="method">{m}</Chip>)}
        </div>
      </div>
      {aside}
    </GlassCard>
  );
}
```

### Step 3 — The full Explore page

**File:** `my_cosmos/frontend/src/pages/ExplorePage.tsx`

```tsx
import { Link } from "react-router-dom";
import { api } from "../api";
import { AsyncView } from "../components/AsyncView";
import { PaperCard } from "../components/PaperCard";
import { SearchBar } from "../components/SearchBar";
import { Chip, GlassCard, SectionHeader, StatCard } from "../components/ui";
import { useAsync } from "../hooks/useAsync";

const EXAMPLES = [
  "What are researchers working on in autonomous spacecraft?",
  "How is AI being used in space missions?",
  "Which techniques detect spacecraft faults?",
];

function Hero() {
  return (
    <section className="container-cosmos pb-12 pt-16 sm:pt-24">
      <p className="eyebrow animate-rise">Space Research Intelligence</p>
      <h1 className="mt-3 max-w-3xl animate-rise text-4xl font-bold leading-tight sm:text-6xl">
        Explore humanity's knowledge{" "}
        <span className="bg-gradient-to-r from-violet-500 to-blush-300 bg-clip-text text-transparent">beyond Earth.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-navy-500">
        Research papers transformed into an interactive map of space science, spacecraft technology and discovery.
      </p>
      <div className="mt-8 max-w-2xl"><SearchBar /></div>
      <div className="mt-4 flex max-w-3xl flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <Link key={q} to={`/search?q=${encodeURIComponent(q)}`}
            className="rounded-full border border-lavender-200 bg-white/60 px-3 py-1.5 text-sm text-navy-700 hover:bg-white">
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Stats() {
  const stats = useAsync(() => api.getStats(), []);
  return (
    <section className="container-cosmos">
      <h2 className="eyebrow mb-4">Research Universe</h2>
      <AsyncView state={stats} loading="Counting the stars…">
        {(s) => (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard value={s.papers} label="Research papers" />
              <StatCard value={s.countries} label="Countries" />
              <StatCard value={s.topics} label="Research topics" />
              <StatCard value={s.organizations} label="Organizations" />
            </div>
            {s.synthetic && <p className="mt-3 text-sm text-navy-500">Demo data: these are synthetic records, not real research.</p>}
          </>
        )}
      </AsyncView>
    </section>
  );
}

function Domains() {
  const domains = useAsync(() => api.getDomains(), []);
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Explore by domain" title="Areas of space research" />
      <AsyncView state={domains}>
        {(ds) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ds.map((d) => (
              <GlassCard key={d.id} className="p-4">
                <p className="font-semibold"><span aria-hidden className="mr-2">{d.icon ?? "🔭"}</span>{d.name}</p>
                <p className="mt-1 text-xs tabular-nums text-navy-500">{d.paper_count.toLocaleString()} papers · {d.topics.length} topics</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {d.topics.map((t) => <Chip key={t} to={`/papers?topic=${encodeURIComponent(t)}`}>{t}</Chip>)}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </AsyncView>
    </section>
  );
}

function Global() {
  const countries = useAsync(() => api.getCountries(), []);
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Global research" title="Where the research comes from"
        description="Country comes from author affiliation metadata, never guessed from the paper text." />
      <AsyncView state={countries}>
        {(cs) => (
          <div className="glass overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Papers by country of author affiliation</caption>
              <thead className="border-b border-lavender-100 text-xs uppercase tracking-wider text-navy-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Country</th>
                  <th scope="col" className="px-5 py-3">Papers</th>
                  <th scope="col" className="px-5 py-3">Top research areas</th>
                </tr>
              </thead>
              <tbody>
                {cs.slice(0, 8).map((c) => (
                  <tr key={c.id} className="border-b border-lavender-50 last:border-0 hover:bg-lavender-50/60">
                    <th scope="row" className="px-5 py-3 font-medium">
                      <Link to={`/papers?country=${encodeURIComponent(c.name)}`} className="hover:text-violet-600">
                        <span aria-hidden className="mr-2">{c.flag}</span>{c.name}
                      </Link>
                    </th>
                    <td className="px-5 py-3 tabular-nums">{c.paper_count.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">{c.top_topics.map((t) => <Chip key={t}>{t}</Chip>)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </section>
  );
}

function Recent() {
  const papers = useAsync(() => api.getRecentPapers(4), []);
  return (
    <section className="container-cosmos mt-20">
      <SectionHeader eyebrow="Featured research" title="Recently published" />
      <AsyncView state={papers}>
        {(ps) => <div className="grid gap-4 lg:grid-cols-2">{ps.map((p) => <PaperCard key={p.paper_id} paper={p} />)}</div>}
      </AsyncView>
    </section>
  );
}

export function ExplorePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Domains />
      <Global />
      <Recent />
    </>
  );
}
```

## Check

- [ ] The hero has a large search box and three example questions.
- [ ] Ten domain tiles each list their topics as chips.
- [ ] The country table shows the top 8 countries, United States first.
- [ ] Four "Recently published" cards appear.
- [ ] Clicking a topic chip goes to `/papers?topic=...` (still "coming soon" — Lesson 10 builds it).
- [ ] Narrow the window to phone width: everything stacks and the table scrolls sideways.

## What just happened?

- Each section called its own `useAsync`, so four loaders ran **in parallel**. Thanks to the shared `load()` promise, the JSON files were still downloaded only once.
- `encodeURIComponent("Computer Vision")` → `Computer%20Vision`, so spaces and symbols are safe inside an address.
- The table uses real table HTML (`<caption>`, `<th scope="col">`, `<th scope="row">`), so screen readers can announce "Country: India, Papers: 122".
- `overflow-x-auto` + `min-w-[560px]` lets the table scroll sideways on phones instead of squashing.

## Try it yourself

1. Change `getRecentPapers(4)` to `6`, and `lg:grid-cols-2` to `lg:grid-cols-3`.
2. Add a fourth example question of your own.
3. Show all countries instead of the top 8. Is the page still pleasant? (This is why we cut lists.)

## If it does not work

| Problem | Fix |
|---|---|
| Warning in console: `Each child in a list should have a unique "key" prop` | A `.map(...)` is missing `key={...}`. |
| `useNavigate() may be used only in the context of a <Router>` | You used `SearchBar` outside the router. It works inside pages. |
| Domain icons show as squares | Your font is missing that emoji. Harmless. |

---

**Next:** [10_THE_RESEARCH_TABLE.md](10_THE_RESEARCH_TABLE.md)
