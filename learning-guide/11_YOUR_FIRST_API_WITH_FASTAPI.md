# Lesson 11 — Your First API with FastAPI

**Time:** 40 minutes | **You need:** Lessons 02 and 10 finished

## Goal

By the end of this lesson:

- a Python **API** answers the same questions as the mock adapter (`/stats`, `/papers`…),
- you can read and try every endpoint in the automatic **API docs** at `/docs`,
- the website can switch to the API with **zero changes** to any page (the **http adapter**),
- your first **automated tests** pass.

## Understand

### Why move work to a server at all?

The mock adapter downloads all 1,500 papers into every visitor's browser. That's fine for 1,500, but the real corpus is 10,000+ papers, and the NLP (search indexes, embeddings) needs Python libraries that don't run in a browser. So the heavy lifting moves to an **API** on a server, and the browser only receives the small answers it asks for.

### What is FastAPI?

**FastAPI** is a Python framework for building APIs. You write a normal function and put a **decorator** on it that says which address runs it:

```python
@router.get("/stats")
def stats():
    return {"papers": 1500}
```

Visiting `http://localhost:8020/stats` runs the function and sends back `{"papers": 1500}` as JSON. **Uvicorn** is the small web server that runs it.

### Pydantic: types for Python

**Pydantic** models describe the shape of data, like TypeScript interfaces:

```python
class Stats(BaseModel):
    papers: int
    synthetic: bool
```

Put `response_model=Stats` on an endpoint, and FastAPI checks the answer and documents it at `/docs`.

### Routers

As the API grows, one file would get huge. An **APIRouter** groups related endpoints in their own file. `main.py` just includes each router. In later lessons, each NLP feature gets its own router file.

### CORS: why the browser needs permission

The website (`localhost:5174`) and the API (`localhost:8020`) count as different **origins**. For safety, browsers block one origin from reading another's answers unless the API says it's allowed. That permission is **CORS**. We allow our two website addresses only.

### Automated tests

A **test** is code that checks your code. `pytest` finds functions named `test_...` and runs them. FastAPI's `TestClient` calls your endpoints without starting a server.

## Do it now

### Step 1 — Create the backend folder and its virtual environment

Open a **new terminal** (Terminal → New Terminal). It starts in `space-research->`.

```powershell
mkdir my_cosmos\backend
```

```powershell
cd my_cosmos\backend
```

```powershell
python -m venv .venv
```

```powershell
.venv\Scripts\Activate.ps1
```

The line now starts with `(.venv)` and ends with `backend>`.

### Step 2 — The package list

**File:** `my_cosmos/backend/requirements.txt`

```text
fastapi==0.115.0
uvicorn==0.30.6
pydantic==2.9.2
numpy==1.26.4
scikit-learn==1.5.2
httpx==0.27.2
pytest==8.3.3
```

`numpy` and `scikit-learn` are for the NLP lessons. `httpx` is needed by `TestClient`.

```powershell
python -m pip install --upgrade pip
```

```powershell
pip install -r requirements.txt
```

### Step 3 — Give the API its own copy of the data

```powershell
mkdir data
```

```powershell
Copy-Item ..\..\data\mock\papers.json data\
```

```powershell
Copy-Item ..\..\data\mock\taxonomy.json data\
```

### Step 4 — Load the corpus

Create the folder `app` inside `backend`, and in it an **empty** file called `__init__.py`. It tells Python "this folder is a package".

**File:** `my_cosmos/backend/app/__init__.py`

```python
```

**File:** `my_cosmos/backend/app/corpus.py`

```python
"""Loads the fixed research corpus once, when the API starts. No scraping, no daily downloads."""
import json
import os
import re
from pathlib import Path

# Lesson 18 points this at real data with the COSMOS_DATA_DIR environment variable.
DATA_DIR = Path(os.getenv("COSMOS_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))


def slug(text: str) -> str:
    """'Computer Vision' -> 'computer-vision' (safe for ids and addresses)."""
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", text.lower()))


class Corpus:
    def __init__(self, folder: Path):
        self.papers: list[dict] = json.loads((folder / "papers.json").read_text(encoding="utf-8"))
        self.taxonomy: dict = json.loads((folder / "taxonomy.json").read_text(encoding="utf-8"))
        self.by_id = {p["paper_id"]: p for p in self.papers}
        self.topics = [t for d in self.taxonomy["domains"] for t in d["topics"]]
        years = [p["publication_year"] for p in self.papers]
        self.years = list(range(min(years), max(years) + 1))


# Loaded once, shared by every endpoint.
CORPUS = Corpus(DATA_DIR)
```

### Step 5 — The paper endpoints

These do exactly what the mock adapter does, but in Python.

**File:** `my_cosmos/backend/app/papers_api.py`

