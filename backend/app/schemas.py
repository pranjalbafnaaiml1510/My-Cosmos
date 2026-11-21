"""Pydantic models mirroring frontend/src/types. Keep the two in sync."""

from typing import Generic, Literal, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaperDerived(BaseModel):
    topics: list[str]
    subtopics: list[str] = []
    missions: list[str] = []
    spacecraft: list[str] = []
    technologies: list[str] = []
    methods: list[str] = []
    entities: list[str] = []
    keywords: list[str] = []
    embedding_reference: Optional[str] = None


class Paper(BaseModel):
    # Original metadata
    paper_id: str
    title: str
    abstract: str
    authors: list[str]
    publication_date: str
    publication_year: int
    journal: Optional[str] = None
    conference: Optional[str] = None
    publisher: Optional[str] = None
    doi: Optional[str] = None
    source_url: Optional[str] = None
    open_access_url: Optional[str] = None
    country: Optional[str] = None  # from author affiliation metadata only
    organizations: list[str] = []
    citation_count: Optional[int] = None
    reference_count: Optional[int] = None
    research_type: str
    # NLP-derived (kept separate)
    derived: PaperDerived
    is_synthetic: bool = False


class YearCount(BaseModel):
    year: int
    count: int


class CorpusStats(BaseModel):
    papers: int
    countries: int
    topics: int
    organizations: int
    missions: int
    year_range: tuple[int, int]
    synthetic: bool


class Domain(BaseModel):
    id: str
    name: str
    topics: list[str]
    paper_count: int


class TopicSummary(BaseModel):
    id: str
    name: str
    domain_id: str
    paper_count: int
    share: float
    yearly: list[YearCount]


class EmergingSignal(BaseModel):
    topic_id: str
    topic: str
    paper_count: int
    recent_count: int
    growth_ratio: float
    yearly: list[YearCount]


class CountrySummary(BaseModel):
    id: str
    name: str
    flag: str
    paper_count: int
    top_topics: list[str]
    organizations: int


class TopicLink(BaseModel):
    source: str
    target: str
    weight: int


class Ranked(BaseModel):
    id: str
    value: str
    count: int


class EntityProfile(BaseModel):
    kind: Literal["topic", "country", "mission"]
    id: str
    name: str
    badge: Optional[str]
    paper_count: int
    share: float
    country_count: int
    organization_count: int
    yearly: list[YearCount]
    top_topics: list[Ranked]
    top_countries: list[Ranked]
    top_organizations: list[Ranked]
    top_missions: list[Ranked]
    top_technologies: list[Ranked]
    top_methods: list[Ranked]
    emerging: list[EmergingSignal]


class MissionSummary(BaseModel):
    id: str
    name: str
    paper_count: int
    countries: int
    top_topics: list[str]


class FacetValue(BaseModel):
    value: str
    count: int


class Facets(BaseModel):
    country: list[FacetValue]
    topic: list[FacetValue]
    mission: list[FacetValue]
    organization: list[FacetValue]
    technology: list[FacetValue]
    method: list[FacetValue]
    years: tuple[int, int]


class PaperRow(BaseModel):
    paper: Paper
    relevance: Optional[int]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class RelevanceBreakdown(BaseModel):
    overall: int
    semantic: int
    keyword: int
    topic: int
    entity: int
    matched_concepts: list[str]


class SearchResult(BaseModel):
    paper: Paper
    relevance: RelevanceBreakdown


class SearchResponse(BaseModel):
    query: str
    interpretation: list[str]
    total: int
    retrieval: Literal["lexical", "lsa", "neural"]
    results: list[SearchResult]


class RecommendationSignals(BaseModel):
    semantic: int
    topic: int
    entity: int
    temporal: int


class Recommendation(BaseModel):
    paper: Paper
    kind: Literal["very_similar", "related", "adjacent"]
    score: int
    signals: RecommendationSignals
    reasons: list[str]


class RecommendationSet(BaseModel):
    paper_id: str
    method: Literal["lexical", "lsa", "neural"]
    very_similar: list[Recommendation]
    related: list[Recommendation]
    adjacent: list[Recommendation]


GraphKind = Literal["root", "domain", "topic", "country", "mission", "technology", "method", "organization"]


