# COSMOS: Space Research Intelligence Platform

Stages 1–10 done, and stage 11 is ready to run: the import tooling exists, but the real corpus hasn't been supplied yet.
- design system, app shell and Explore page
- Research Explorer table (`/papers`)
- Topic, Country and Mission pages
- FastAPI backend with hybrid semantic search
- Paper pages with a connected-knowledge map and three kinds of recommendations
- Research Map: an interactive knowledge graph with progressive expansion (`/map`)
- Trends: research evolution and emerging-topic signals (`/trends`)
- Research Opportunities: corpus-derived signals for topic intersections (`/opportunities`)
- Research Assistant: grounded Q&A with citations (`/assistant`, plus "Ask about this paper")

## Learn to build it

A step-by-step course that rebuilds COSMOS from zero lives in [`learning-guide/`](learning-guide/00_START_HERE.md): 21 lessons, from setting up your computer to semantic search, recommendations, the knowledge graph, trends, research opportunities and the grounded assistant, and finally deploying it.

To learn the NLP ideas hands-on, open the companion notebook [`learning-guide/notebooks/NLP_BASICS.ipynb`](learning-guide/notebooks/NLP_BASICS.ipynb).

## Run

**Frontend only (in-browser demo data):**

```
cd frontend
npm install
npm run dev          # http://localhost:5173
```

**Full stack (FastAPI backend):**

```
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8010
```

```
cd frontend
npm run dev:api      # http://localhost:5174, talks to the API on :8010
```

Backend tests: `cd backend && .venv\Scripts\python -m pytest -q`

## Data

A **"Demo data"** badge shows in the header whenever the corpus being served contains synthetic records.

The frontend has two adapters behind one contract (`src/services/dataSource.ts`):
- **mock**: `mockAdapter.ts`, the in-browser synthetic corpus.
- **production**: `httpAdapter.ts`, which calls the API.

Pick one with `VITE_DATA_MODE` in `frontend/.env` (or use `npm run dev:api`). UI components never import an adapter directly.

The backend has two data modes, set with `DATA_MODE`:
- **mock**: serves `data/mock/` (default).
- **production**: serves `data/processed/`.

Both read the same two files:
- `papers.json`: a list of papers in the schema in `backend/app/schemas.py`, mirrored in `frontend/src/types`.
- `taxonomy.json`: `{ domains: [{id, name, topics[]}], countries: [{id, name, flag}] }`.

About the demo data:
- `data/mock/` is generated from the frontend generator with `npm run export:mock`, so both sides serve identical records.
- Every record is titled `[Demo record N]`, flagged `is_synthetic`, and has no DOI.
- These are not real papers and not real statistics.

## Search (backend)

`backend/app/search/` runs hybrid retrieval with transparent reranking:

1. **Interpret**: map the query to taxonomy topics by embedding similarity plus term overlap.
2. **Retrieve**: take the union of dense top-k (embeddings) and sparse top-k (TF-IDF with a light stemmer).
3. **Rerank**: `overall = 0.5·semantic + 0.2·keyword + 0.2·topic + 0.1·entity`. Each part is returned to the UI.

Embedders (`EMBEDDER=auto|lsa|sentence-transformers`):
- **neural**: sentence-transformers (`pip install -r requirements-ml.txt`, which pulls in PyTorch). With `auto`, it's used when installed.
- **lsa**: TF-IDF plus truncated SVD. It has no heavy dependencies and is the fallback.

The vector index uses FAISS when it's installed and NumPy otherwise.

Note: the demo abstracts are templated, so search quality on demo data says little about quality on the real corpus.

## Recommendations

`backend/app/recommend.py` (ported to `frontend/src/services/mockRecommend.ts` for demo mode) returns three disjoint groups:

- **Very similar**: shares at least half of the paper's topics, ranked mostly by semantic similarity.
- **Related**: shares a topic or entity but uses a different research method.
- **Adjacent**: no shared topic, but in a topic that often co-occurs with this paper's topics.

Each recommendation reports its semantic, topic, entity and time signals, plus plain-language reasons.

The "In brief" summary on paper pages is extractive (the first sentences of the abstract), so it can't add claims the paper doesn't make.

## Knowledge graph

`backend/app/graph.py` (ported to `frontend/src/services/mockGraph.ts`) links any two entities by the number of papers they share. Entities are domains, topics, countries, missions, technologies, methods and organizations.

`GET /graph/entity/{id}` returns one entity's neighbourhood. IDs look like `topic:computer-vision`, or `root` for the starting view. To avoid an unreadable hairball:

- each kind is capped at its 4 strongest neighbours;
- a domain expands into exactly its own topics;
- the map holds at most 90 nodes.

The Research Map page (`/map`) expands nodes one click at a time. Its side panel has an accessible list of connections, and `?focus=` deep links open the map at a given entity.

## Trends

`backend/app/trends.py` (ported to `frontend/src/services/mockTrends.ts`) splits the years into a recent window (default 3 years) and a baseline.

Topic growth is measured relative to the whole corpus, so only a rising *share* of papers counts as a signal:
- **growth ×** = (topic recent rate ÷ baseline rate) ÷ (corpus recent rate ÷ baseline rate).
- **z** = (recent − expected) ÷ √expected, where "expected" comes from the topic's baseline share (a Poisson approximation).
- **slope** = least-squares papers per year across all years.

Status bands:
- **emerging**: ≥1.5×, z ≥ 2 and at least 5 recent papers
- **growing**: ≥1.15× and z ≥ 1
- **declining**: ≤0.75× and z ≤ −1.5
- **stable**: everything else

The home page's emerging cards use the same method. Entity pages measure growth relative to that entity's own papers.