```python
"""Endpoints for corpus statistics and browsing papers. Mirrors the frontend's DataSource contract."""
from collections import Counter
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.corpus import CORPUS

router = APIRouter(tags=["papers"])


class Stats(BaseModel):
    papers: int
    countries: int
    topics: int
    organizations: int
    year_from: int
    year_to: int
    synthetic: bool


def count_values(values) -> list[dict]:
    """How often each value appears, most common first."""
    return [{"value": v, "count": n} for v, n in Counter(values).most_common()]


@router.get("/stats", response_model=Stats)
def stats():
    ps = CORPUS.papers
    return Stats(
        papers=len(ps),
        countries=len({p["country"] for p in ps if p["country"]}),
        topics=len({t for p in ps for t in p["derived"]["topics"]}),
        organizations=len({o for p in ps for o in p["organizations"]}),
        year_from=CORPUS.years[0],
        year_to=CORPUS.years[-1],
        synthetic=any(p["is_synthetic"] for p in ps),
    )


@router.get("/taxonomy")
def taxonomy():
    return {"domains": CORPUS.taxonomy["domains"], "countries": CORPUS.taxonomy["countries"]}


@router.get("/domains")
def domains():
    return [
        {**d, "paper_count": sum(1 for p in CORPUS.papers if set(p["derived"]["topics"]) & set(d["topics"]))}
        for d in CORPUS.taxonomy["domains"]
    ]


@router.get("/countries")
def countries():
    out = []
    for c in CORPUS.taxonomy["countries"]:
        mine = [p for p in CORPUS.papers if p["country"] == c["name"]]
        top = Counter(t for p in mine for t in p["derived"]["topics"]).most_common(3)
        out.append({**c, "paper_count": len(mine), "top_topics": [t for t, _ in top]})
    return sorted(out, key=lambda c: -c["paper_count"])


# Fixed addresses must come BEFORE "/papers/{paper_id}", or FastAPI would treat "recent" as an id.
@router.get("/papers/recent")
def recent(limit: int = Query(6, ge=1, le=50)):
    return sorted(CORPUS.papers, key=lambda p: p["publication_date"], reverse=True)[:limit]


@router.get("/papers/facets")
def facets():
    return {
        "topics": count_values(t for p in CORPUS.papers for t in p["derived"]["topics"]),
        "countries": count_values(p["country"] for p in CORPUS.papers if p["country"]),
    }


@router.get("/papers")
def query_papers(
    q: str = "",
    topic: Optional[str] = None,
    country: Optional[str] = None,
    sort: Literal["newest", "oldest", "title"] = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    words = q.lower().split()
    rows = [
        p for p in CORPUS.papers
        if (not topic or topic in p["derived"]["topics"])
        and (not country or p["country"] == country)
        and all(w in f"{p['title']} {p['abstract']}".lower() for w in words)
    ]
    if sort == "title":
        rows.sort(key=lambda p: p["title"])
    else:
        rows.sort(key=lambda p: p["publication_date"], reverse=(sort == "newest"))
    start = (page - 1) * page_size
    return {"items": rows[start:start + page_size], "total": len(rows), "page": page, "page_size": page_size}


@router.get("/papers/{paper_id}")
def get_paper(paper_id: str):
    paper = CORPUS.by_id.get(paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper
```

### Step 6 — The app

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API. Run from my_cosmos/backend:  uvicorn app.main:app --reload --port 8020"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import papers_api

app = FastAPI(title="My COSMOS API")

# Let our website (and only our website) read the API's answers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers_api.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

### Step 7 — Run the API

```powershell
uvicorn app.main:app --reload --port 8020
```

You should see `Uvicorn running on http://127.0.0.1:8020` and `Application startup complete`.

Open these in your browser:

- http://localhost:8020/stats → `{"papers":1500,"countries":14,...}`
- http://localhost:8020/papers?topic=Computer%20Vision&page_size=2
- **http://localhost:8020/docs** → the automatic API documentation. Open `/papers`, click **Try it out**, fill in `country` = `India`, click **Execute**.

### Step 8 — Write your first tests

Leave the API running. Open a **second terminal**, then:

```powershell
cd my_cosmos\backend
```

```powershell
.venv\Scripts\Activate.ps1
```

Create the folder `tests`.

**File:** `my_cosmos/backend/tests/test_papers.py`

```python
"""Tests for the paper endpoints. Run from my_cosmos/backend:  python -m pytest -q"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_stats_match_the_corpus():
    s = client.get("/stats").json()
    assert s["papers"] == 1500
    assert s["year_from"] <= s["year_to"]
    assert s["synthetic"] is True  # demo data must say so


def test_filters_really_filter():
    r = client.get("/papers", params={"country": "India", "topic": "Computer Vision"}).json()
    assert r["total"] > 0
    for p in r["items"]:
        assert p["country"] == "India"
        assert "Computer Vision" in p["derived"]["topics"]


def test_unknown_paper_is_404():
    assert client.get("/papers/does-not-exist").status_code == 404
```

```powershell
python -m pytest -q
```

You should see `4 passed`.

### Step 9 — Teach the website to talk to the API

