// Match label thresholds — applied to rerank_score when available
export const STRONG_MATCH_THRESHOLD = 0.70
export const GOOD_MATCH_THRESHOLD = 0.40

// Total cap passed to hybrid_search() — function caps internally too
export const HYBRID_SEARCH_RESULT_LIMIT = 50

// Char budget when building content_text for the reranker (per entity_type)
export const RERANK_CHAR_LIMITS: Record<string, number> = {
  candidate: 5000,
  note: 3000,
  company: 2500,
  contact: 800,
  job_opening: 4000,
}

// Voyage rerank
export const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank'
export const RERANK_MODEL = 'rerank-2.5'
export const RERANK_TOP_K = 10

// API safety
export const MAX_QUERY_LENGTH = 1000