The page explains this method and its limits: testing many topics at once can produce a few signals by chance, and the last year may be incomplete.

## Research Opportunities

`backend/app/opportunities.py` (ported to `frontend/src/services/mockOpportunities.ts`) scores every pair of topics that each have at least 20 papers. There are four components:

- **closeness**: cosine similarity of the two topics' embedding centroids, computed from papers *outside* their overlap.
- **gap**: how far the overlap falls below what's typical for pairs this close. A regression across all pairs fits `log((overlap+½)/independence)` against closeness; the gap measures the shortfall in residual standard deviations.
- **momentum**: recent growth of the overlap relative to the corpus. It's zero below 3 papers and gets full weight from 8.
- **foundation**: how large the smaller parent topic is.

`score = 0.4·closeness + 0.35·gap + 0.15·momentum + 0.1·foundation`

Two lenses:
- **Under-explored**: the overlap is below typical for its closeness. Pairs with fewer than 3 papers are marked "thin evidence".
- **Growing**: at least 3 papers, rising or newly appearing, and still small.

Every card and the page itself state: *"This is a corpus-derived discovery signal, not a validated research gap."*

## Research Assistant

`POST /ask {question, paper_id?, top_k?}` runs `backend/app/rag/`:

1. **Interpret**: map the question to taxonomy topics.
2. **Retrieve**: hybrid search with reranking.
3. **Gate**: if the best source scores below 35, answer *"The corpus does not contain enough evidence to answer this."*
4. **Generate**: the answer may use only the numbered sources and must cite them as `[n]`.
5. **Verify**: citations to sources that don't exist are removed and reported. An answer left with no valid citation is downgraded to "insufficient evidence". The response reports how many sentences carry a citation.

Answer generators are pluggable (`backend/app/rag/providers.py`, set with `LLM_PROVIDER`):

| Provider | What it does | Setup |
|---|---|---|
| `extractive` (default) | Quotes the best-matching sentences from the retrieved abstracts. No LLM, no cost, can't invent claims. | none |
| `anthropic` | Claude writes the answer from the sources, under strict grounding rules. | `pip install -r requirements-llm.txt`, credentials (`ANTHROPIC_API_KEY` or `ant auth login`), optional `LLM_MODEL` (default `claude-opus-5-5`) |

The Anthropic provider turns on the API's server-side refusal fallback: if the request is declined, the API retries on a fallback model it chooses (beta `server-side-fallback-2026-07-01`, `fallbacks="default"`). If the final answer is still a refusal, the assistant reports insufficient evidence.

To add another provider, implement `generate(question, passages) -> str`. The demo frontend (`mockAssistant.ts`) uses the extractive provider in the browser.

## Connecting the real corpus (stage 11)

**1. Import your processed export.** CSV, JSONL, JSON and Parquet are supported; Parquet also needs `pip install pyarrow`. Run from `backend/`, and do a dry run first: it prints the validation report and writes nothing.

```
.venv\Scripts\python -m app.ingest path	o\papers.parquet --dry-run
.venv\Scripts\python -m app.ingest path	o\papers.parquet
```

Common column names are detected automatically, for example `id`/`uid`, `summary` for the abstract, `year`, `affiliation_country`, `institutions` and `topic_labels`. Override any field with `--map '{"country": "first_affiliation_country"}'`.

List fields can be JSON lists or `;`/`|`-separated values. The importer:
- removes duplicates by DOI and by normalised title;
- skips rows with no title, abstract or valid year;
- takes country only from the mapped affiliation column, never from text;
- puts topics missing from the taxonomy under "Other topics".

The report covers every column used, the share of missing values per field, unrecognised countries, and topics outside the taxonomy. Pass `--taxonomy my_taxonomy.json` to use your own domains (the default is the spec's taxonomy), and `--synthetic` only for test or sample data.

**2. Optional: bring your saved embeddings.**

```
... --embeddings emb.npy --embedding-ids ids.json --embedding-model sentence-transformers/all-MiniLM-L6-v2
```

Rows are matched to papers by `paper_id`, and any paper without an embedding fails the import. Search uses the saved vectors when that model is installed (`requirements-ml.txt`) so queries are embedded in the same space; otherwise search falls back to LSA, and recommendations and opportunities still use the saved vectors. Embeddings computed at startup are cached in `data/processed/.cache/`.

**3. Run in production mode.** Start the API with `DATA_MODE=production` (or `DATA_DIR=<folder>`), then run `npm run dev:api`. The UI takes domains and countries from `GET /taxonomy`, and the "Demo data" badge disappears automatically when no record is synthetic. Check `GET /health`, which reports the data folder, the vector source and the answer provider.

**Scale check, 12,000 synthetic records:** import 1.9 s; API startup 10.8 s, including precomputing opportunities and trends; every endpoint under 55 ms once warm.

## Layout

```
frontend/src/
  types/            production schema (metadata vs NLP-derived fields kept separate)
  services/         DataSource contract + mock / http adapters
  data/mock/        taxonomy + synthetic corpus generator
  components/       cosmic/, ui/, research/, tables/, charts/
  layouts/          AppShell
  pages/            Explore, Search, Papers, EntityPage (topic/country/mission), IndexPages, ComingSoon
backend/app/
  main.py           FastAPI routes
  schemas.py        Pydantic models
  corpus.py         fixed-corpus loader
  analytics.py      stats, trends, profiles, facets, paper queries
  search/           embedders, vector index, hybrid engine, text normalisation
  ingest/           corpus importer + validation report (python -m app.ingest)
  vectors.py        saved/cached/computed embedding selection
  rag/              grounded assistant + answer providers
backend/tests/      API + search tests
data/mock/          exported demo corpus
```

## Next step
Run the importer on the real export (see above).
