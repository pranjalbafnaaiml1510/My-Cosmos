# Lesson 16 — Research Opportunities

**Time:** 40 minutes | **You need:** Lesson 15 finished

## Goal

By the end of this lesson:

- the API scores every **pair of topics** (Computer Vision × Space Robotics, …) and finds pairs that are **semantically close but rarely studied together**,
- each signal comes with its evidence: papers, a typical count for comparison, recent activity, and four component scores,
- the website shows them as cards, and **every card** says: *"This is a corpus-derived discovery signal, not a validated research gap."*

## Understand

### The idea

Two topics that are **close in meaning** usually appear together on many papers. If a close pair shares **unusually few** papers, that small overlap might be an opening worth a human look. Or the combination might be useless, studied under another name, or simply missing from this corpus. That's why the wording is careful.

The spec: *"This should NOT claim to automatically discover scientifically validated research gaps."*

### The four components (each 0 → 1)

| Component | Question | How |
|---|---|---|
| **closeness** | Are the two topics close in meaning? | cosine of the two topics' **centroids** (average embedding of their papers), using only papers **outside** their overlap |
| **gap** | Is the overlap small *for topics this close*? | a regression line, see below |
| **momentum** | Is the overlap growing faster than the corpus? | like Lesson 15, but only trusted from 3 papers, fully from 8 |
| **foundation** | Are both parent topics established? | size of the smaller parent ÷ size of the largest topic |

`score = 0.4·closeness + 0.35·gap + 0.15·momentum + 0.1·foundation`

### Why centroids "outside the overlap"?

If we averaged **all** of each topic's papers, the shared papers would pull the two centroids together. Then closeness would just be "they share papers" again — a circular argument. Using only the non-shared papers asks: *are these topics close even apart from each other?*

### The gap: comparing like with like

What overlap should two topics have? Bigger topics naturally share more papers, and closer topics do too. So:

1. **Independence count** = `|A| × |B| ÷ N`: what you'd expect if the topics had nothing to do with each other. It adjusts for topic sizes.
2. For **every** pair, compute `log((overlap + ½) ÷ independence)` and plot it against closeness.
3. Fit a straight line (**linear regression**, `numpy.polyfit`). The line says what is **typical** at each closeness.
4. A pair **below** the line has a smaller overlap than is typical for pairs that close. The further below (measured in standard deviations), the bigger the gap.

This turns "small" into "small **compared with similar pairs**", which is a fairer question.

### Evidence thresholds

A trend computed from 1 or 2 papers is noise. So momentum is 0 below 3 papers and reaches full weight only at 8. Pairs with fewer than 3 papers are labelled **"too few papers"**: honest about thin evidence.

## Do it now

### Step 1 — The opportunity finder

**File:** `my_cosmos/backend/app/opportunities.py`

