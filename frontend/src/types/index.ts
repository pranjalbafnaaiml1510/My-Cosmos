/**
 * COSMOS production schema. Mock and production adapters both return these shapes.
 * Original metadata and NLP-derived fields are kept separate on Paper.
 */

export interface PaperMetadata {
  paper_id: string;
  title: string;
  abstract: string;
  authors: string[];
  publication_date: string;
  publication_year: number;
  journal: string | null;
  conference: string | null;
  publisher: string | null;
  doi: string | null;
  source_url: string | null;
  open_access_url: string | null;
  /** From author affiliation metadata only — never inferred from text. */
  country: string | null;
  organizations: string[];
  citation_count: number | null;
  reference_count: number | null;
  research_type: "journal-article" | "conference-paper" | "preprint" | "review";
}

export interface PaperDerived {
  topics: string[];
  subtopics: string[];
  missions: string[];
  spacecraft: string[];
  technologies: string[];
  methods: string[];
  entities: string[];
  keywords: string[];
  embedding_reference: string | null;
}

export interface Paper extends PaperMetadata {
  derived: PaperDerived;
  /** true for records produced by the mock adapter */
  is_synthetic: boolean;
}

export interface CorpusStats {
  papers: number;
  countries: number;
  topics: number;
  organizations: number;
  missions: number;
  year_range: [number, number];
  /** true when any record is a synthetic demo record */
  synthetic: boolean;
}

export interface YearCount { year: number; count: number }

export interface Domain {
  id: string;
  name: string;
  topics: string[];
  paper_count: number;
}

export interface TopicSummary {
  id: string;
  name: string;
  domain_id: string;
  paper_count: number;
  share: number;
  yearly: YearCount[];
}

export interface EmergingSignal {
  topic_id: string;
  topic: string;
  paper_count: number;
  recent_count: number;
  /** recent yearly rate ÷ baseline yearly rate */
  growth_ratio: number;
  yearly: YearCount[];
}

export interface CountrySummary {
  id: string;
  name: string;
  flag: string;
  paper_count: number;
  top_topics: string[];
  organizations: number;
}

export interface TopicLink { source: string; target: string; weight: number }

export interface RelevanceBreakdown {
  overall: number; // 0-100
  semantic: number;
  /** Sparse TF-IDF match. Present on backend results. */
  keyword?: number;
  topic: number;
  entity: number;
  matched_concepts: string[];
}

export interface SearchResult { paper: Paper; relevance: RelevanceBreakdown }

export interface SearchResponse {
  query: string;
  interpretation: string[];
  total: number;
  /** lexical = in-browser demo matching; lsa = latent semantic embeddings; neural = sentence-transformers. */
  retrieval: "lexical" | "lsa" | "neural";
  results: SearchResult[];
}

export type DataMode = "mock" | "production";

export type PaperSortKey = "publication_year" | "title" | "country" | "relevance";

