import type {
  AskRequest, AskResponse, CorpusStats, Taxonomy, CountrySummary, Domain, EmergingSignal, EntityKind, EntityProfile, Facets, GraphNeighborhood, MissionSummary, OpportunityQuery, OpportunityReport, RecommendationSet, TrendReport, Page, Paper, PaperQuery, PaperRow,
  SearchResponse, TopicLink, TopicSummary,
} from "../types";

/**
 * The single contract every UI component depends on.
 * Implementations: mockAdapter (in-browser synthetic corpus) and httpAdapter (FastAPI backend).
 */
export interface DataSource {
  getStats(): Promise<CorpusStats>;
  getTaxonomy(): Promise<Taxonomy>;
  getDomains(): Promise<Domain[]>;
  getTopics(): Promise<TopicSummary[]>;
  getTopicLinks(limit?: number): Promise<TopicLink[]>;
  getEmerging(limit?: number): Promise<EmergingSignal[]>;
  getCountries(): Promise<CountrySummary[]>;
  getRecentPapers(limit?: number): Promise<Paper[]>;
  getPaper(id: string): Promise<Paper | null>;
  search(query: string, limit?: number): Promise<SearchResponse>;
  queryPapers(q: PaperQuery): Promise<Page<PaperRow>>;
  getFacets(): Promise<Facets>;
  getMissions(): Promise<MissionSummary[]>;
  getTrends(recentYears?: number): Promise<TrendReport>;
  /** Grounded Q&A over the corpus (or one paper). Rejects with an Error for an unknown paper_id. */
  ask(req: AskRequest): Promise<AskResponse>;
  getOpportunities(q: OpportunityQuery): Promise<OpportunityReport>;
  /** One entity's strongest neighbours (progressive expansion). "root" gives the starting view. */
  getGraph(entityId: string): Promise<GraphNeighborhood | null>;
  /** Returns null when the paper id is unknown. */
  getRecommendations(paperId: string): Promise<RecommendationSet | null>;
  /** Returns null when the entity id is unknown. */
  getProfile(kind: EntityKind, id: string): Promise<EntityProfile | null>;
}