```python
"""Research opportunities: topic pairs that are close in meaning but share few papers.
Corpus-derived discovery signals for human investigation, NOT validated research gaps."""
from itertools import combinations

import numpy as np
from fastapi import APIRouter, Query

from app.corpus import CORPUS, slug
from app.search import ENGINE
from app.trends import per_year

router = APIRouter(tags=["opportunities"])

DISCLAIMER = "This is a corpus-derived discovery signal, not a validated research gap."
MIN_PARENT = 20          # both topics need at least this many papers
MIN_MOMENTUM_PAPERS = 3  # below this, a trend is noise
FULL_EVIDENCE = 8        # momentum counts fully from this many papers
WINDOW = 3               # recent years
WEIGHTS = {"closeness": 0.4, "gap": 0.35, "momentum": 0.15, "foundation": 0.1}

MEMBERS = {t: {i for i, p in enumerate(CORPUS.papers) if t in p["derived"]["topics"]} for t in CORPUS.topics}


def centroid(indices: set[int]):
    """Average embedding of some papers, scaled to length 1 (None if there are none)."""
    if not indices:
        return None
    v = ENGINE.vectors[sorted(indices)].mean(axis=0)
    n = np.linalg.norm(v)
    return v / n if n else None


def compute() -> list[dict]:
    papers, years = CORPUS.papers, CORPUS.years
    n_base = len(years) - WINDOW
    totals = per_year(papers)
    corpus_growth = (sum(totals[n_base:]) / WINDOW) / (sum(totals[:n_base]) / n_base)
    topics = [t for t in CORPUS.topics if len(MEMBERS[t]) >= MIN_PARENT]
    biggest = max(len(MEMBERS[t]) for t in topics)

    rows = []
    for a, b in combinations(topics, 2):
        A, B = MEMBERS[a], MEMBERS[b]
        both = A & B
        ca, cb = centroid(A - both), centroid(B - both)
        counts = per_year([papers[i] for i in both])
        base, recent = sum(counts[:n_base]), sum(counts[n_base:])
        if len(both) < MIN_MOMENTUM_PAPERS:
            momentum, mom = "too few papers", 0.0
        elif base == 0:
            momentum, mom = "new", 1.0
        else:
            ratio = ((recent / WINDOW) / (base / n_base)) / corpus_growth
            momentum = "increasing" if ratio >= 1.25 else "decreasing" if ratio <= 0.8 else "steady"
            mom = min(1.0, max(0.0, (ratio - 0.5) / 1.5))
        rows.append({
            "a": a, "b": b, "both": both, "counts": counts, "recent": recent, "momentum": momentum,
            "close": float(ca @ cb) if ca is not None and cb is not None else 0.0,
            "indep": len(A) * len(B) / len(papers),
            "mom": mom * min(1.0, len(both) / FULL_EVIDENCE),
            "found": min(len(A), len(B)) / biggest,
        })

    # Regression across ALL pairs: what overlap is typical at each closeness?
    close = np.array([r["close"] for r in rows])
    y = np.array([np.log((len(r["both"]) + 0.5) / r["indep"]) for r in rows])
    beta, alpha = np.polyfit(close, y, 1)
    fitted = alpha + beta * close
    sd = float(np.std(y - fitted)) or 1.0
    lo, hi = close.min(), close.max()

    out = []
    for k, r in enumerate(rows):
        parts = {
            "closeness": float((r["close"] - lo) / (hi - lo)) if hi > lo else 0.0,
            "gap": float(min(1.0, max(0.0, -(y[k] - fitted[k]) / (2 * sd)))),
            "momentum": r["mom"],
            "foundation": r["found"],
        }
        newest_first = sorted(r["both"], key=lambda i: papers[i]["publication_date"], reverse=True)
        out.append({
            "id": f"{slug(r['a'])}|{slug(r['b'])}",
            "topic_a": r["a"], "topic_b": r["b"],
            "papers": len(r["both"]),
            "typical": round(max(0.0, float(np.exp(fitted[k]) * r["indep"] - 0.5)), 1),
            "recent": r["recent"], "momentum": r["momentum"], "per_year": r["counts"],
            "score": round(100 * sum(WEIGHTS[name] * value for name, value in parts.items())),
            "components": {name: round(100 * value) for name, value in parts.items()},
            "sample_paper_ids": [papers[i]["paper_id"] for i in newest_first[:5]],
        })
    return sorted(out, key=lambda o: -o["score"])


# The corpus is fixed, so we score every pair once at startup.
OPPORTUNITIES = compute()


@router.get("/opportunities")
def opportunities(limit: int = Query(24, ge=1, le=200), min_papers: int = Query(1, ge=1)):
    """Under-explored intersections: overlap below what is typical for topics this close."""
    items = [o for o in OPPORTUNITIES if o["components"]["gap"] > 0 and o["papers"] >= min_papers]
    return {"disclaimer": DISCLAIMER, "total": len(items), "items": items[:limit]}
```

