# Lesson 14 — The Knowledge Graph

**Time:** 35 minutes | **You need:** Lesson 13 finished

## Goal

By the end of this lesson you will have a **Research Map**:

- it starts at **Space Research** with the ten domains around it,
- click a domain → its topics, top countries, missions, technologies and methods appear,
- click any of those → **its** strongest connections appear,
- a **trail** (Space Research › AI for Space › Computer Vision) lets you go back.

## Understand

### What is a knowledge graph?

A **graph** is dots and lines:

- **nodes** (dots) are things: topics, countries, missions, technologies, methods, domains,
- **edges** (lines) connect related things.

In COSMOS two things are connected when **the same papers mention both**. The line's **weight** is how many papers they share. If 18 papers are tagged both *Computer Vision* and *India*, the line between those two nodes has weight 18.

This is called a **co-occurrence graph**: it's built purely from counting, with no guessing.

### Entity ids

Every node gets an id `<kind>:<slug>`, so a topic and a mission with similar names never clash:

| Id | Node |
|---|---|
| `root` | Space Research (the starting point) |
| `domain:ai` | AI for Space |
| `topic:computer-vision` | Computer Vision |
| `country:india` | India |
| `method:deep-learning` | Deep Learning |

### Avoiding the "hairball"

Draw every node and every line at once and you get an unreadable **hairball** of hundreds of crossing lines. The spec says: *"Use progressive expansion: start with the selected node, show important relationships, let the user expand deeper."*

So the API returns only **one node's neighbourhood** at a time, and only the strongest few of each kind:

- at most **4 per kind** (4 countries, 4 methods, …),
- a **domain** expands into exactly its own topics.

### Drawing a radial layout

The current node sits in the middle, and its neighbours sit on an ellipse around it. To place neighbour number *i* of *n*:

```
angle = i / n × 360°
x = centreX + cos(angle) × radiusX
y = centreY + sin(angle) × radiusY
```

Bigger circles mean more papers. Thicker lines mean more shared papers.

## Do it now

### Step 1 — The graph

**File:** `my_cosmos/backend/app/graph.py`

```python
"""Knowledge graph: entities linked by the papers they share, expanded one node at a time."""
from collections import Counter, defaultdict

from fastapi import APIRouter, HTTPException

from app.corpus import CORPUS, slug

router = APIRouter(tags=["graph"])
PER_KIND = 4  # strongest neighbours kept per kind: keeps the map readable


def entities_of(p: dict) -> dict[str, tuple[str, str]]:
    """Every node a paper touches: id -> (kind, label)."""
    out = {}
    for t in p["derived"]["topics"]:
        out[f"topic:{slug(t)}"] = ("topic", t)
        for d in CORPUS.taxonomy["domains"]:
            if t in d["topics"]:
                out[f"domain:{d['id']}"] = ("domain", d["name"])
    if p["country"]:
        out[f"country:{slug(p['country'])}"] = ("country", p["country"])
    for kind, field in (("mission", "missions"), ("technology", "technologies"), ("method", "methods")):
        for value in p["derived"][field]:
            out[f"{kind}:{slug(value)}"] = (kind, value)
    return out


# Built once at startup: which entities each paper has, and which papers each entity has.
PAPER_ENTITIES = [entities_of(p) for p in CORPUS.papers]
META: dict[str, tuple[str, str]] = {}
PAPERS_OF: dict[str, list[int]] = defaultdict(list)
for i, ents in enumerate(PAPER_ENTITIES):
    for eid, meta in ents.items():
        META[eid] = meta
        PAPERS_OF[eid].append(i)


def node(eid: str) -> dict:
    if eid == "root":
        return {"id": "root", "kind": "root", "label": "Space Research", "paper_count": len(CORPUS.papers)}
    kind, label = META[eid]
    return {"id": eid, "kind": kind, "label": label, "paper_count": len(PAPERS_OF[eid])}


def neighbourhood(eid: str) -> dict:
    if eid == "root":
        domains = [node(f"domain:{d['id']}") for d in CORPUS.taxonomy["domains"] if f"domain:{d['id']}" in META]
        return {"center": node("root"), "neighbours": [{**d, "weight": d["paper_count"]} for d in domains]}

    center = node(eid)
    own_topics = set()
    if center["kind"] == "domain":
        domain = next(d for d in CORPUS.taxonomy["domains"] if f"domain:{d['id']}" == eid)
        own_topics = {f"topic:{slug(t)}" for t in domain["topics"]}

    # How many papers each other entity shares with this one.
    shared = Counter(x for i in PAPERS_OF[eid] for x in PAPER_ENTITIES[i] if x != eid)
    kept, neighbours = Counter(), []
    for x, weight in shared.most_common():
        kind = META[x][0]
        if center["kind"] == "domain" and kind in ("domain", "topic"):
            if x in own_topics:  # a domain expands into exactly its own topics
                neighbours.append({**node(x), "weight": weight})
            continue
        if kept[kind] < PER_KIND:
            kept[kind] += 1
            neighbours.append({**node(x), "weight": weight})
    return {"center": center, "neighbours": neighbours}


@router.get("/graph/{entity_id}")
def graph(entity_id: str):
    if entity_id != "root" and entity_id not in META:
        raise HTTPException(status_code=404, detail=f"No entity '{entity_id}'")
    return neighbourhood(entity_id)
```

