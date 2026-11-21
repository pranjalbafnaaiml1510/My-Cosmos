# Lesson 12 — Semantic Search

**Time:** 45 minutes | **You need:** Lesson 11 finished (API runs, `(.venv)` active)

## Goal

By the end of this lesson:

- the API understands questions like *"AI techniques for detecting spacecraft faults"*,
- it finds relevant papers even when they don't use the exact same words,
- every result **explains** why it matched: semantic 62, keyword 89, topic 100, entity 0,
- the website has a **Search** page that shows all of this.

## Understand

This is the most important NLP lesson. Take your time.

> **Want to play with these ideas first?** Parts 1–5 of the companion notebook [`notebooks/NLP_BASICS.ipynb`](notebooks/NLP_BASICS.ipynb) show every step below on five toy sentences you can read in full.

### Step A: turn text into numbers

Computers can't compare sentences, but they can compare **lists of numbers** (vectors). So the first step is to turn every paper into a vector.

### TF-IDF: important words get big numbers

**TF-IDF** gives each word in a paper a score:

- **TF (term frequency):** the word appears often in *this* paper → higher score,
- **IDF (inverse document frequency):** the word appears in *many* papers ("the", "study") → lower score.

So "fault" in a fault-detection paper scores high; "paper" scores almost nothing. Each paper becomes a long vector with one number per word in the whole corpus — thousands of numbers, mostly zero.

Before counting, we **clean** the words:

| Step | Example |
|---|---|
| lowercase + split | "Detecting Faults!" → `detecting`, `faults` |
| remove stop words | "the", "of", "and" disappear |
| **stem** (cut endings) | `detecting` → `detect`, `faults` → `fault`, `detection` → `detect` |
| add word pairs (bigrams) | `fault detect` |

Stemming is why "detecting faults" can match "fault detection".

### LSA: from words to meaning

TF-IDF only matches **identical** words. **LSA (Latent Semantic Analysis)** squeezes those thousands of word-numbers down to 128 numbers per paper, using a maths technique called **SVD**. Words that often appear **together** ("optical", "camera", "navigation") end up pointing in similar directions. Now two texts can be close even when they share few exact words.

These 128-number vectors are called **embeddings**. (The finished COSMOS can also use neural embeddings from a model called sentence-transformers. Same idea, smarter numbers.)

### Cosine similarity: how close are two vectors?

Imagine each vector as an arrow. **Cosine similarity** measures the angle between two arrows:

- `1.0` → same direction (very similar meaning),
- `0.0` → unrelated.

To search, we embed the question the same way and compare it with every paper's embedding.

### Hybrid ranking: four signals, not one

A single similarity score can be fooled, so each paper gets four scores:

| Signal | Question it answers | Weight |
|---|---|---|
| **semantic** | Is the meaning close? (LSA cosine) | 50% |
| **keyword** | Does it share the important words? (TF-IDF cosine) | 20% |
| **topic** | Is it tagged with the topics we think the question is about? | 20% |
| **entity** | Does it use a method/technology/mission the question names? | 10% |

`overall = 0.5·semantic + 0.2·keyword + 0.2·topic + 0.1·entity`. Papers scoring under 18 are dropped.

### Interpreting the question

Before ranking, we guess which **topics** the question is about by comparing it with each topic name (embedding similarity plus shared stems). *"AI techniques for detecting spacecraft faults"* → **Fault Detection**. This is shown to the user as "Interpreted as…", so they can see how the system understood them.

### Never a meaningless score

The spec says: *"Never show a meaningless score alone. Instead of 'Score: 0.913' show RELEVANCE 91% with semantic / topic / entity match."* That's why every result carries its four parts.

## Do it now

**Check first:** API terminal has `(.venv)` and ends with `backend>`.

### Step 1 — The search engine

**File:** `my_cosmos/backend/app/search.py`

