# Lesson 17 — The Research Assistant

**Time:** 45 minutes | **You need:** Lesson 16 finished

## Goal

By the end of this lesson COSMOS answers questions like *"What techniques are used to detect spacecraft faults?"*:

- it **retrieves** the most relevant papers (your Lesson 12 search),
- writes an answer using **only** those papers,
- puts a **citation** `[1]` `[2]` on every sentence; click one to highlight the source,
- says **"The corpus does not contain enough evidence to answer this."** when the papers don't cover the question,
- works **without any AI model** (free), and can optionally use **Claude**.

## Understand

### RAG: retrieval-augmented generation

A chatbot that answers from memory can confidently invent things. That's called **hallucinating**. COSMOS must never do that. So we use **RAG**:

```
question ──► 1. RETRIEVE the best papers (semantic search)
         ──► 2. GATE: is the evidence strong enough? If not, say so.
         ──► 3. GENERATE an answer from ONLY those papers, citing [n]
         ──► 4. VERIFY: every [n] must point at a real source
```

The spec: *"Never generate unsupported scientific claims. If the corpus does not contain enough evidence, say so."*

### The provider pattern (again!)

Remember the data source pattern from Lesson 08? Same idea for the "writer" of the answer. One **interface**, `generate(question, sources) → text`, and several **providers**:

| Provider | How it writes | Cost |
|---|---|---|
| **Extractive** (default) | Picks the sentences from the source abstracts that best match the question and quotes them **word for word**, each with its `[n]` | free, no AI, can't invent |
| **Claude** (optional) | An LLM writes a summary, under strict rules: only the sources, cite every claim | needs an API key, costs money |

The spec: *"Make the LLM layer provider-agnostic. Do not hardcode a single expensive provider."*

### The evidence gate

If the best retrieved paper scores below **35** (out of 100), the papers probably don't answer the question. We stop and say so, instead of stretching weak evidence into an answer.

### Verifying citations

Even a good model can make mistakes, such as citing `[7]` when there are only 4 sources. So after generating we:

1. **remove** citations that point at no source (and report them),
2. count how many sentences carry a citation,
3. if **no** valid citation is left, treat the answer as **not grounded**: "not enough evidence".

## Do it now

### Step 1 — The assistant

**File:** `my_cosmos/backend/app/assistant.py`