/** Server-side query for the Research Explorer. Multi-value filters are OR within a field, AND across fields. */
export interface PaperQuery {
  q?: string;
  year_from?: number;
  year_to?: number;
  country?: string[];
  topic?: string[];
  mission?: string[];
  organization?: string[];
  technology?: string[];
  method?: string[];
  sort?: PaperSortKey;
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface PaperRow { paper: Paper; relevance: number | null }

export interface Page<T> { items: T[]; total: number; page: number; page_size: number }

export type EntityKind = "topic" | "country" | "mission";

export interface Ranked { id: string; value: string; count: number }

/** Aggregate view of every paper attached to one topic, country or mission. */
export interface EntityProfile {
  kind: EntityKind;
  id: string;
  name: string;
  /** Domain name for topics, flag emoji for countries. */
  badge: string | null;
  paper_count: number;
  share: number;
  country_count: number;
  organization_count: number;
  yearly: YearCount[];
  top_topics: Ranked[];
  top_countries: Ranked[];
  top_organizations: Ranked[];
  top_missions: Ranked[];
  top_technologies: Ranked[];
  top_methods: Ranked[];
  /** Topics inside this entity whose recent activity outpaces their baseline. */
  emerging: EmergingSignal[];
}

export type RecommendationKind = "very_similar" | "related" | "adjacent";

export interface Recommendation {
  paper: Paper;
  kind: RecommendationKind;
  score: number; // 0-100
  signals: { semantic: number; topic: number; entity: number; temporal: number };
  reasons: string[];
}

export interface RecommendationSet {
  paper_id: string;
  /** How the semantic signal was computed. */
  method: "lexical" | "lsa" | "neural";
  very_similar: Recommendation[];
  related: Recommendation[];
  adjacent: Recommendation[];
}

export type GraphKind = "root" | "domain" | "topic" | "country" | "mission" | "technology" | "method" | "organization";

export interface GraphNode {
  /** "<kind>:<slug>", or "root" */
  id: string;
  kind: GraphKind;
  label: string;
  paper_count: number;
}

export interface GraphEdge { source: string; target: string; /** papers shared by both ends */ weight: number }

export interface GraphNeighborhood {
  center: GraphNode;
  yearly: YearCount[];
  /** neighbours only, strongest first */
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type TrendStatus = "emerging" | "growing" | "stable" | "declining";

export interface TopicTrend {
  topic_id: string;
  topic: string;
  domain_id: string;
  yearly: YearCount[];
  total: number;
  /** papers in the recent window */
  recent: number;
  baseline_rate: number;
  recent_rate: number;
  /** (recent rate ÷ baseline rate) ÷ corpus_growth: >1 means the topic's share is rising */
  growth_ratio: number;
  /** least-squares papers/year trend */
  slope: number;
  /** (recent − expected) ÷ √expected, Poisson approximation */
  z: number;
  status: TrendStatus;
}

export interface SeriesRow { id: string; label: string; yearly: YearCount[]; total: number }

export interface TrendReport {
  years: number[];
  recent_years: number;
  corpus_growth: number;
  totals: YearCount[];
  topics: TopicTrend[];
  countries: SeriesRow[];
  technologies: SeriesRow[];
  methods: SeriesRow[];
}

export type OpportunityLens = "underexplored" | "growing";

export interface Opportunity {
  /** "<topic_a_id>|<topic_b_id>" */
  id: string;
  topic_a: string;
  topic_a_id: string;
  topic_b: string;
  topic_b_id: string;
  cross_domain: boolean;
  /** papers tagged with both topics */
  papers: number;
  /** typical overlap for topic pairs this semantically close (regression fit) */
  expected: number;
  recent: number;
  /** "none" = too few papers to tell */
  momentum: "new" | "increasing" | "steady" | "decreasing" | "none";
  score: number;
  components: { closeness: number; gap: number; momentum: number; foundation: number };
  connected_topics: string[];
  shared_technologies: string[];
  shared_methods: string[];
  yearly: YearCount[];
  sample_paper_ids: string[];
}

export interface OpportunityReport {
  method: "lexical" | "lsa" | "neural";
  lens: OpportunityLens;
  recent_years: number;
  total_pairs: number;
  items: Opportunity[];
}

export interface OpportunityQuery { lens?: OpportunityLens; limit?: number; min_papers?: number; cross_domain_only?: boolean; domain?: string }

/** Domains and countries of the loaded corpus. Comes from the data source, never hard-coded in the UI. */
export interface Taxonomy {
  domains: { id: string; name: string; icon?: string | null; topics: string[] }[];
  countries: { id: string; name: string; flag: string }[];
}

export interface AskRequest { question: string; paper_id?: string; top_k?: number }

export interface AskSource {
  /** citation number used in the answer, [n] */
  n: number;
  paper: Paper;
  /** retrieval score 0-100 */
  relevance: number;
  /** the text the generator was given for this source */
  passage: string;
}

export interface AskResponse {
  question: string;
  interpretation: string[];
  status: "answered" | "insufficient_evidence" | "error";
  answer: string;
  /** source numbers actually cited in the answer */
  cited: number[];
  sources: AskSource[];
  grounding: { sentences: number; cited_sentences: number; invalid_citations: number[] };
  /** e.g. "extractive" or "anthropic:claude-opus-5-5" */
  provider: string;
  retrieval: "lexical" | "lsa" | "neural";
}

export interface MissionSummary { id: string; name: string; paper_count: number; countries: number; top_topics: string[] }

export type FacetKey = "country" | "topic" | "mission" | "organization" | "technology" | "method";
export type Facets = Record<FacetKey, { value: string; count: number }[]> & { years: [number, number] };