class GraphNode(BaseModel):
    id: str  # "<kind>:<slug>", or "root"
    kind: GraphKind
    label: str
    paper_count: int


class GraphEdge(BaseModel):
    source: str
    target: str
    weight: int  # papers shared by both ends


class GraphNeighborhood(BaseModel):
    center: GraphNode
    yearly: list[YearCount]
    nodes: list[GraphNode]  # neighbours only, strongest first
    edges: list[GraphEdge]


TrendStatus = Literal["emerging", "growing", "stable", "declining"]


class TopicTrend(BaseModel):
    topic_id: str
    topic: str
    domain_id: str
    yearly: list[YearCount]
    total: int
    recent: int             # papers in the recent window
    baseline_rate: float    # papers/year before the window
    recent_rate: float      # papers/year inside the window
    growth_ratio: float     # (recent_rate / baseline_rate) / corpus_growth
    slope: float            # least-squares papers/year trend over all years
    z: float                # (recent - expected) / sqrt(expected), Poisson approximation
    status: TrendStatus


class SeriesRow(BaseModel):
    id: str
    label: str
    yearly: list[YearCount]
    total: int


class TrendReport(BaseModel):
    years: list[int]
    recent_years: int
    corpus_growth: float    # corpus recent/baseline papers-per-year; topic ratios are relative to this
    totals: list[YearCount]
    topics: list[TopicTrend]
    countries: list[SeriesRow]
    technologies: list[SeriesRow]
    methods: list[SeriesRow]


class OpportunityComponents(BaseModel):
    closeness: int   # semantic closeness of the two topics outside their overlap (0-100)
    gap: int         # how far the overlap falls below what independent topics would share (0-100)
    momentum: int    # recent growth of the overlap relative to the corpus (0-100)
    foundation: int  # how established the smaller parent topic is (0-100)


class Opportunity(BaseModel):
    id: str  # "<topic_a_id>|<topic_b_id>"
    topic_a: str
    topic_a_id: str
    topic_b: str
    topic_b_id: str
    cross_domain: bool
    papers: int            # papers tagged with both topics
    expected: float        # typical overlap for topic pairs this semantically close (regression fit)
    recent: int            # overlap papers in the recent window
    momentum: Literal["new", "increasing", "steady", "decreasing", "none"]  # "none" = too few papers to tell
    score: int
    components: OpportunityComponents
    connected_topics: list[str]      # topics that co-occur with both parents
    shared_technologies: list[str]
    shared_methods: list[str]
    yearly: list[YearCount]
    sample_paper_ids: list[str]      # most recent overlap papers


class OpportunityReport(BaseModel):
    method: Literal["lexical", "lsa", "neural"]
    lens: Literal["underexplored", "growing"]
    recent_years: int
    total_pairs: int
    items: list[Opportunity]


class AskRequest(BaseModel):
    question: str
    paper_id: Optional[str] = None  # scope the answer to one paper
    top_k: int = 6


class Source(BaseModel):
    n: int                 # citation number used in the answer, [n]
    paper: Paper
    relevance: int         # retrieval score 0-100
    passage: str           # the text the generator was given for this source


class Grounding(BaseModel):
    sentences: int             # answer sentences (excluding the evidence notice)
    cited_sentences: int       # sentences carrying at least one valid [n]
    invalid_citations: list[int]  # [n] markers that pointed at no source (removed from the answer)


class AskResponse(BaseModel):
    question: str
    interpretation: list[str]
    status: Literal["answered", "insufficient_evidence", "error"]
    answer: str
    cited: list[int]           # source numbers actually cited in the answer
    sources: list[Source]
    grounding: Grounding
    provider: str              # e.g. "extractive" or "anthropic:claude-opus-5-5"
    retrieval: Literal["lexical", "lsa", "neural"]


class TaxonomyDomain(BaseModel):
    id: str
    name: str
    icon: Optional[str] = None
    topics: list[str]


class TaxonomyCountry(BaseModel):
    id: str
    name: str
    flag: str = ""


class Taxonomy(BaseModel):
    domains: list[TaxonomyDomain]
    countries: list[TaxonomyCountry]