### Step 2 — Switch it on

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API. Run from my_cosmos/backend:  uvicorn app.main:app --reload --port 8020"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import graph, papers_api, recommend, search

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


@app.get("/health")
def health():
    return {"status": "ok"}
```

Try it: http://localhost:8020/graph/root, then http://localhost:8020/graph/domain:ai

### Step 3 — Tests

**File:** `my_cosmos/backend/tests/test_graph.py`

```python
from collections import Counter

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_shows_domains():
    r = client.get("/graph/root").json()
    assert r["center"]["id"] == "root"
    assert {n["kind"] for n in r["neighbours"]} == {"domain"}


def test_domain_expands_into_its_own_topics():
    r = client.get("/graph/domain:ai").json()
    topics = {n["label"] for n in r["neighbours"] if n["kind"] == "topic"}
    assert topics == {"Machine Learning", "Computer Vision", "Fault Detection", "Mission Planning", "Onboard AI"}


def test_neighbours_are_capped_and_weighted():
    r = client.get("/graph/topic:computer-vision").json()
    per_kind = Counter(n["kind"] for n in r["neighbours"])
    assert all(count <= 4 for count in per_kind.values()), "at most 4 per kind: no hairball"
    assert all(0 < n["weight"] <= r["center"]["paper_count"] for n in r["neighbours"])


def test_unknown_entity_is_404():
    assert client.get("/graph/topic:nope").status_code == 404
```

```powershell
python -m pytest -q
```

You should see `14 passed`.

### Step 4 — The frontend call

**File:** `my_cosmos/frontend/src/api/graph.ts`

```ts
import { apiGet } from "./http";

export type GraphKind = "root" | "domain" | "topic" | "country" | "mission" | "technology" | "method";
export interface GraphNode { id: string; kind: GraphKind; label: string; paper_count: number }
/** A neighbour also says how many papers it shares with the centre. */
export interface GraphNeighbour extends GraphNode { weight: number }
export interface Neighbourhood { center: GraphNode; neighbours: GraphNeighbour[] }

export const getGraph = (entityId: string) => apiGet<Neighbourhood>(`/graph/${encodeURIComponent(entityId)}`);
```

### Step 5 — The Research Map page

**File:** `my_cosmos/frontend/src/pages/MapPage.tsx`

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { getGraph, type GraphKind, type GraphNode } from "../api/graph";
import { AsyncView } from "../components/AsyncView";
import { NeedsApi } from "../components/NeedsApi";
import { GlassCard } from "../components/ui";
import { useAsync } from "../hooks/useAsync";

const COLOURS: Record<GraphKind, string> = {
  root: "#7a68b8", domain: "#bfaeea", topic: "#d9cef5", country: "#c7d6ea",
  mission: "#f5cfdb", technology: "#c4eadb", method: "#e3f5ee",
};

/** Where "View papers" goes for kinds the research table can filter by. */
function papersLink(n: GraphNode): string | null {
  if (n.kind === "topic") return `/papers?topic=${encodeURIComponent(n.label)}`;
  if (n.kind === "country") return `/papers?country=${encodeURIComponent(n.label)}`;
  return null;
}

function Explorer() {
  // The path you clicked through. The last item is the node in the centre.
  const [trail, setTrail] = useState<{ id: string; label: string }[]>([{ id: "root", label: "Space Research" }]);
  const current = trail[trail.length - 1];
  const state = useAsync(() => getGraph(current.id), [current.id]);
  const go = (n: GraphNode) => setTrail((t) => [...t, { id: n.id, label: n.label }]);

  const W = 720, H = 440, cx = W / 2, cy = H / 2;

  return (
    <>
      <nav aria-label="Trail" className="mt-6 flex flex-wrap items-center gap-1 text-sm">
        {trail.map((step, k) => (
          <span key={step.id} className="flex items-center gap-1">
            {k > 0 && <span aria-hidden className="text-navy-500">›</span>}
            <button type="button" disabled={k === trail.length - 1} onClick={() => setTrail((t) => t.slice(0, k + 1))}
              className="rounded-full px-2 py-0.5 hover:bg-white disabled:font-semibold disabled:text-violet-600">
              {step.label}
            </button>
          </span>
        ))}
      </nav>

      <AsyncView state={state} loading="Mapping connections…">
        {(g) => {
          const maxCount = Math.max(1, ...g.neighbours.map((n) => n.paper_count));
          const maxWeight = Math.max(1, ...g.neighbours.map((n) => n.weight));
          const placed = g.neighbours.map((n, i) => {
            const angle = (i / g.neighbours.length) * Math.PI * 2 - Math.PI / 2;
            return { n, x: cx + Math.cos(angle) * 280, y: cy + Math.sin(angle) * 165, r: 8 + 16 * Math.sqrt(n.paper_count / maxCount) };
          });
          const link = papersLink(g.center);
          return (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
              <GlassCard className="p-2">
                <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={`Connections of ${g.center.label}`}>
                  {placed.map(({ n, x, y }) => (
                    <line key={`l-${n.id}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#bfaeea" strokeOpacity={0.7} strokeWidth={1 + 4 * (n.weight / maxWeight)} />
                  ))}
                  {placed.map(({ n, x, y, r }) => (
                    <g key={n.id} tabIndex={0} role="button" aria-label={`${n.kind} ${n.label}, ${n.weight} shared papers`}
                      className="cursor-pointer outline-none" onClick={() => go(n)}
                      onKeyDown={(e) => e.key === "Enter" && go(n)}>
                      <circle cx={x} cy={y} r={r} fill={COLOURS[n.kind]} stroke="white" strokeWidth={2} />
                      <text x={x} y={y + r + 13} textAnchor="middle" className="fill-navy-900 text-[11px]">
                        {n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label}
                      </text>
                    </g>
                  ))}
                  <circle cx={cx} cy={cy} r={34} fill={COLOURS[g.center.kind]} />
                  <text x={cx} y={cy + 4} textAnchor="middle" className="fill-navy-900 text-[11px] font-semibold">
                    {g.center.label.length > 16 ? `${g.center.label.slice(0, 15)}…` : g.center.label}
                  </text>
                </svg>
              </GlassCard>

              <GlassCard className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">{g.center.kind}</p>
                <h2 className="mt-1 text-xl font-semibold">{g.center.label}</h2>
                <p className="text-sm tabular-nums text-navy-500">{g.center.paper_count.toLocaleString()} papers</p>
                {link && <Link to={link} className="mt-3 inline-block rounded-full bg-violet-500 px-3 py-1.5 text-sm text-white">View papers</Link>}
                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-navy-500">Strongest connections</h3>
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                  {g.neighbours.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => go(n)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-lavender-50">
                        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOURS[n.kind] }} />
                        <span className="flex-1 truncate">{n.label}</span>
                        <span className="tabular-nums text-xs text-navy-500">{n.weight}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-navy-500">Numbers = papers shared with {g.center.label}.</p>
              </GlassCard>
            </div>
          );
        }}
      </AsyncView>
    </>
  );
}