```python
"""Semantic search: TF-IDF + LSA embeddings, a hybrid ranking, and an explanation for every result."""
import re

import numpy as np
from fastapi import APIRouter, Query
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer

from app.corpus import CORPUS

router = APIRouter(tags=["search"])

TOKEN = re.compile(r"[a-z0-9]+")
SUFFIXES = ("ations", "ation", "ions", "ion", "ings", "ing", "ers", "er", "ies", "es", "ed", "s")
# Words that say how a question is asked, not what it is about.
QUESTION_WORDS = {"what", "how", "which", "used", "using", "techniques", "research", "researchers",
                  "working", "being", "make", "becoming", "space", "spacecraft"}
WEIGHTS = {"semantic": 0.5, "keyword": 0.2, "topic": 0.2, "entity": 0.1}
MIN_SCORE = 18  # below this a paper is not a match


def stem(word: str) -> str:
    """Cut a common ending: detecting -> detect, faults -> fault, detection -> detect."""
    for suffix in SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)] + ("y" if suffix == "ies" else "")
    return word


def analyze(text: str) -> list[str]:
    """Words for TF-IDF: lowercase, no stop words, stemmed, plus neighbouring pairs."""
    words = [stem(w) for w in TOKEN.findall(text.lower()) if w not in ENGLISH_STOP_WORDS and len(w) > 1]
    return words + [f"{a} {b}" for a, b in zip(words, words[1:])]


def key_terms(text: str) -> set[str]:
    """The stemmed content words of a question or a label."""
    return {stem(w) for w in TOKEN.findall(text.lower())
            if len(w) > 2 and w not in ENGLISH_STOP_WORDS and w not in QUESTION_WORDS}


def paper_text(p: dict) -> str:
    d = p["derived"]
    return " ".join([p["title"], p["abstract"], *d["topics"], *d["methods"], *d["technologies"], *d["missions"]])


def unit(m: np.ndarray) -> np.ndarray:
    """Scale every row to length 1, so a dot product is the cosine similarity."""
    n = np.linalg.norm(m, axis=1, keepdims=True)
    return m / np.where(n == 0, 1, n)


class SearchEngine:
    def __init__(self, papers: list[dict], topics: list[str], dims: int = 128):
        self.papers, self.topics = papers, topics
        texts = [paper_text(p) for p in papers]
        # 1. TF-IDF: one long, mostly-zero vector per paper (rows already have length 1).
        self.tfidf = TfidfVectorizer(analyzer=analyze, sublinear_tf=True)
        self.sparse = self.tfidf.fit_transform(texts)
        # 2. LSA: squeeze to `dims` numbers per paper. Words that appear together end up close.
        k = max(2, min(dims, self.sparse.shape[1] - 1, len(papers) - 1))
        self.svd = TruncatedSVD(n_components=k, random_state=0)
        self.vectors = unit(self.svd.fit_transform(self.sparse))
        self.topic_vectors = self.embed(topics)
        self.entity_terms = [key_terms(" ".join(p["derived"]["methods"] + p["derived"]["technologies"] + p["derived"]["missions"]))
                             for p in papers]

    def embed(self, texts: list[str]) -> np.ndarray:
        """LSA embeddings for new text, in the same space as the papers."""
        return unit(self.svd.transform(self.tfidf.transform(texts)))

    def interpret(self, query: str, qv: np.ndarray, k: int = 4) -> list[str]:
        """Which taxonomy topics is the question about? Meaning (60%) + shared words (40%)."""
        q = key_terms(query)
        scored = []
        for topic, sim in zip(self.topics, self.topic_vectors @ qv):
            t = key_terms(topic)
            shared = len(t & q) / len(t) if t else 0.0
            scored.append((0.6 * float(sim) + 0.4 * shared, topic))
        scored.sort(reverse=True)
        best = scored[0][0] if scored else 0.0
        return [topic for score, topic in scored[:k] if score >= 0.3 and score >= 0.6 * best]

    def search(self, query: str) -> tuple[list[str], list[dict]]:
        qv = self.embed([query])[0]
        interpretation = self.interpret(query, qv)
        q = key_terms(query)
        semantic = np.clip(self.vectors @ qv, 0, 1)
        keyword = (self.sparse @ self.tfidf.transform([query]).T).toarray().ravel()
        keyword = keyword / (keyword.max() or 1)  # best keyword match = 1.0

        results = []
        for i, p in enumerate(self.papers):
            on_topics = [t for t in interpretation if t in p["derived"]["topics"]]
            parts = {
                "semantic": float(semantic[i]),
                "keyword": float(keyword[i]),
                "topic": len(on_topics) / len(interpretation) if interpretation else 0.0,
                "entity": min(1.0, len(q & self.entity_terms[i]) / len(q)) if q else 0.0,
            }
            overall = round(100 * sum(WEIGHTS[name] * value for name, value in parts.items()))
            if overall < MIN_SCORE:
                continue
            things = p["derived"]["methods"] + p["derived"]["technologies"] + p["derived"]["missions"]
            concepts = on_topics + [x for x in things if key_terms(x) & q]
            results.append({"index": i, "relevance": {
                "overall": overall,
                **{name: round(100 * value) for name, value in parts.items()},
                "matched_concepts": list(dict.fromkeys(concepts))[:4],
            }})
        results.sort(key=lambda r: -r["relevance"]["overall"])
        return interpretation, results


# Built once when the API starts (takes a second or two).
ENGINE = SearchEngine(CORPUS.papers, CORPUS.topics)


@router.get("/search")
def search(q: str = Query(..., min_length=1, max_length=500), limit: int = Query(20, ge=1, le=100)):
    interpretation, results = ENGINE.search(q)
    return {
        "query": q,
        "interpretation": interpretation,
        "total": len(results),
        "results": [{"paper": CORPUS.papers[r["index"]], "relevance": r["relevance"]} for r in results[:limit]],
    }
```