```python
"""Grounded research assistant: retrieve papers, answer ONLY from them, cite every sentence."""
import logging
import os
import re
from typing import Optional, Protocol

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.corpus import CORPUS
from app.search import ENGINE, analyze

router = APIRouter(tags=["assistant"])
log = logging.getLogger("assistant")

INSUFFICIENT = "The corpus does not contain enough evidence to answer this."
MIN_TOP = 35     # best source below this -> not enough evidence
MIN_SOURCE = 20  # weaker papers are not used as sources
CITE = re.compile(r"\[(\d+)\]")
INDEX = {p["paper_id"]: i for i, p in enumerate(CORPUS.papers)}

Source = tuple[int, dict]  # (citation number, paper)


class Provider(Protocol):
    name: str

    def generate(self, question: str, sources: list[Source]) -> str: ...


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 20]


class ExtractiveProvider:
    """No AI: quotes the best-matching sentences from the sources, word for word."""
    name = "extractive"

    def generate(self, question: str, sources: list[Source]) -> str:
        q = set(analyze(question))
        scored = []
        for n, paper in sources:
            for rank, sentence in enumerate(sentences(paper["abstract"])):
                overlap = len(q & set(analyze(sentence)))
                if overlap:
                    scored.append((overlap, -n, -rank, sentence, n))
        if not scored:
            return INSUFFICIENT
        scored.sort(reverse=True)
        picked, seen = [], set()
        for _, _, _, sentence, n in scored:
            if sentence not in seen:
                seen.add(sentence)
                picked.append(f"{sentence.rstrip('.')} [{n}].")
            if len(picked) == 4:
                break
        return " ".join(picked)


SYSTEM_PROMPT = f"""You answer questions about space-science research using ONLY the numbered sources provided.
- Every factual sentence must end with citations like [1] or [2][3].
- Use only information stated in the sources. Add no outside knowledge.
- If the sources do not address the question, reply with exactly: {INSUFFICIENT}
- Describe what the papers report, not what is true in general. At most about 150 words."""


class ClaudeProvider:
    """Optional: Claude writes the answer. Needs `pip install anthropic` and an ANTHROPIC_API_KEY."""

    def __init__(self, model: str):
        import anthropic  # imported only when this provider is chosen

        self.client = anthropic.Anthropic()
        self.model = model
        self.name = f"claude:{model}"

    def generate(self, question: str, sources: list[Source]) -> str:
        text = "\n\n".join(f"[{n}] {p['title']} ({p['publication_year']})\n{p['abstract']}" for n, p in sources)
        response = self.client.beta.messages.create(
            model=self.model,
            max_tokens=16000,
            output_config={"effort": "medium"},
            # If the model declines, the API retries on a suitable fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Sources:\n\n{text}\n\nQuestion: {question}"}],
        )
        if response.stop_reason == "refusal":
            return INSUFFICIENT
        return "".join(b.text for b in response.content if b.type == "text").strip()


PROVIDER: Provider = (ClaudeProvider(os.getenv("LLM_MODEL", "claude-opus-5-5"))
                      if os.getenv("LLM_PROVIDER") == "anthropic" else ExtractiveProvider())


def verify_citations(answer: str, n_sources: int) -> tuple[str, list[int], dict]:
    """Remove [n] that point at no source; count how much of the answer is cited."""
    valid = lambda n: 1 <= int(n) <= n_sources  # noqa: E731
    invalid = sorted({int(n) for n in CITE.findall(answer) if not valid(n)})
    clean = CITE.sub(lambda m: m.group(0) if valid(m.group(1)) else "", answer)
    clean = re.sub(r"\s+([.,;])", r"\1", clean).strip()
    parts = [s for s in re.split(r"(?<=[.!?])\s+", clean) if s.strip()]
    cited = sorted({int(n) for n in CITE.findall(clean)})
    grounding = {"sentences": len(parts), "cited_sentences": sum(1 for s in parts if CITE.search(s)), "invalid_citations": invalid}
    return clean, cited, grounding


def ask(question: str, paper_id: Optional[str] = None, top_k: int = 6) -> dict:
    interpretation, results = ENGINE.search(question)
    if paper_id is not None:  # a question about one paper uses only that paper
        i = INDEX[paper_id]
        picked = [(i, next((r["relevance"]["overall"] for r in results if r["index"] == i), 0))]
    else:
        picked = [(r["index"], r["relevance"]["overall"]) for r in results[:top_k] if r["relevance"]["overall"] >= MIN_SOURCE]
    sources = [{"n": k + 1, "paper": CORPUS.papers[i], "relevance": rel} for k, (i, rel) in enumerate(picked)]
    base = {"question": question, "interpretation": interpretation, "sources": sources, "provider": PROVIDER.name}
    none = {"sentences": 0, "cited_sentences": 0, "invalid_citations": []}

    if not sources or (paper_id is None and sources[0]["relevance"] < MIN_TOP):
        return {**base, "status": "insufficient_evidence", "answer": INSUFFICIENT, "cited": [], "grounding": none}
    try:
        raw = PROVIDER.generate(question, [(s["n"], s["paper"]) for s in sources])
    except Exception as e:  # a provider/network failure must not crash the API
        log.exception("answer generation failed")
        return {**base, "status": "error", "answer": f"The answer generator failed: {type(e).__name__}.", "cited": [], "grounding": none}
    if INSUFFICIENT in raw:
        return {**base, "status": "insufficient_evidence", "answer": INSUFFICIENT, "cited": [], "grounding": none}
    answer, cited, grounding = verify_citations(raw, len(sources))
    if not cited:  # no valid citation left: not grounded
        return {**base, "status": "insufficient_evidence", "answer": INSUFFICIENT, "cited": [], "grounding": grounding}
    return {**base, "status": "answered", "answer": answer, "cited": cited, "grounding": grounding}


class AskRequest(BaseModel):
    question: str
    paper_id: Optional[str] = None


@router.post("/ask")
def ask_endpoint(req: AskRequest):
    question = req.question.strip()
    if not question or len(question) > 1000:
        raise HTTPException(status_code=422, detail="Question must be 1-1000 characters")
    if req.paper_id is not None and req.paper_id not in INDEX:
        raise HTTPException(status_code=404, detail="Paper not found")
    return ask(question, req.paper_id)
```

