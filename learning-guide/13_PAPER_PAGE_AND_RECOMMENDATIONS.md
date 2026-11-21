# Lesson 13 — Paper Page and Recommendations

**Time:** 35 minutes | **You need:** Lesson 12 finished

## Goal

By the end of this lesson:

- every paper has its own page: title, authors, venue, abstract, and what COSMOS understood (topics, methods, technologies, missions),
- the page recommends **related research** in three different kinds:

| Kind | Meaning |
|---|---|
| **Very similar** | Close in meaning and shares most of the paper's topics |
| **Related** | Shares a topic or an entity, but uses a **different method** — another approach to a similar problem |
| **Adjacent** | Shares **no** topic, but sits in a neighbouring field — the kind of paper that sparks new ideas |

- every recommendation explains itself: "Shares topic: Computer Vision", "Different approach: Optimal Control".

## Understand

### Why not just "the most similar papers"?

If you only rank by similarity, all recommendations look like copies of the paper you're reading. The spec says: *"Do not rely only on cosine similarity… Have different recommendation types."* A researcher reading about autonomous navigation may find **sensor fusion** or **planetary robotics** papers more useful than ten near-duplicates.

### The signals

For the paper you're reading (P) and every other paper (C) we compute:

| Signal | How | 0 → 1 |
|---|---|---|
| semantic | cosine of their LSA embeddings (from Lesson 12) | unrelated → same meaning |
| topic | **Jaccard** overlap of topic sets | no shared topics → identical |
| entity | Jaccard overlap of methods + technologies + missions | |
| time | `1 − |year difference| / 5` | 5+ years apart → same year |

**Jaccard** = shared items ÷ all items. Topics {A, B} and {B, C}: shared {B} = 1, all {A, B, C} = 3 → 0.33.

### Sorting papers into the three kinds

```
shares ≥ half of P's topics                 → very similar
else shares a topic or entity, AND no method in common → related
else shares no topic, but has a "neighbouring" topic   → adjacent
```

**Neighbouring topics** are topics that often appear **together** on papers in the corpus (counted once at startup). Each kind has its own ranking formula, and we keep the top 6 of each.

## Do it now

**Check first:** API terminal has `(.venv)` and ends with `backend>`.

### Step 1 — The recommender

**File:** `my_cosmos/backend/app/recommend.py`