export function MapPage() {
  return (
    <div className="container-cosmos py-10">
      <p className="eyebrow">Research map</p>
      <h1 className="mt-1 text-3xl font-semibold">The knowledge graph</h1>
      <p className="mt-2 max-w-2xl text-navy-500">
        Click a node to move to it and see its strongest connections. Bigger circle = more papers; thicker line = more shared papers.
      </p>
      <NeedsApi feature="The research map"><Explorer /></NeedsApi>
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
      { path: "/map", element: <MapPage /> },
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

- [ ] `python -m pytest -q` prints `14 passed`.
- [ ] `/map` opens on **Space Research** with ten domain circles.
- [ ] Click **AI for Space** → its five topics plus a few countries, missions, technologies and methods.
- [ ] Click **Computer Vision** → the trail reads `Space Research › AI for Space › Computer Vision`.
- [ ] Clicking **Space Research** in the trail goes back to the start.
- [ ] **Tab** moves between circles and **Enter** opens one (keyboard users can use the map).

## What just happened?

- At startup the API built two lookup tables: `PAPER_ENTITIES` (paper → its entities) and `PAPERS_OF` (entity → its papers).
- For one node, `Counter(...)` counted every other entity on that node's papers: that count **is** the edge weight.
- `most_common()` sorted them; `kept[kind] < PER_KIND` kept only the strongest 4 of each kind.
- The page asked for **one neighbourhood at a time**. Clicking added a step to `trail`, which changed `current.id`, which made `useAsync` fetch the next neighbourhood.
- The side list gives the same information as text: an **accessible fallback** for people who can't use the drawing.

## Try it yourself

1. Change `PER_KIND` to 8. Is the map still readable? Find the number that feels right.
2. Make the `technology` colour stronger in `COLOURS`.
3. The finished COSMOS uses a **force-directed** layout (the `d3-force` library) that keeps every expanded node on screen at once. Open `frontend/src/components/graph/KnowledgeGraph.tsx` in the course folder and compare.

## If it does not work

| Problem | Fix |
|---|---|
| `/graph/domain:ai` gives 404 | The domain id must match `taxonomy.json` (`"id": "ai"`). |
| Labels overlap | Long labels on a small screen. Make the window wider, or shorten labels further. |
| Clicking a circle does nothing | The click handler is on `<g>`. Check `onClick={() => go(n)}` is on the `<g>`, not the `<text>`. |

---

**Next:** [15_TRENDS_AND_EMERGING_TOPICS.md](15_TRENDS_AND_EMERGING_TOPICS.md)