### Step 2 — Switch it on

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API. Run from my_cosmos/backend:  uvicorn app.main:app --reload --port 8020"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import graph, opportunities, papers_api, recommend, search, trends

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
app.include_router(opportunities.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

### Step 3 — Tests

**File:** `my_cosmos/backend/tests/test_opportunities.py`

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_every_signal_follows_the_rules():
    r = client.get("/opportunities", params={"limit": 200}).json()
    assert r["disclaimer"].endswith("not a validated research gap.")
    assert r["items"]
    for o in r["items"]:
        assert o["components"]["gap"] > 0, "only overlaps below what is typical"
        assert o["papers"] == sum(o["per_year"])
        assert all(0 <= v <= 100 for v in o["components"].values())
        if o["papers"] < 3:
            assert o["momentum"] == "too few papers" and o["components"]["momentum"] == 0
    scores = [o["score"] for o in r["items"]]
    assert scores == sorted(scores, reverse=True)


def test_sample_papers_really_combine_both_topics():
    o = client.get("/opportunities").json()["items"][0]
    p = client.get(f"/papers/{o['sample_paper_ids'][0]}").json()
    assert {o["topic_a"], o["topic_b"]} <= set(p["derived"]["topics"])
```

```powershell
python -m pytest -q
```

You should see `19 passed`.

### Step 4 — The frontend call

**File:** `my_cosmos/frontend/src/api/opportunities.ts`

```ts
import { apiGet } from "./http";

export interface Opportunity {
  id: string;
  topic_a: string;
  topic_b: string;
  papers: number;
  /** overlap that is typical for topic pairs this close */
  typical: number;
  recent: number;
  momentum: "new" | "increasing" | "steady" | "decreasing" | "too few papers";
  per_year: number[];
  score: number;
  components: { closeness: number; gap: number; momentum: number; foundation: number };
  sample_paper_ids: string[];
}
export interface OpportunityReport { disclaimer: string; total: number; items: Opportunity[] }

export const getOpportunities = (minPapers = 1) => apiGet<OpportunityReport>(`/opportunities?min_papers=${minPapers}`);
```

### Step 5 — The Opportunities page

The sentence on each card is built **only from the card's own numbers**, so it can never claim more than the evidence.

**File:** `my_cosmos/frontend/src/pages/OpportunitiesPage.tsx`

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { getOpportunities, type Opportunity } from "../api/opportunities";
import { AsyncView } from "../components/AsyncView";
import { NeedsApi } from "../components/NeedsApi";
import { Chip, EmptyState, GlassCard } from "../components/ui";
import { useAsync } from "../hooks/useAsync";

function explain(o: Opportunity): string {
  const n = o.papers === 1 ? "1 paper combines" : `${o.papers} papers combine`;
  return `These topics are semantically close, yet only ${n} them, fewer than the ~${o.typical.toFixed(1)} typical for topic pairs this close. This intersection appears relatively small within the current corpus and may be worth further human investigation.`;
}

function Card({ o, disclaimer }: { o: Opportunity; disclaimer: string }) {
  const bars: [string, number][] = [
    ["Closeness", o.components.closeness], ["Gap", o.components.gap],
    ["Momentum", o.components.momentum], ["Foundation", o.components.foundation],
  ];
  return (
    <GlassCard className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-tight">
          {o.topic_a} <span className="text-violet-500">×</span> {o.topic_b}
        </h3>
        <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-semibold text-violet-600">{o.score}</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {([["Papers", String(o.papers)], ["Typical", `~${o.typical.toFixed(1)}`], ["Last 3 yrs", String(o.recent)]] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/60 p-2">
            <dt className="text-[11px] text-navy-500">{label}</dt>
            <dd className="font-display text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="signal">{o.momentum === "too few papers" ? "Too few papers to judge a trend" : `Momentum: ${o.momentum}`}</Chip>
        {o.papers < 3 && <Chip tone="entity">Thin evidence</Chip>}
      </div>
      <p className="text-sm leading-relaxed text-navy-700">{explain(o)}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {bars.map(([label, value]) => (
          <div key={label}>
            <div className="flex justify-between text-[11px] text-navy-500"><span>{label}</span><span className="tabular-nums">{value}</span></div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-lavender-100"><div className="h-full rounded-full bg-lavender-400" style={{ width: `${value}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link to={`/papers/${o.sample_paper_ids[0]}`} className="rounded-full bg-white/80 px-3 py-1 text-violet-600 hover:bg-white">Newest paper combining both</Link>
        <Link to={`/search?q=${encodeURIComponent(`${o.topic_a} ${o.topic_b}`)}`} className="rounded-full bg-white/80 px-3 py-1 text-violet-600 hover:bg-white">Search both</Link>
      </div>
      <p className="mt-auto text-xs italic text-navy-500">{disclaimer}</p>
    </GlassCard>
  );
}