### Step 2 — Switch it on

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API. Run from my_cosmos/backend:  uvicorn app.main:app --reload --port 8020"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import assistant, graph, opportunities, papers_api, recommend, search, trends

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
app.include_router(assistant.router)


@app.get("/health")
def health():
    return {"status": "ok", "answer_provider": assistant.PROVIDER.name}
```

### Step 3 — Tests: is it really grounded?

These tests use a **stub**: a fake provider that returns whatever we tell it. That lets us test "what if the AI cites a source that doesn't exist?" without calling any AI.

**File:** `my_cosmos/backend/tests/test_assistant.py`

```python
import re

from fastapi.testclient import TestClient

from app import assistant
from app.main import app

client = TestClient(app)
QUESTION = "What techniques are used to detect spacecraft faults?"


def test_extractive_answer_is_quoted_and_cited():
    r = client.post("/ask", json={"question": QUESTION}).json()
    assert r["status"] == "answered" and r["provider"] == "extractive"
    assert r["cited"] and set(r["cited"]) <= {s["n"] for s in r["sources"]}
    assert r["grounding"]["cited_sentences"] == r["grounding"]["sentences"]
    abstracts = " ".join(s["paper"]["abstract"] for s in r["sources"])
    for sentence in re.split(r"(?<=\])\.\s*", r["answer"]):
        quoted = re.sub(r"\s*\[\d+\]\.?$", "", sentence).strip()
        if quoted:
            assert quoted in abstracts, "every sentence must be copied from a source"


def test_no_evidence_means_no_answer():
    r = client.post("/ask", json={"question": "zzzz qqqq xxyyzz"}).json()
    assert r["status"] == "insufficient_evidence" and r["cited"] == []


def test_question_about_one_paper_uses_only_that_paper():
    r = client.post("/ask", json={"question": "What method does this paper use?", "paper_id": "demo-00100"}).json()
    assert [s["paper"]["paper_id"] for s in r["sources"]] == ["demo-00100"]
    assert client.post("/ask", json={"question": "x", "paper_id": "nope"}).status_code == 404


def test_invalid_citations_are_removed():
    text, cited, g = assistant.verify_citations("A is used [1]. B is reported [7]. C has no source.", n_sources=2)
    assert "[7]" not in text and cited == [1] and g["invalid_citations"] == [7]


class Stub:
    name = "stub"

    def __init__(self, reply: str):
        self.reply = reply

    def generate(self, question, sources):
        return self.reply


def test_an_uncited_answer_is_rejected(monkeypatch):
    monkeypatch.setattr(assistant, "PROVIDER", Stub("Spacecraft use cameras. Trust me [99]."))
    r = client.post("/ask", json={"question": QUESTION}).json()
    assert r["status"] == "insufficient_evidence"
    assert r["grounding"]["invalid_citations"] == [99]
```

```powershell
python -m pytest -q
```

You should see `24 passed`.

### Step 4 — The frontend call

**File:** `my_cosmos/frontend/src/api/ask.ts`

```ts
import type { Paper } from "../types";
import { apiPost } from "./http";

export interface AskSource { n: number; paper: Paper; relevance: number }
export interface AskResponse {
  question: string;
  interpretation: string[];
  status: "answered" | "insufficient_evidence" | "error";
  answer: string;
  cited: number[];
  sources: AskSource[];
  grounding: { sentences: number; cited_sentences: number; invalid_citations: number[] };
  provider: string;
}

export const askQuestion = (question: string, paperId?: string) =>
  apiPost<AskResponse>("/ask", { question, paper_id: paperId ?? null });
```

### Step 5 — An answer with clickable citations

**File:** `my_cosmos/frontend/src/components/AnswerCard.tsx`

```tsx
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import type { AskResponse } from "../api/ask";
import { GlassCard } from "./ui";