```python
"""Paper recommendations in three kinds: very similar, related (other approach), adjacent (neighbouring field)."""
from collections import Counter

import numpy as np
from fastapi import APIRouter, HTTPException

from app.corpus import CORPUS
from app.search import ENGINE

router = APIRouter(tags=["recommendations"])
PER_KIND = 6


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a or b else 0.0


def entities(p: dict) -> set:
    d = p["derived"]
    return set(d["methods"]) | set(d["technologies"]) | set(d["missions"])


def topic_neighbours(papers: list[dict], per_topic: int = 5) -> dict[str, set[str]]:
    """For each topic, the topics that most often appear on the same papers."""
    together: dict[str, Counter] = {}
    for p in papers:
        topics = sorted(set(p["derived"]["topics"]))
        for a in topics:
            for b in topics:
                if a != b:
                    together.setdefault(a, Counter())[b] += 1
    return {t: {x for x, _ in c.most_common(per_topic)} for t, c in together.items()}


NEIGHBOURS = topic_neighbours(CORPUS.papers)
INDEX = {p["paper_id"]: i for i, p in enumerate(CORPUS.papers)}


def reasons(p: dict, c: dict, kind: str, near: set[str]) -> list[str]:
    """Plain-language reasons, built only from facts about the two papers."""
    out = [f"Shares topic: {t}" for t in sorted(set(p["derived"]["topics"]) & set(c["derived"]["topics"]))]
    if kind == "adjacent":
        out += [f"Neighbouring field: {t}" for t in sorted(set(c["derived"]["topics"]) & near)]
    out += [f"Same mission: {m}" for m in sorted(set(p["derived"]["missions"]) & set(c["derived"]["missions"]))]
    out += [f"Also uses {t}" for t in sorted(set(p["derived"]["technologies"]) & set(c["derived"]["technologies"]))]
    pm, cm = set(p["derived"]["methods"]), set(c["derived"]["methods"])
    if pm and cm and not pm & cm:
        out.append(f"Different approach: {', '.join(sorted(cm))}")
    if abs(p["publication_year"] - c["publication_year"]) <= 1:
        out.append("Published within a year")
    return out[:4]


def recommend(paper_id: str) -> dict:
    i = INDEX[paper_id]
    p = CORPUS.papers[i]
    sims = np.clip(ENGINE.vectors @ ENGINE.vectors[i], 0, 1)  # semantic similarity to every paper
    topics, ents, methods = set(p["derived"]["topics"]), entities(p), set(p["derived"]["methods"])
    near = set().union(*(NEIGHBOURS.get(t, set()) for t in topics)) - topics

    kinds: dict[str, list] = {"very_similar": [], "related": [], "adjacent": []}
    for j, c in enumerate(CORPUS.papers):
        if j == i:
            continue
        ct, ce = set(c["derived"]["topics"]), entities(c)
        sig = {
            "semantic": float(sims[j]),
            "topic": jaccard(topics, ct),
            "entity": jaccard(ents, ce),
            "time": max(0.0, 1 - abs(p["publication_year"] - c["publication_year"]) / 5),
        }
        shared = topics & ct
        if len(shared) >= max(1, len(topics) / 2):
            score = 0.6 * sig["semantic"] + 0.25 * sig["topic"] + 0.1 * sig["entity"] + 0.05 * sig["time"]
            kinds["very_similar"].append((score, j, sig))
        elif (shared or ents & ce) and not methods & set(c["derived"]["methods"]):
            score = 0.35 * sig["semantic"] + 0.3 * sig["topic"] + 0.3 * sig["entity"] + 0.05 * sig["time"]
            kinds["related"].append((score, j, sig))
        elif not shared and ct & near:
            score = 0.5 * sig["semantic"] + 0.3 * len(ct & near) / len(ct) + 0.2 * sig["entity"]
            kinds["adjacent"].append((score, j, sig))

    out = {}
    for kind, items in kinds.items():
        items.sort(key=lambda x: -x[0])
        out[kind] = [{
            "paper": CORPUS.papers[j],
            "score": round(100 * score),
            "signals": {name: round(100 * value) for name, value in sig.items()},
            "reasons": reasons(p, CORPUS.papers[j], kind, near),
        } for score, j, sig in items[:PER_KIND]]
    return out


@router.get("/recommendations/{paper_id}")
def recommendations(paper_id: str):
    if paper_id not in INDEX:
        raise HTTPException(status_code=404, detail="Paper not found")
    return recommend(paper_id)
```

### Step 2 — Switch it on

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API. Run from my_cosmos/backend:  uvicorn app.main:app --reload --port 8020"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import papers_api, recommend, search

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


@app.get("/health")
def health():
    return {"status": "ok"}
```

### Step 3 — Test the three kinds really differ

**File:** `my_cosmos/backend/tests/test_recommend.py`

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_three_kinds_follow_their_rules():
    src = client.get("/papers/demo-00100").json()
    r = client.get("/recommendations/demo-00100").json()
    assert r["very_similar"] and r["related"] and r["adjacent"]

    ids = [x["paper"]["paper_id"] for kind in r.values() for x in kind]
    assert "demo-00100" not in ids, "never recommend the paper itself"
    assert len(ids) == len(set(ids)), "a paper appears in only one kind"

    topics, methods = set(src["derived"]["topics"]), set(src["derived"]["methods"])
    assert all(topics & set(x["paper"]["derived"]["topics"]) for x in r["very_similar"])
    assert all(not methods & set(x["paper"]["derived"]["methods"]) for x in r["related"])
    assert all(not topics & set(x["paper"]["derived"]["topics"]) for x in r["adjacent"])
    assert all(x["reasons"] for kind in r.values() for x in kind)


def test_unknown_paper_is_404():
    assert client.get("/recommendations/nope").status_code == 404
```

