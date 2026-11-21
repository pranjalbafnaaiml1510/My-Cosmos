"""COSMOS API. Run: uvicorn app.main:app --reload --port 8010 (from backend/)."""

import logging
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from .analytics import Analytics
from .config import settings
from .corpus import Corpus
from .schemas import (
    CorpusStats, CountrySummary, Domain, EmergingSignal, EntityProfile, Facets, MissionSummary, Page, Paper,
    AskRequest, AskResponse, Taxonomy, GraphNeighborhood, OpportunityReport, PaperRow, TrendReport, RecommendationSet, SearchResponse, SearchResult, TopicLink, TopicSummary,
)
from .graph import KnowledgeGraph
from .opportunities import OpportunityFinder
from .rag.assistant import ResearchAssistant
from .rag.providers import make_provider
from .recommend import Recommender
from .trends import Trends
from .search.engine import SearchEngine, doc_text
from .vectors import setup_vectors

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("cosmos")


class State:
    corpus: Corpus
    analytics: Analytics
    engine: SearchEngine
    recommender: Recommender
    graph: KnowledgeGraph
    trends: Trends
    opportunities: OpportunityFinder
    assistant: ResearchAssistant
    vector_note: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = State()
    s.corpus = Corpus.load(settings.data_dir)
    s.analytics = Analytics(s.corpus)
    v = setup_vectors(s.corpus.papers, settings.data_dir, settings.embedder, settings.st_model, [doc_text(p) for p in s.corpus.papers])
    s.engine = SearchEngine(s.corpus.papers, s.corpus.all_topics, v.search_embedder, v.search_doc_vectors)
    sim = v.similarity_vectors if v.similarity_vectors is not None else s.engine.dense.vectors
    s.vector_note = v.note
    s.recommender = Recommender(s.corpus.papers, sim, v.similarity_method)
    s.graph = KnowledgeGraph(s.corpus)
    s.trends = Trends(s.corpus)
    s.opportunities = OpportunityFinder(s.corpus, sim, v.similarity_method)
    s.opportunities.all()  # score every topic pair once at startup rather than on the first request
    s.trends.report(3)     # warm the default trend window (same key the endpoints use)
    s.assistant = ResearchAssistant(s.engine, s.corpus.papers, make_provider(settings.llm_provider, settings.llm_model))
    log.info("Loaded %d papers (%s mode, %s retrieval)", len(s.corpus.papers), settings.data_mode, s.engine.retrieval)
    app.state.cosmos = s
    yield