function Signals() {
  const [minPapers, setMinPapers] = useState(1);
  const state = useAsync(() => getOpportunities(minPapers), [minPapers]);
  return (
    <>
      <label className="mt-6 flex items-center gap-2 text-sm">Minimum papers in the overlap
        <select value={minPapers} onChange={(e) => setMinPapers(Number(e.target.value))} className="rounded-lg border border-lavender-100 bg-white/70 px-2 py-1">
          {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="mt-6">
        <AsyncView state={state} loading="Analyzing research…">
          {(r) => (
            <>
              <p className="mb-4 text-xs text-navy-500">{r.total} signals. "Typical" = the overlap a regression across all topic pairs predicts for this closeness.</p>
              {r.items.length === 0
                ? <EmptyState title="No signals match." hint="Lower the minimum papers." />
                : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{r.items.map((o) => <Card key={o.id} o={o} disclaimer={r.disclaimer} />)}</div>}
            </>
          )}
        </AsyncView>
      </div>
    </>
  );
}

export function OpportunitiesPage() {
  return (
    <div className="container-cosmos py-10">
      <p className="eyebrow">Research opportunities</p>
      <h1 className="mt-1 text-3xl font-semibold">Where might research go next?</h1>
      <GlassCard className="mt-6 bg-blush-100/60 p-4 text-sm text-navy-700">
        <p className="font-semibold">This is a corpus-derived discovery signal, not a validated research gap.</p>
        <p className="mt-1">A small intersection can be a genuine opening, but it can also mean the combination isn't useful, is studied under other names, or falls outside this corpus. Read the papers before drawing conclusions.</p>
      </GlassCard>
      <NeedsApi feature="Research opportunities"><Signals /></NeedsApi>
    </div>
  );
}
```

### Step 6 — Add the route

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
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
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
      { path: "/opportunities", element: <OpportunitiesPage /> },
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

- [ ] `python -m pytest -q` prints `19 passed`.
- [ ] `/opportunities` shows the disclaimer box at the top and on every card.
- [ ] Every card's **Papers** number is lower than its **Typical** number.
- [ ] Cards with 1–2 papers say "Too few papers to judge a trend" and "Thin evidence".
- [ ] Setting "Minimum papers" to 3 leaves very few cards on demo data. That's expected: see below.

## What just happened?

- At startup the API compared every pair of established topics (about 700 pairs): centroid closeness, overlap, regression, momentum.
- `np.polyfit(close, y, 1)` fitted the line `y = alpha + beta × closeness` through all pairs. A pair's distance **below** that line, measured in standard deviations, became its **gap**.
- The page only listed pairs **below** the line. Pairs that share **more** papers than typical aren't under-explored, however close they are.

**Why so few signals with 3+ papers?** The demo corpus is small (1,500 papers), so most well-evidenced overlaps are *over*-represented, not under. With the real 10,000+ papers this changes. Also, the demo abstracts are templates, so topics with similar **names** (Satellite Technology × Satellite Communication) look closer than they really are. Real abstracts fix most of that.

## Try it yourself

1. Set `MIN_MOMENTUM_PAPERS = 1` and reload. Which cards jump to the top? Why is that a bad idea? (One recent paper = "momentum 100%".) Put it back.
2. The finished COSMOS also has a **Growing intersections** view: small overlaps with rising activity. Can you add a `lens=growing` option to the endpoint? (Hint: `papers >= 3` and momentum `"increasing"` or `"new"`.)
3. Find the sentence "may be worth further human investigation". Why do you think the spec wanted exactly this kind of wording?

## If it does not work

| Problem | Fix |
|---|---|
| API start takes ~5 seconds | Normal: ~700 pairs are scored once at startup. |
| `ValueError` from `max()` | No topic has 20+ papers (only possible with tiny data). Lower `MIN_PARENT`. |
| All gaps are 0 | Check the sign in `-(y[k] - fitted[k])`: below the line must be **positive**. |

---

**Next:** [17_THE_RESEARCH_ASSISTANT.md](17_THE_RESEARCH_ASSISTANT.md)