```powershell
python -m pytest -q
```

You should see `10 passed`.

### Step 4 — The frontend call

**File:** `my_cosmos/frontend/src/api/recommend.ts`

```ts
import type { Paper } from "../types";
import { apiGet } from "./http";

export type RecommendationKind = "very_similar" | "related" | "adjacent";
export interface Recommendation {
  paper: Paper;
  score: number;
  signals: { semantic: number; topic: number; entity: number; time: number };
  reasons: string[];
}
export type Recommendations = Record<RecommendationKind, Recommendation[]>;

export const getRecommendations = (paperId: string) =>
  apiGet<Recommendations>(`/recommendations/${encodeURIComponent(paperId)}`);
```

### Step 5 — The paper page

The paper itself loads through `api` (works in both modes). Recommendations need the API, so they sit inside `NeedsApi`.

**File:** `my_cosmos/frontend/src/pages/PaperPage.tsx`

```tsx
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { getRecommendations, type RecommendationKind } from "../api/recommend";
import { AsyncView } from "../components/AsyncView";
import { NeedsApi } from "../components/NeedsApi";
import { Chip, EmptyState, GlassCard, SectionHeader } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import type { Paper } from "../types";

const KINDS: { kind: RecommendationKind; label: string; blurb: string }[] = [
  { kind: "very_similar", label: "Very similar", blurb: "Close in meaning and sharing most of this paper's topics." },
  { kind: "related", label: "Related", blurb: "Shared topics or entities, but a different research method." },
  { kind: "adjacent", label: "Adjacent", blurb: "Neighbouring fields: topics that often appear alongside this paper's." },
];

function Understanding({ p }: { p: Paper }) {
  const rows: [string, string[], "topic" | "method" | "entity" | "signal"][] = [
    ["Topics", p.derived.topics, "topic"],
    ["Methods", p.derived.methods, "method"],
    ["Technologies", p.derived.technologies, "entity"],
    ["Missions", p.derived.missions, "signal"],
  ];
  return (
    <GlassCard className="p-6">
      <p className="eyebrow">COSMOS understands this paper as</p>
      <dl className="mt-4 space-y-3">
        {rows.filter(([, values]) => values.length > 0).map(([label, values, tone]) => (
          <div key={label} className="flex flex-wrap items-center gap-2">
            <dt className="w-28 text-xs font-semibold uppercase tracking-wider text-navy-500">{label}</dt>
            <dd className="flex flex-wrap gap-1.5">{values.map((v) => <Chip key={v} tone={tone}>{v}</Chip>)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-navy-500">These tags come from the NLP pipeline, kept apart from the original metadata.</p>
    </GlassCard>
  );
}

function Related({ id }: { id: string }) {
  const state = useAsync(() => getRecommendations(id), [id]);
  const [tab, setTab] = useState<RecommendationKind>("very_similar");
  return (
    <AsyncView state={state} loading="Connecting the knowledge…">
      {(r) => (
        <div>
          <div role="tablist" className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button key={k.kind} role="tab" type="button" aria-selected={tab === k.kind} onClick={() => setTab(k.kind)}
                className={`rounded-full px-4 py-1.5 text-sm ${tab === k.kind ? "bg-violet-500 text-white" : "bg-white/60 hover:bg-white"}`}>
                {k.label} <span className="opacity-70">{r[k.kind].length}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-navy-500">{KINDS.find((k) => k.kind === tab)?.blurb}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {r[tab].length === 0 && <EmptyState title="No strong connection found." />}
            {r[tab].map((x) => (
              <GlassCard key={x.paper.paper_id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/papers/${x.paper.paper_id}`} className="font-semibold leading-snug hover:text-violet-600">{x.paper.title}</Link>
                  <span className="shrink-0 rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-semibold text-violet-600">{x.score}%</span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {x.reasons.map((reason) => <li key={reason} className="rounded-full bg-white/80 px-2 py-0.5">{reason}</li>)}
                </ul>
                <p className="mt-2 text-xs tabular-nums text-navy-500">
                  semantic {x.signals.semantic} · topic {x.signals.topic} · entity {x.signals.entity} · time {x.signals.time}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </AsyncView>
  );
}

