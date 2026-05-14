// Match label thresholds — applied to rerank_score when available
export const STRONG_MATCH_THRESHOLD = 0.90
export const GOOD_MATCH_THRESHOLD = 0.85

// Total cap passed to hybrid_search() — function caps internally too
// Aligned with SQL DEFAULT 75 (Phase 2X.1.7: reverted Phase 2X.1.5
// widening — keyword rank diagnostic showed widening didn't fix recall)
export const HYBRID_SEARCH_RESULT_LIMIT = 75

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

// Filter soft-boost (Phase 2X.1) — applied to Voyage rerank_score when
// query-parsed filter signals (location, category, manages_people) match
// the candidate's attributes. Max boost = 3 × FILTER_BOOST_WEIGHT.
export const FILTER_BOOST_WEIGHT = 0.05

// API safety
export const MAX_QUERY_LENGTH = 1000