app = FastAPI(title="COSMOS API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["GET", "POST"], allow_headers=["*"])


def st(request: Request) -> State:
    return request.app.state.cosmos


class Filters:
    """Shared filter params for /papers and /search. Multi-value: ?topic=A&topic=B."""

    def __init__(
        self,
        year_from: Optional[int] = None, year_to: Optional[int] = None,
        country: list[str] = Query([]), topic: list[str] = Query([]), mission: list[str] = Query([]),
        organization: list[str] = Query([]), technology: list[str] = Query([]), method: list[str] = Query([]),
    ):
        self.kw = dict(year_from=year_from, year_to=year_to, country=country, topic=topic, mission=mission,
                       organization=organization, technology=technology, method=method)

    def allowed(self, s: State) -> set[int] | None:
        if not any(self.kw.values()):
            return None
        keep = {id(p) for p in s.analytics.filter(s.corpus.papers, **self.kw)}
        return {i for i, p in enumerate(s.corpus.papers) if id(p) in keep}


@app.get("/health")
def health(s: State = Depends(st)):
    return {"status": "ok", "data_mode": settings.data_mode, "data_dir": settings.data_dir.name,
            "synthetic": s.analytics.stats().synthetic, "retrieval": s.engine.retrieval,
            "vectors": s.vector_note, "answer_provider": s.assistant.provider.name, "papers": len(s.corpus.papers)}


@app.get("/taxonomy", response_model=Taxonomy)
def taxonomy(s: State = Depends(st)):
    """Domains (with their topics) and countries of the loaded corpus, for UI labels and links."""
    return Taxonomy(domains=s.corpus.domains, countries=s.corpus.countries)


@app.get("/stats", response_model=CorpusStats)
def stats(s: State = Depends(st)):
    return s.analytics.stats()


@app.get("/domains", response_model=list[Domain])
def domains(s: State = Depends(st)):
    return s.analytics.domains()


@app.get("/topics", response_model=list[TopicSummary])
def topics(s: State = Depends(st)):
    return s.analytics.topics()


@app.get("/graph/entity/{entity_id}", response_model=GraphNeighborhood)
def graph(entity_id: str, per_kind: int = Query(4, ge=1, le=12), s: State = Depends(st)):
    """Progressive expansion: one entity's strongest neighbours. Use entity_id="root" for the starting view."""
    g = s.graph.neighborhood(entity_id, per_kind)
    if g is None:
        raise HTTPException(404, f"No entity '{entity_id}'")
    return g


@app.get("/graph/topics", response_model=list[TopicLink])
def topic_graph(limit: int = Query(40, le=500), s: State = Depends(st)):
    return s.analytics.topic_links(limit)


@app.get("/trends", response_model=TrendReport)
def trends(recent_years: int = Query(3, ge=1, le=6), s: State = Depends(st)):
    return s.trends.report(recent_years)


@app.get("/trends/emerging", response_model=list[EmergingSignal])
def emerging(limit: int = Query(6, le=50), s: State = Depends(st)):
    """Topics the trend analysis classes as emerging or growing (same method as /trends)."""
    topics = [t for t in s.trends.report(3).topics if t.status in ("emerging", "growing")]
    return [EmergingSignal(topic_id=t.topic_id, topic=t.topic, paper_count=t.total, recent_count=t.recent,
                           growth_ratio=t.growth_ratio, yearly=t.yearly) for t in topics[:limit]]


@app.get("/countries", response_model=list[CountrySummary])
def countries(s: State = Depends(st)):
    return s.analytics.countries()


@app.get("/missions", response_model=list[MissionSummary])
def missions(s: State = Depends(st)):
    return s.analytics.missions()


def _profile(kind: str, id: str, s: State) -> EntityProfile:
    p = s.analytics.profile(kind, id)
    if p is None:
        raise HTTPException(404, f"No {kind} '{id}' in this corpus")
    return p


@app.get("/topics/{id}", response_model=EntityProfile)
def topic(id: str, s: State = Depends(st)):
    return _profile("topic", id, s)


@app.get("/countries/{id}", response_model=EntityProfile)
def country(id: str, s: State = Depends(st)):
    return _profile("country", id, s)


@app.get("/missions/{id}", response_model=EntityProfile)
def mission(id: str, s: State = Depends(st)):
    return _profile("mission", id, s)


@app.get("/papers/facets", response_model=Facets)
def facets(s: State = Depends(st)):
    return s.analytics.facets()


@app.get("/papers", response_model=Page[PaperRow])
def papers(
    q: Optional[str] = None,
    sort: Optional[Literal["publication_year", "title", "country", "relevance", "-publication_date"]] = None,
    order: Optional[Literal["asc", "desc"]] = None,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    f: Filters = Depends(), s: State = Depends(st),
):
    if sort == "-publication_date":  # convenience form used by "recent papers"
        sort, order = "publication_year", "desc"
    if q and q.strip():
        _, scored = s.engine.search(q, f.allowed(s))
        rows = [PaperRow(paper=s.corpus.papers[x.index], relevance=x.relevance.overall) for x in scored]
    else:
        rows = [PaperRow(paper=p, relevance=None) for p in s.analytics.filter(s.corpus.papers, **f.kw)]
    return s.analytics.query_papers(rows, sort, order, page, page_size, bool(q and q.strip()))


@app.get("/papers/recent", response_model=list[Paper])
def recent(limit: int = Query(6, le=50), s: State = Depends(st)):
    return s.analytics.recent(limit)


@app.get("/papers/{paper_id}", response_model=Paper)
def paper(paper_id: str, s: State = Depends(st)):
    p = s.corpus.by_id.get(paper_id)
    if not p:
        raise HTTPException(404, "Paper not found")
    return p


@app.get("/search", response_model=SearchResponse)
def search(q: str = Query(..., min_length=1, max_length=500), limit: int = Query(20, le=100),
           f: Filters = Depends(), s: State = Depends(st)):
    interpretation, scored = s.engine.search(q, f.allowed(s))
    return SearchResponse(
        query=q, interpretation=interpretation, total=len(scored), retrieval=s.engine.retrieval,
        results=[SearchResult(paper=s.corpus.papers[x.index], relevance=x.relevance) for x in scored[:limit]],
    )


@app.get("/recommendations/{paper_id}", response_model=RecommendationSet)
def recommendations(paper_id: str, s: State = Depends(st)):
    r = s.recommender.recommend(paper_id)
    if r is None:
        raise HTTPException(404, "Paper not found")
    return r


@app.get("/opportunities", response_model=OpportunityReport)
def opportunities(
    lens: Literal["underexplored", "growing"] = "underexplored",
    limit: int = Query(24, ge=1, le=200), min_papers: int = Query(1, ge=1),
    cross_domain_only: bool = False, domain: Optional[str] = None, s: State = Depends(st),
):
    """Corpus-derived discovery signals for topic intersections. Not validated research gaps."""
    return s.opportunities.report(lens, limit, min_papers, cross_domain_only, domain)


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest, s: State = Depends(st)):
    """Grounded Q&A: retrieve, answer only from the retrieved papers, cite them as [n]."""
    q = req.question.strip()
    if not q or len(q) > 1000:
        raise HTTPException(422, "Question must be 1-1000 characters")
    try:
        return s.assistant.ask(q, req.paper_id, max(1, min(req.top_k, 10)))
    except KeyError:
        raise HTTPException(404, "Paper not found")