export function AnswerCard({ r }: { r: AskResponse }) {
  const [active, setActive] = useState<number | null>(null);
  const parts = r.answer.split(/(\[\d+\])/g); // keeps the [n] markers as their own pieces

  return (
    <GlassCard className="animate-rise p-6">
      {r.status === "answered" ? (
        <p className="text-[1.05rem] leading-relaxed">
          {parts.map((part, i) => {
            const m = part.match(/^\[(\d+)\]$/);
            if (!m) return <Fragment key={i}>{part}</Fragment>;
            const n = Number(m[1]);
            return (
              <button key={i} type="button" onClick={() => setActive(n)} aria-label={`Source ${n}`}
                className={`mx-0.5 rounded px-1 align-super text-[0.7em] font-semibold ${active === n ? "bg-violet-500 text-white" : "bg-lavender-100 text-violet-600"}`}>
                {n}
              </button>
            );
          })}
        </p>
      ) : (
        <p role="status" className="rounded-xl bg-dusty-100 px-4 py-3 font-medium">{r.answer}</p>
      )}

      <p className="mt-4 text-xs text-navy-500">
        {r.status === "answered" && `${r.grounding.cited_sentences}/${r.grounding.sentences} sentences cited · `}
        {r.provider === "extractive"
          ? "Extractive answer: sentences quoted from the cited abstracts. No AI model was used."
          : `Written by ${r.provider} from the numbered sources only.`}
      </p>

      {r.sources.length > 0 && (
        <ol className="mt-4 space-y-2 border-t border-lavender-100 pt-4">
          {r.sources.map((s) => (
            <li key={s.n} className={`flex gap-3 rounded-xl p-2 text-sm ${active === s.n ? "bg-lavender-100" : ""}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${r.cited.includes(s.n) ? "bg-violet-500 text-white" : "bg-lavender-100 text-violet-600"}`}>{s.n}</span>
              <div>
                <Link to={`/papers/${s.paper.paper_id}`} className="font-medium hover:text-violet-600">{s.paper.title}</Link>
                <p className="text-xs text-navy-500">{s.paper.publication_year} · relevance {s.relevance}%</p>
                {active === s.n && <p className="mt-1 text-xs leading-relaxed text-navy-700">{s.paper.abstract}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}
```

### Step 6 — The Assistant page

**File:** `my_cosmos/frontend/src/pages/AssistantPage.tsx`

```tsx
import { useState } from "react";
import { askQuestion, type AskResponse } from "../api/ask";
import { AnswerCard } from "../components/AnswerCard";
import { NeedsApi } from "../components/NeedsApi";
import { CosmicLoader, GlassCard } from "../components/ui";

const EXAMPLES = [
  "What techniques are used to detect spacecraft faults?",
  "How is computer vision used for spacecraft navigation?",
  "How are spacecraft becoming autonomous?",
];

type Turn = { id: number; question: string; result?: AskResponse; error?: string };

function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const busy = turns.some((t) => !t.result && !t.error);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const id = Date.now();
    setTurns((ts) => [...ts, { id, question: q }]);
    setText("");
    try {
      const result = await askQuestion(q);
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, result } : t)));
    } catch (e) {
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, error: (e as Error).message } : t)));
    }
  };

  return (
    <>
      {turns.length === 0 && (
        <GlassCard className="mt-8 p-6">
          <p className="text-sm font-semibold">Try asking</p>
          <div className="mt-3 flex flex-col gap-2">
            {EXAMPLES.map((q) => (
              <button key={q} type="button" onClick={() => void ask(q)} className="rounded-xl bg-white/60 px-4 py-2.5 text-left text-sm hover:bg-white">{q}</button>
            ))}
          </div>
        </GlassCard>
      )}
      <div className="mt-8 space-y-8" aria-live="polite">
        {turns.map((t) => (
          <section key={t.id}>
            <p className="mb-3 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet-500 px-4 py-2.5 text-white">{t.question}</p>
            {!t.result && !t.error && <CosmicLoader label="Retrieving papers and checking the evidence…" />}
            {t.error && <GlassCard className="p-4 text-sm">Couldn't reach the assistant: {t.error}</GlassCard>}
            {t.result && <AnswerCard r={t.result} />}
          </section>
        ))}
      </div>
      <form className="sticky bottom-4 mt-8" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <label htmlFor="assistant-q" className="sr-only">Your question</label>
        <div className="glass flex gap-2 rounded-2xl p-2">
          <input id="assistant-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
            placeholder="Ask a question about space research…" className="h-11 flex-1 bg-transparent px-3 focus:outline-none" />
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-xl bg-violet-500 px-5 font-medium text-white disabled:opacity-40">Ask</button>
        </div>
      </form>
    </>
  );
}

