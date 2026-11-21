# Lesson 19 — Final Checklist and What's Next

**Time:** 15 minutes | **You need:** Lessons 03–18 finished

## Goal

- Check that your COSMOS fully works.
- Review what you learned, in one page.
- See what the finished COSMOS adds, and choose what to build next.

## Final checklist

Run both servers:

**Terminal 1 — API**

```powershell
cd my_cosmos\backend
```

```powershell
.venv\Scripts\Activate.ps1
```

```powershell
uvicorn app.main:app --reload --port 8020
```

**Terminal 2 — website**

```powershell
cd my_cosmos\frontend
```

```powershell
npm run dev:api
```

Open http://localhost:5174 and tick every box:

### It works

- [ ] `python -m pytest -q` (in `my_cosmos\backend`) prints **24 passed**.
- [ ] `npm run build` (in `my_cosmos\frontend`) finishes with **✓ built**.
- [ ] Explore: statistics, domains, countries and recent papers appear.
- [ ] Papers: filter by topic and country, sort, page, open a row's abstract.
- [ ] Search: a question shows "Interpreted as", results and RELEVANCE breakdowns.
- [ ] Paper page: three kinds of recommendations, each with reasons.
- [ ] Research Map: click from Space Research → a domain → a topic, then back along the trail.
- [ ] Trends: three signal columns and the full table with trend lines.
- [ ] Opportunities: cards with the disclaimer, and every "Papers" number below "Typical".
- [ ] Assistant: a cited answer, and "not enough evidence" for nonsense.

### It's honest

- [ ] Demo data is labelled as synthetic on the home page and on paper pages.
- [ ] No page calls a topic "important" or "the future", only corpus signals.
- [ ] Every relevance number is broken into its parts.
- [ ] The assistant never answers without citations.

### It's usable

- [ ] **Tab** reaches every link and button, and you can always see where you are (focus ring).
- [ ] At phone width (F12 → device toolbar → 375 px) pages stack and tables scroll sideways.
- [ ] With reduced motion on in your OS, nothing twinkles or orbits.

## What you learned

| Area | You can now… |
|---|---|
| **React + TypeScript** | build components with typed props, pages with routing, controlled forms, URL state |
| **Design systems** | define colour tokens and reusable components so every page matches |
| **Architecture** | separate UI from data with an interface and adapters (mock / http) |
| **FastAPI** | build typed endpoints, routers, CORS, automatic docs, and test them with pytest |
| **Information retrieval** | TF-IDF, stemming, LSA embeddings, cosine similarity, hybrid ranking, explanations |
| **Recommendation** | combine semantic, topic, entity and time signals into kinds that mean something |
| **Graphs** | build a co-occurrence graph and explore it progressively |
| **Statistics** | normalise growth by corpus growth, z-scores, least-squares slopes, regression residuals |
| **RAG** | retrieve → gate → generate → verify, with swappable providers and grounding tests |
| **Data engineering** | import, clean, deduplicate and validate a real export |
| **Responsibility** | say what the data supports, label uncertainty and demo data, never invent |

## What the finished COSMOS adds

Open the finished project (`frontend/` and `backend/` in the course folder) and compare it with yours:

| Feature | Where to look |
|---|---|
| Topic, Country and Mission pages | `frontend/src/pages/EntityPage.tsx` |
| Force-directed graph that keeps every expanded node | `frontend/src/components/graph/KnowledgeGraph.tsx` |
| Line charts and heatmaps on Trends | `frontend/src/components/charts/` |
| "Growing intersections" lens and a table view | `backend/app/opportunities.py`, `frontend/src/pages/OpportunitiesPage.tsx` |
| Every NLP feature also working in demo mode | `frontend/src/services/mock*.ts` |
| "Ask about this paper" | `frontend/src/components/assistant/PaperAsk.tsx` |
| Neural embeddings, saved-embedding loading, caching | `backend/app/vectors.py`, `backend/app/search/embedders.py` |
| Taxonomy served from the data (no hard-coded countries) | `frontend/src/hooks/useTaxonomy.tsx` |
| Full importer with tests | `backend/app/ingest/`, `backend/tests/test_ingest.py` |
| Precomputed and cached results for 10,000+ papers | `backend/app/main.py` (startup) |

## Ideas for what to build next

1. **Ask about this paper** on your paper page (Lesson 17, Try it yourself 2).
2. **Topic pages**: `/topics/:id` with papers per year, top countries and related topics. Reuse `per_year` from `trends.py`.
3. **Year filter** on the research table (Lesson 10, Try it yourself 1).
4. **Growing intersections** lens on Opportunities (Lesson 16, Try it yourself 2).
5. **Neural embeddings**: `pip install sentence-transformers`, then replace the LSA step in `SearchEngine` with `SentenceTransformer("all-MiniLM-L6-v2").encode(...)`. Do the tests still pass? Are results better on real data?
6. **Deploy it**: put your COSMOS on the internet. That's the whole of Lesson 20.

## The big idea, one last time

> *"Every paper is a star, every topic is a constellation, every entity is a point of connection — and NLP helps you understand the universe of research."*

You built that, and you built it honestly. 🚀

---

**Next:** [20_DEPLOY_YOUR_COSMOS.md](20_DEPLOY_YOUR_COSMOS.md)