### Step 2 — Switch it on

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API. Run from my_cosmos/backend:  uvicorn app.main:app --reload --port 8020"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import papers_api, search

app = FastAPI(title="My COSMOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers_api.router)
app.include_router(search.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

Try it: http://localhost:8020/search?q=AI%20techniques%20for%20detecting%20spacecraft%20faults

### Step 3 — Test that search is actually good

A test can check **quality**, not just "it runs".

**File:** `my_cosmos/backend/tests/test_search.py`

```python
from fastapi.testclient import TestClient

from app.main import app
from app.search import key_terms, stem

client = TestClient(app)


def test_stemming_joins_word_forms():
    assert stem("detecting") == stem("detection") == "detect"
    assert key_terms("detecting spacecraft faults") == {"detect", "fault"}


def test_question_is_interpreted_and_explained():
    r = client.get("/search", params={"q": "AI techniques for detecting spacecraft faults"}).json()
    assert "Fault Detection" in r["interpretation"]
    first = r["results"][0]["relevance"]
    assert {"overall", "semantic", "keyword", "topic", "entity", "matched_concepts"} <= first.keys()
    scores = [x["relevance"]["overall"] for x in r["results"]]
    assert scores == sorted(scores, reverse=True)


def test_top_results_are_on_topic():
    r = client.get("/search", params={"q": "AI techniques for detecting spacecraft faults", "limit": 10}).json()
    on_topic = sum("Fault Detection" in x["paper"]["derived"]["topics"] for x in r["results"])
    assert on_topic >= 7, f"only {on_topic}/10 top results are about fault detection"


def test_nonsense_finds_nothing():
    assert client.get("/search", params={"q": "zzzz qqqq"}).json()["total"] == 0
```

```powershell
python -m pytest -q
```

You should see `8 passed`.

### Step 4 — A banner for features that need the API

Semantic search runs only on the API. In demo mode (port 5173) the page should explain this instead of failing.

**File:** `my_cosmos/frontend/src/components/NeedsApi.tsx`

```tsx
import type { ReactNode } from "react";
import { DATA_MODE } from "../api";
import { EmptyState, GlassCard } from "./ui";

/** Shows `children` only in API mode; in demo mode, explains how to switch. */
export function NeedsApi({ feature, children }: { feature: string; children: ReactNode }) {
  if (DATA_MODE === "api") return <>{children}</>;
  return (
    <GlassCard className="mt-8">
      <EmptyState title={`${feature} runs on the API.`}
        hint="Start the API (Lesson 11), then open the site with npm run dev:api on port 5174." />
    </GlassCard>
  );
}
```

### Step 5 — Talk to `/search`

**File:** `my_cosmos/frontend/src/api/search.ts`

```ts
import type { Paper } from "../types";
import { apiGet } from "./http";

export interface Relevance {
  overall: number;
  semantic: number;
  keyword: number;
  topic: number;
  entity: number;
  matched_concepts: string[];
}
export interface SearchResult { paper: Paper; relevance: Relevance }
export interface SearchResponse { query: string; interpretation: string[]; total: number; results: SearchResult[] }

export const searchPapers = (q: string, limit = 20) =>
  apiGet<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`);
```

### Step 6 — Show the explanation

**File:** `my_cosmos/frontend/src/components/RelevanceBadge.tsx`

```tsx
import type { Relevance } from "../api/search";

/** RELEVANCE 69% plus the four signals as small bars. Never a bare score. */
export function RelevanceBadge({ r }: { r: Relevance }) {
  const rows: [string, number][] = [["Semantic", r.semantic], ["Keyword", r.keyword], ["Topic", r.topic], ["Entity", r.entity]];
  return (
    <div className="w-full shrink-0 rounded-xl bg-lavender-50 p-3 text-xs sm:w-52">
      <p className="font-semibold text-violet-600">RELEVANCE {r.overall}%</p>
      <dl className="mt-2 space-y-1">
        {rows.map(([name, value]) => (
          <div key={name} className="flex items-center gap-2">
            <dt className="w-16 text-navy-500">{name}</dt>
            <dd className="flex flex-1 items-center gap-1.5">
              <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-white">
                <span className="block h-full rounded-full bg-lavender-400" style={{ width: `${value}%` }} />
              </span>
              <span className="w-6 text-right tabular-nums">{value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

### Step 7 — The search page

**File:** `my_cosmos/frontend/src/pages/SearchPage.tsx`

```tsx
import { useSearchParams } from "react-router-dom";
import { searchPapers } from "../api/search";
import { AsyncView } from "../components/AsyncView";
import { NeedsApi } from "../components/NeedsApi";
import { PaperCard } from "../components/PaperCard";
import { RelevanceBadge } from "../components/RelevanceBadge";
import { SearchBar } from "../components/SearchBar";
import { Chip, EmptyState } from "../components/ui";
import { useAsync } from "../hooks/useAsync";

function Results({ q }: { q: string }) {
  const state = useAsync(() => searchPapers(q), [q]);
  return (
    <AsyncView state={state} loading="Searching the research universe…">
      {(r) => (
        <>
          <div className="mt-8">
            <p className="eyebrow">Search results</p>
            <h1 className="mt-1 text-2xl font-semibold">“{r.query}”</h1>
            {r.interpretation.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-navy-500">
                Interpreted as: {r.interpretation.map((t) => <Chip key={t}>{t}</Chip>)}
              </p>
            )}
            <p className="mt-2 text-sm tabular-nums text-navy-500">{r.total.toLocaleString()} matching papers</p>
          </div>
          <div className="mt-6 space-y-4">
            {r.results.length === 0
              ? <EmptyState title="No strong semantic connection found." hint="Try broader wording." />
              : r.results.map((x) => (
                <div key={x.paper.paper_id}>
                  <PaperCard paper={x.paper} aside={<RelevanceBadge r={x.relevance} />} />
                  {x.relevance.matched_concepts.length > 0 && (
                    <p className="ml-5 mt-1 text-xs text-navy-500">Why matched: {x.relevance.matched_concepts.join(" · ")}</p>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </AsyncView>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  return (
    <div className="container-cosmos py-10">
      <div className="max-w-2xl"><SearchBar key={q} initial={q} /></div>
      <NeedsApi feature="Semantic search">
        {q ? <Results q={q} /> : <EmptyState title="Ask a question to search the corpus." />}
      </NeedsApi>
    </div>
  );
}
```

### Step 8 — Add the route

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
import { SearchPage } from "./pages/SearchPage";

const soon = (title: string, lesson: string) => <ComingSoonPage title={title} lesson={lesson} />;

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <ExplorePage /> },
      { path: "/papers", element: <PapersPage /> },
      { path: "/papers/:id", element: soon("Paper page", "Lesson 13") },
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

### Step 9 — Try it

With the API running, start `npm run dev:api` and open http://localhost:5174. Click an example question on the Explore page.

## Check

- [ ] `python -m pytest -q` prints `8 passed`.
- [ ] Searching *AI techniques for detecting spacecraft faults* shows "Interpreted as: **Fault Detection**".
- [ ] Each result has a RELEVANCE box with four bars, plus a "Why matched" line.
- [ ] On port 5173 (demo mode) the Search page explains that it needs the API.

## What just happened?

1. When the API started, `SearchEngine(...)` turned 1,500 papers into TF-IDF vectors, then into 128-number LSA embeddings.
2. Your question went through **the same** `analyze` → TF-IDF → SVD steps, so it landed in the same "meaning space".
3. `self.vectors @ qv` multiplied a 1,500 × 128 table by a 128-number list. That's **1,500 cosine similarities in one line**, because every vector has length 1.
4. Four signals were mixed into one score, weak matches were dropped, and every result kept its parts so the UI could explain it.
5. The frontend only drew what the API said. All the intelligence lives on the server.

## Try it yourself

1. Search *"optical navigation for small bodies"*. Which topics does it interpret? Are the top results sensible?
2. Change `WEIGHTS` to make keyword 50% and semantic 20%. Re-run the tests: does `test_top_results_are_on_topic` still pass? Put it back.
3. Try `stem("missions")` in a Python shell (`python`, then `from app.search import stem`). What does it give? Can you find a word the stemmer handles badly?
4. Remember the demo abstracts are templates: real abstracts make semantic search far more interesting. Lesson 18 shows how to connect them.

## If it does not work

| Problem | Fix |
|---|---|
| API takes a few seconds to start | Normal: building the index takes a moment. Wait for `Application startup complete`. |
| `ModuleNotFoundError: sklearn` | `.venv` not active, or Lesson 11 Step 2 skipped. Activate, then `pip install -r requirements.txt`. |
| `test_top_results_are_on_topic` fails | Compare your `search.py` with Step 1, especially `SUFFIXES`, `QUESTION_WORDS` and `WEIGHTS`. |
| Search page says it "runs on the API" on port 5174 | `.env.api` missing or misspelled, so the site is in mock mode. It must be in `my_cosmos/frontend`. Restart `npm run dev:api`. |

---

**Next:** [13_PAPER_PAGE_AND_RECOMMENDATIONS.md](13_PAPER_PAGE_AND_RECOMMENDATIONS.md)