export function AssistantPage() {
  return (
    <div className="container-cosmos max-w-4xl py-10">
      <p className="eyebrow">Research assistant</p>
      <h1 className="mt-1 text-3xl font-semibold">Ask the research corpus</h1>
      <p className="mt-2 text-navy-500">Answers come only from retrieved papers, and every sentence cites its source. If the corpus doesn't hold enough evidence, the assistant says so.</p>
      <NeedsApi feature="The research assistant"><Chat /></NeedsApi>
    </div>
  );
}
```

### Step 7 — The final routes

Every section is built now.

**File:** `my_cosmos/frontend/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { AppShell } from "./layouts/AppShell";
import { AssistantPage } from "./pages/AssistantPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { ExplorePage } from "./pages/ExplorePage";
import { MapPage } from "./pages/MapPage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
import { PaperPage } from "./pages/PaperPage";
import { PapersPage } from "./pages/PapersPage";
import { SearchPage } from "./pages/SearchPage";
import { TrendsPage } from "./pages/TrendsPage";

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
      { path: "/assistant", element: <AssistantPage /> },
      { path: "*", element: <ComingSoonPage title="Lost in space" lesson="404" /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

### Step 8 — Optional: use Claude as the writer

Only if you have an Anthropic API key. Otherwise skip: the extractive provider is complete. In the API terminal:

```powershell
pip install anthropic
```

```powershell
$env:ANTHROPIC_API_KEY = "your-key-here"; $env:LLM_PROVIDER = "anthropic"; uvicorn app.main:app --reload --port 8020
```

http://localhost:8020/health now shows `"answer_provider": "claude:claude-opus-5-5"`. The same gate, citation check and "insufficient evidence" rules still apply. Every call costs a small amount of money.

Two settings in `ClaudeProvider` worth knowing:

- `output_config={"effort": "medium"}` controls how hard the model thinks. Higher effort costs more.
- `fallbacks="default"`: if the model declines a request, the API retries it on another suitable model. If that is declined too (`stop_reason == "refusal"`), we answer "not enough evidence". Delete the `betas` and `fallbacks` lines if you'd rather not use this.

## Check

- [ ] `python -m pytest -q` prints `24 passed`.
- [ ] Asking *What techniques are used to detect spacecraft faults?* gives an answer where **every** sentence ends with a citation.
- [ ] Clicking a citation number highlights its source and shows that paper's abstract.
- [ ] Asking `zzzz qqqq` gives "The corpus does not contain enough evidence to answer this."
- [ ] The small print says which provider wrote the answer.

## What just happened?

- `ENGINE.search` (Lesson 12) did the **retrieval**. The assistant is built on top of search, not separately from it.
- The **gate** refused weak evidence before any writing happened.
- The extractive provider scored every sentence of every source by shared stems with the question and quoted the best four. Because it only copies, it **cannot** invent a claim. The test checks exactly that.
- `verify_citations` is the safety net for **any** provider: invalid `[n]` are removed, and an answer with no valid citation is rejected.
- `monkeypatch.setattr(assistant, "PROVIDER", Stub(...))` swapped the writer during one test only. That's the provider pattern making testing easy.

## Try it yourself

1. Ask about a paper: in the API docs (`/docs`), call `POST /ask` with `{"question": "What method does it use?", "paper_id": "demo-00100"}`.
2. Add an **"Ask about this paper"** box to `PaperPage.tsx` that calls `askQuestion(q, p.paper_id)` and shows an `AnswerCard`. (The finished COSMOS has one: `frontend/src/components/assistant/PaperAsk.tsx`.)
3. Change `MIN_TOP` to 70. Which example questions now get "not enough evidence"? Is that better or worse?

## If it does not work

| Problem | Fix |
|---|---|
| `422 Unprocessable Entity` | The request body must be JSON with a `question` field. Check `askQuestion` sends `{ question, paper_id }`. |
| `ImportError: cannot import name 'analyze'` | `search.py` must define `analyze` (Lesson 12, Step 1). |
| Claude mode: `AuthenticationError` | The API key is wrong or not set in **that** terminal. `$env:` variables only last for the current terminal. |
| Every answer says "not enough evidence" | The demo abstracts are templates, so only questions close to topic names score well. Try the example questions. |

---

**Next:** [18_CONNECT_REAL_DATA.md](18_CONNECT_REAL_DATA.md)
