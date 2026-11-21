# Lesson 15 — Trends and Emerging Topics

**Time:** 35 minutes | **You need:** Lesson 14 finished

## Goal

By the end of this lesson:

- the API measures, for every topic, whether its **share** of papers is rising or falling,
- each topic gets a careful label: **Emerging topic signal**, **Increasing activity**, **Stable**, or **Declining in this corpus**,
- the website has a **Trends** page with three signal columns and a full statistics table with small trend lines.

## Understand

### Counting is not enough

Suppose "Onboard AI" had 6 papers a year before 2024 and 12 a year since. Growing? Maybe. But if the **whole corpus** also doubled (more papers get published every year), Onboard AI only kept pace. So we measure growth **relative to the corpus**:

```
topic growth  = (papers/year recently) ÷ (papers/year before)
corpus growth = the same, for all papers
growth ×      = topic growth ÷ corpus growth
```

`growth × = 2.0` means "this topic's **share** of the corpus doubled". `1.0` means "it grew exactly as fast as everything else".

### The recent window and the baseline

We split the years:

```
2015 ─────────── 2023 │ 2024 ── 2026
       baseline       │  recent window (3 years)
```

### Is it real or luck? The z-score

Small numbers jump around by chance: 2 papers → 5 papers is "×2.5" but means little. The **z-score** asks *"how surprising is this?"*:

```
expected = baseline papers/year × window years × corpus growth
z        = (recent papers − expected) ÷ √expected
```

The `√expected` comes from the **Poisson** distribution, a standard model for counts. Roughly: z above 2 is unusual; around 0 is normal.

### The rules

| Label | Rule |
|---|---|
| Emerging topic signal | growth × ≥ 1.5 **and** z ≥ 2 **and** at least 5 recent papers |
| Increasing activity | growth × ≥ 1.15 and z ≥ 1 |
| Declining in this corpus | growth × ≤ 0.75 and z ≤ −1.5 |
| Stable | everything else |

We also compute the **slope**: the straight line that best fits papers-per-year (*least squares*). A positive slope means "trending up across all years".

### Honest words

The spec is strict: *"Do not claim that something is scientifically important merely because it has increased in the dataset."* Say **"Emerging topic signal"**, **"Increasing research activity"**, **"Rapidly growing in this corpus"**. Never "this is the future" or "the most important technology". The page also explains the method and its limits.

## Do it now

### Step 1 — The trend statistics

**File:** `my_cosmos/backend/app/trends.py`

```python
"""Research evolution: is each topic's SHARE of the corpus rising or falling?"""
import math

from fastapi import APIRouter, Query

from app.corpus import CORPUS, slug

router = APIRouter(tags=["trends"])


def classify(growth: float, z: float, recent: int) -> str:
    """Corpus signals, worded carefully. Not judgements of scientific importance."""
    if growth >= 1.5 and z >= 2 and recent >= 5:
        return "emerging"
    if growth >= 1.15 and z >= 1:
        return "growing"
    if growth <= 0.75 and z <= -1.5:
        return "declining"
    return "stable"


def slope(xs: list[int], ys: list[int]) -> float:
    """Least-squares straight line through the points: papers per year, per year."""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else 0.0


def per_year(papers: list[dict]) -> list[int]:
    counts = {y: 0 for y in CORPUS.years}
    for p in papers:
        counts[p["publication_year"]] += 1
    return [counts[y] for y in CORPUS.years]


def report(recent_years: int = 3) -> dict:
    years = CORPUS.years
    window = max(1, min(recent_years, len(years) - 2))
    n_base = len(years) - window
    totals = per_year(CORPUS.papers)
    corpus_growth = (sum(totals[n_base:]) / window) / (sum(totals[:n_base]) / n_base)

    topics = []
    for name in CORPUS.topics:
        counts = per_year([p for p in CORPUS.papers if name in p["derived"]["topics"]])
        base, recent = sum(counts[:n_base]), sum(counts[n_base:])
        base_rate = base / n_base
        expected = base_rate * window * corpus_growth  # what the topic's old share predicts
        growth = ((recent / window) / base_rate) / corpus_growth if base_rate else (99.0 if recent else 1.0)
        z = (recent - expected) / math.sqrt(max(expected, 1.0))
        topics.append({
            "topic": name, "topic_id": slug(name), "per_year": counts, "total": base + recent, "recent": recent,
            "growth": round(growth, 2), "z": round(z, 2), "slope": round(slope(years, counts), 2),
            "status": classify(growth, z, recent),
        })
    topics.sort(key=lambda t: -t["z"])
    return {"years": years, "recent_years": window, "corpus_growth": round(corpus_growth, 2), "totals": totals, "topics": topics}


@router.get("/trends")
def trends(recent_years: int = Query(3, ge=1, le=6)):
    return report(recent_years)
```