Go to the **frontend** terminal (or open a new one and `cd my_cosmos\frontend`).

**File:** `my_cosmos/frontend/src/api/http.ts`

```ts
import type { DataSource } from "./dataSource";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8020";

/** GET a JSON answer from the API, or throw a clear error. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

/** POST some JSON to the API and read the JSON answer. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

/** Keeps the same DataSource contract as the mock adapter, by asking the API. */
export const httpSource: DataSource = {
  getStats: () => apiGet("/stats"),
  getTaxonomy: () => apiGet("/taxonomy"),
  getDomains: () => apiGet("/domains"),
  getCountries: () => apiGet("/countries"),
  getRecentPapers: (limit) => apiGet(`/papers/recent?limit=${limit}`),
  getFacets: () => apiGet("/papers/facets"),
  queryPapers: (query) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiGet(`/papers?${params}`);
  },
  getPaper: async (id) => {
    const res = await fetch(`${BASE}/papers/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  },
};
```

**File:** `my_cosmos/frontend/src/api/index.ts`

```ts
import type { DataSource } from "./dataSource";
import { httpSource } from "./http";
import { mockSource } from "./mock";

/** "mock" = demo files in the browser; "api" = the FastAPI server. Set with VITE_DATA_MODE. */
export const DATA_MODE = import.meta.env.VITE_DATA_MODE === "api" ? "api" : "mock";

/** The single door to all data. Pages import this, never an adapter. */
export const api: DataSource = DATA_MODE === "api" ? httpSource : mockSource;
```

Now a settings file for "API mode".

**File:** `my_cosmos/frontend/.env.api`

```text
VITE_DATA_MODE=api
VITE_API_URL=http://localhost:8020
```

Add a script that starts the website in API mode on port 5174:

```powershell
npm pkg set "scripts.dev:api=vite --mode api --port 5174 --strictPort"
```

### Step 10 — Run the website in API mode

Stop any running frontend server (Ctrl + C), then:

```powershell
npm run dev:api
```

Open **http://localhost:5174**. Then press **F12 → Network** and reload: you'll see requests to `localhost:8020/stats`, `/domains`, `/countries`…

## Check

- [ ] http://localhost:8020/docs lists all the endpoints.
- [ ] `python -m pytest -q` prints `4 passed`.
- [ ] http://localhost:5174 looks **the same** as before, but the Network tab shows calls to port 8020.
- [ ] Stop the API (Ctrl + C in its terminal) and reload 5174: the page shows "Couldn't reach the research universe" instead of breaking.
- [ ] `npm run dev` (port 5173) still works with demo files and no API.

## What just happened?

- **Uvicorn** started the server; `--reload` restarts it whenever you save a Python file.
- `CORPUS = Corpus(DATA_DIR)` ran **once** when the API started. Every request reuses the loaded papers.
- `limit: int = Query(6, ge=1, le=50)`: FastAPI converted `?limit=4` from text to a number and refused values outside 1–50 with a clear error.
- `npm run dev:api` → `vite --mode api` loaded `.env.api`, so `VITE_DATA_MODE` was `"api"` and `index.ts` picked the http adapter. **Not one page changed.** That is the data source pattern paying off.

### Every time you come back to work (backend)

```powershell
cd my_cosmos\backend
```

```powershell
.venv\Scripts\Activate.ps1
```

```powershell
uvicorn app.main:app --reload --port 8020
```

## Try it yourself

1. In `/docs`, try `/papers` with `page_size` = `500`. What happens, and why? (`le=100`.)
2. Add an endpoint `GET /years` that returns `{"years": [...]}` with every year in the corpus. Then write a test for it.
3. Remove `"http://localhost:5174"` from CORS, reload 5174, and read the red CORS error in the console. Put it back.

## If it does not work

| Problem | Fix |
|---|---|
| `uvicorn` is not recognized | `.venv` isn't active (no `(.venv)` at the start of the line). Run `.venv\Scripts\Activate.ps1`. |
| `ModuleNotFoundError: No module named 'app'` | Run from `my_cosmos\backend` (where the `app` folder is), not from inside `app`. |
| `FileNotFoundError: ...papers.json` | Step 3 wasn't done in `my_cosmos\backend`. |
| `Address already in use` / `[WinError 10048]` | Another server uses 8020. Close it, or use `--port 8021` and change `.env.api` to match. |
| Console: `blocked by CORS policy` | The website's address isn't in `allow_origins`. Use exactly `http://localhost:5174`. |
| `npm run dev:api` says `Port 5174 is already in use` | Another site (often the finished COSMOS) is on 5174. Stop it first. `--strictPort` makes Vite stop here instead of silently moving to 5175, where CORS would block every request. |
| pip fails building `numpy` | You're on Python 3.13. Create the venv with Python 3.12: `py -3.12 -m venv .venv`. |

---

**Next:** [12_SEMANTIC_SEARCH.md](12_SEMANTIC_SEARCH.md)