export function PaperPage() {
  const { id = "" } = useParams();
  const paper = useAsync(() => api.getPaper(id), [id]);
  return (
    <AsyncView state={paper} loading="Opening the paper…">
      {(p) => !p ? (
        <div className="container-cosmos py-16"><EmptyState title="This paper isn't in the corpus." /></div>
      ) : (
        <article className="container-cosmos space-y-12 py-10">
          <header>
            <Link to="/papers" className="text-sm text-navy-500 hover:text-violet-600">← Papers</Link>
            {p.is_synthetic && (
              <p role="note" className="mt-3 w-fit rounded-xl bg-blush-100 px-3 py-1.5 text-sm">
                Synthetic demo record: not a real paper.
              </p>
            )}
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight sm:text-4xl">{p.title}</h1>
            <p className="mt-3 text-navy-700">{p.authors.join(", ")}</p>
            <p className="mt-2 text-sm text-navy-500">
              {p.publication_date} · {p.journal ?? p.conference ?? "Unknown venue"} · {p.country ?? "Country unknown"} · {p.doi ? `DOI ${p.doi}` : "No DOI"}
            </p>
          </header>
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <section>
              <h2 className="eyebrow">Abstract</h2>
              <p className="mt-3 text-lg leading-relaxed text-navy-700">{p.abstract}</p>
            </section>
            <Understanding p={p} />
          </div>
          <section>
            <SectionHeader eyebrow="Related research" title="Where to read next"
              description="Ranked by meaning together with topic, entity and time overlap, not by text similarity alone." />
            <NeedsApi feature="Recommendations"><Related id={p.paper_id} /></NeedsApi>
          </section>
        </article>
      )}
    </AsyncView>
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
import { PaperPage } from "./pages/PaperPage";
import { PapersPage } from "./pages/PapersPage";
import { SearchPage } from "./pages/SearchPage";

const soon = (title: string, lesson: string) => <ComingSoonPage title={title} lesson={lesson} />;

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <ExplorePage /> },
      { path: "/papers", element: <PapersPage /> },
      { path: "/papers/:id", element: <PaperPage /> },
      { path: "/search", element: <SearchPage /> },
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

- [ ] `python -m pytest -q` prints `10 passed`.
- [ ] http://localhost:5174/papers/demo-00100 shows the paper, the "synthetic" note and the "understands this paper as" box.
- [ ] Three tabs each show up to 6 recommendations with reasons.
- [ ] Clicking a recommended paper opens **its** page, with new recommendations.
- [ ] `/papers/nope` shows "This paper isn't in the corpus."

## What just happened?

- `ENGINE.vectors @ ENGINE.vectors[i]` reused the Lesson 12 embeddings: one line gives the similarity to all 1,500 papers.
- `if / elif / elif` puts each paper into **at most one** kind, so the tabs never repeat a paper.
- Each kind has its **own ranking formula**: "very similar" trusts meaning most, "related" trusts shared topics and entities, "adjacent" trusts neighbouring fields.
- The reasons are built only from facts both papers really have. No invented explanations.
- `type RecommendationKind` in `import { getRecommendations, type RecommendationKind }` imports just the type: it disappears from the final JavaScript.

## Try it yourself

1. Change `PER_KIND` to 3. What changes on the page?
2. Add a reason "Same country: …" when both papers share an affiliation country.
3. Open two "Adjacent" recommendations. Do they feel like useful side-steps or random? What signal could make adjacent results better?

## If it does not work

| Problem | Fix |
|---|---|
| `ImportError: cannot import name 'ENGINE'` | `search.py` from Lesson 12 is missing or renamed. |
| Recommendations take a second | They loop over every paper. Fine for 1,500; the finished COSMOS does the same for 12,000 in ~40 ms. |
| Page stuck on "Opening the paper…" | F12 → Console. In API mode, the API must be running. |

---

**Next:** [14_THE_KNOWLEDGE_GRAPH.md](14_THE_KNOWLEDGE_GRAPH.md)