### Step 2 — Switch it on

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API. Run from my_cosmos/backend:  uvicorn app.main:app --reload --port 8020"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import graph, papers_api, recommend, search, trends

app = FastAPI(title="My COSMOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers_api.router)
app.include_router(search.router)
app.include_router(recommend.router)
app.include_router(graph.router)
app.include_router(trends.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

### Step 3 — Tests

**File:** `my_cosmos/backend/tests/test_trends.py`

```python
from fastapi.testclient import TestClient

from app.main import app
from app.trends import classify

client = TestClient(app)


def test_rules():
    assert classify(2.0, 3.0, 10) == "emerging"
    assert classify(2.0, 3.0, 2) == "growing"   # too few papers to call it emerging
    assert classify(1.0, 0.0, 10) == "stable"
    assert classify(0.5, -2.0, 3) == "declining"


def test_report_adds_up():
    r = client.get("/trends").json()
    assert r["recent_years"] == 3 and len(r["totals"]) == len(r["years"])
    for t in r["topics"]:
        assert t["total"] == sum(t["per_year"])
        assert t["recent"] == sum(t["per_year"][-3:])
    zs = [t["z"] for t in r["topics"]]
    assert zs == sorted(zs, reverse=True)


def test_skewed_demo_topic_is_detected():
    # The demo generator deliberately makes "Onboard AI" more common in recent years.
    by_name = {t["topic"]: t for t in client.get("/trends").json()["topics"]}
    assert by_name["Onboard AI"]["status"] in {"emerging", "growing"}
    assert by_name["Onboard AI"]["slope"] > 0
```

```powershell
python -m pytest -q
```

You should see `17 passed`.

### Step 4 — The frontend call

**File:** `my_cosmos/frontend/src/api/trends.ts`

```ts
import { apiGet } from "./http";

export type TrendStatus = "emerging" | "growing" | "stable" | "declining";
export interface TopicTrend {
  topic: string;
  topic_id: string;
  per_year: number[];
  total: number;
  recent: number;
  growth: number;
  z: number;
  slope: number;
  status: TrendStatus;
}
export interface TrendReport { years: number[]; recent_years: number; corpus_growth: number; totals: number[]; topics: TopicTrend[] }

export const getTrends = (recentYears = 3) => apiGet<TrendReport>(`/trends?recent_years=${recentYears}`);
```

### Step 5 — A tiny trend line

**File:** `my_cosmos/frontend/src/components/Sparkline.tsx`

```tsx
/** A small line of yearly counts, with a text summary for screen readers. */
export function Sparkline({ values, years }: { values: number[]; years: number[] }) {
  const w = 120, h = 28;
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-28" role="img"
      aria-label={`${values[0]} papers in ${years[0]}, ${values[values.length - 1]} in ${years[years.length - 1]}`}>
      <polyline points={points} fill="none" stroke="#7a68b8" strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}
```

### Step 6 — The Trends page

**File:** `my_cosmos/frontend/src/pages/TrendsPage.tsx`

```tsx
import { Link } from "react-router-dom";
import { getTrends, type TopicTrend, type TrendStatus } from "../api/trends";
import { AsyncView } from "../components/AsyncView";
import { NeedsApi } from "../components/NeedsApi";
import { Sparkline } from "../components/Sparkline";
import { GlassCard, SectionHeader } from "../components/ui";
import { useAsync } from "../hooks/useAsync";

const LABELS: Record<TrendStatus, string> = {
  emerging: "Emerging topic signal",
  growing: "Increasing activity",
  stable: "Stable",
  declining: "Declining in this corpus",
};

function Column({ title, items, years }: { title: string; items: TopicTrend[]; years: number[] }) {
  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-700">{title} <span className="text-navy-500">{items.length}</span></h3>
      {items.length === 0 ? <p className="mt-3 text-sm text-navy-500">No topics in this band.</p> : (
        <ul className="mt-3 space-y-3">
          {items.slice(0, 6).map((t) => (
            <li key={t.topic_id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <Link to={`/papers?topic=${encodeURIComponent(t.topic)}`} className="truncate font-medium hover:text-violet-600">{t.topic}</Link>
                <span className="shrink-0 tabular-nums text-navy-500">×{t.growth.toFixed(2)} · z {t.z.toFixed(1)}</span>
              </div>
              <Sparkline values={t.per_year} years={years} />
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function Report() {
  const state = useAsync(() => getTrends(3), []);
  return (
    <AsyncView state={state} loading="Analyzing research…">
      {(r) => {
        const by = (s: TrendStatus) => r.topics.filter((t) => t.status === s);
        return (
          <div className="space-y-14">
            <details className="glass p-4 text-sm text-navy-700">
              <summary className="cursor-pointer font-semibold">How these signals are computed</summary>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>Recent window: the last {r.recent_years} years. Everything earlier is the baseline.</li>
                <li>The whole corpus publishes ×{r.corpus_growth.toFixed(2)} as many papers per year recently. Topic growth is measured relative to that.</li>
                <li>z = (recent papers − expected) ÷ √expected. With many topics tested at once, a few signals can appear by chance.</li>
                <li>These describe <b>this corpus</b> only. Growth here is not evidence that a field is more important.</li>
              </ul>
            </details>

            <section>
              <SectionHeader eyebrow="Signals" title="Emerging, increasing and declining" />
              <div className="grid gap-4 md:grid-cols-3">
                <Column title="Emerging topic signals" items={by("emerging")} years={r.years} />
                <Column title="Increasing activity" items={by("growing")} years={r.years} />
                <Column title="Declining in this corpus" items={[...by("declining")].reverse()} years={r.years} />
              </div>
            </section>

            <section>
              <SectionHeader eyebrow="All topics" title="Trend statistics" />
              <div className="glass overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">Trend statistics per topic</caption>
                  <thead className="border-b border-lavender-100 text-xs uppercase tracking-wider text-navy-500">
                    <tr>
                      <th scope="col" className="px-3 py-3">Topic</th>
                      <th scope="col" className="px-3 py-3">Signal</th>
                      <th scope="col" className="px-3 py-3 text-right">Papers</th>
                      <th scope="col" className="px-3 py-3 text-right">Recent</th>
                      <th scope="col" className="px-3 py-3 text-right">Growth ×</th>
                      <th scope="col" className="px-3 py-3 text-right">Slope /yr</th>
                      <th scope="col" className="px-3 py-3 text-right">z</th>
                      <th scope="col" className="px-3 py-3">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.topics.map((t) => (
                      <tr key={t.topic_id} className="border-b border-lavender-50 last:border-0 hover:bg-lavender-50/60">
                        <th scope="row" className="px-3 py-2 font-medium">{t.topic}</th>
                        <td className="px-3 py-2">{LABELS[t.status]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.total}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.recent}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.growth.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.slope > 0 ? "+" : ""}{t.slope.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.z.toFixed(2)}</td>
                        <td className="px-3 py-1"><Sparkline values={t.per_year} years={r.years} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        );
      }}
    </AsyncView>
  );
}

export function TrendsPage() {
  return (
    <div className="container-cosmos py-10">
      <p className="eyebrow">Research evolution</p>
      <h1 className="mb-8 mt-1 text-3xl font-semibold">How the research is changing</h1>
      <NeedsApi feature="Trend analysis"><Report /></NeedsApi>
    </div>
  );
}
```

### Step 7 — Add the route

**File:** `my_cosmos/frontend/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { AppShell } from "./layouts/AppShell";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { ExplorePage } from "./pages/ExplorePage";
import { MapPage } from "./pages/MapPage";
import { PaperPage } from "./pages/PaperPage";
import { PapersPage } from "./pages/PapersPage";
import { SearchPage } from "./pages/SearchPage";
import { TrendsPage } from "./pages/TrendsPage";

const soon = (title: string, lesson: string) => <ComingSoonPage title={title} lesson={lesson} />;

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <ExplorePage /> },
      { path: "/papers", element: <PapersPage /> },
      { path: "/papers/:id", element: <PaperPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/map", element: <MapPage /> },
      { path: "/trends", element: <TrendsPage /> },
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

- [ ] `python -m pytest -q` prints `17 passed`.
- [ ] `/trends` shows three columns. **Onboard AI** is near the top of the emerging column.
- [ ] The "How these signals are computed" box opens and closes.
- [ ] The table lists all 38 topics, each with a small trend line.
- [ ] No sentence on the page claims a topic is "important" or "the future".

## What just happened?

- `per_year(...)` turned a list of papers into counts per year (`[4, 6, 3, …]`).
- Dividing by `corpus_growth` removed "everything is growing" from each topic's growth. Without it, 15 of the 38 demo topics would look "emerging". With it, about 7 do.
- The z-score stopped tiny topics from shouting: going from 1 to 3 papers is a big ratio but a small z.
- `<details>` / `<summary>` is a built-in HTML fold-out. No JavaScript needed.

## Try it yourself

1. Remove `/ corpus_growth` from the `growth` line and from `expected`. Count the emerging topics. Then put it back. This is why normalising matters.
2. Change the API call to `getTrends(5)`. Which topics change status?
3. In the finished COSMOS, the Trends page also has a multi-topic line chart and heatmaps (`frontend/src/pages/TrendsPage.tsx`). Which one would you add first?

## If it does not work

| Problem | Fix |
|---|---|
| `ZeroDivisionError` | Your corpus has too few years for the window. The `max(1, min(...))` line guards this; check it's there. |
| `test_skewed_demo_topic_is_detected` fails | You're on different data (Lesson 18). That test is only for the demo corpus. |

---

**Next:** [16_RESEARCH_OPPORTUNITIES.md](16_RESEARCH_OPPORTUNITIES.md)
