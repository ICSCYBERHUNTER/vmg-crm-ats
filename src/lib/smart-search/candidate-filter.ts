// Smart Search candidate hard filters
//
// Detects explicit category and manages_people intent in a query and returns
// a filter object to hard-filter candidate results against.
//
// Design principles:
// - Returns null when no explicit intent is detected — callers pass through unchanged.
// - Non-candidate rows must always pass through; the caller is responsible for that gate.
// - Only activates on clear functional-category phrasing, not incidental keyword overlap.
// - "manager" alone never triggers manages_people; the phrase must imply people leadership.

import type { CandidateCategory } from '@/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CandidateHardFilters = {
  categories?: Set<CandidateCategory>
  managesPeople?: boolean
}

// ── Category intent patterns ──────────────────────────────────────────────────
// Each entry maps one or more regexes to a CandidateCategory DB value.
// Patterns are designed to fire only on clear functional-role phrasing,
// not on incidental keyword matches (e.g. bare "engineer" won't fire).

const CATEGORY_PATTERNS: Array<{ patterns: RegExp[]; category: CandidateCategory }> = [
  {
    // sales_engineering: presales / pre-sales / solutions engineers / sales engineers
    // "sales engineer" by itself (without plural or "ing") also maps here
    patterns: [
      /\bpre[\s-]?sales\b/i,
      /\bpresales\b/i,
      /\bsolutions?\s+engineer(s|ing)?\b/i,
      /\bsales\s+engineer(s|ing)?\s+(candidate|hire|role|profile)/i,
    ],
    category: 'sales_engineering',
  },
  {
    // channel: channel sales / channel partner(s) / channel candidates/hire
    patterns: [
      /\bchannel\s+sales\b/i,
      /\bchannel\s+partner(s)?\b/i,
      /\bchannel\s+candidate(s)?\b/i,
      /\bchannel\s+hire(s)?\b/i,
    ],
    category: 'channel',
  },
  {
    // marketing: marketing candidates / marketing hire(s)
    patterns: [
      /\bmarketing\s+candidate(s)?\b/i,
      /\bmarketing\s+hire(s)?\b/i,
    ],
    category: 'marketing',
  },
  {
    // product: product candidates / product manager candidates / product hire(s)
    patterns: [
      /\bproduct\s+candidate(s)?\b/i,
      /\bproduct\s+manager\s+candidate(s)?\b/i,
      /\bproduct\s+hire(s)?\b/i,
    ],
    category: 'product',
  },
  {
    // customer_success: customer success candidates / customer success hire(s)
    patterns: [
      /\bcustomer\s+success\s+candidate(s)?\b/i,
      /\bcustomer\s+success\s+hire(s)?\b/i,
    ],
    category: 'customer_success',
  },
  {
    // operations: operations candidates / ops candidates / operations hire(s)
    patterns: [
      /\boperations\s+candidate(s)?\b/i,
      /\bops\s+candidate(s)?\b/i,
      /\boperations\s+hire(s)?\b/i,
    ],
    category: 'operations',
  },
  {
    // engineering: engineering candidates / software engineer candidates /
    // security engineer candidates — but NOT bare "engineer" or "engineers"
    patterns: [
      /\bengineering\s+candidate(s)?\b/i,
      /\bengineering\s+hire(s)?\b/i,
      /\bsoftware\s+engineer(s)?\s+candidate(s)?\b/i,
      /\bsecurity\s+engineer(s)?\s+candidate(s)?\b/i,
    ],
    category: 'engineering',
  },
  {
    // sales: sales candidates / sales hire(s) / sales rep(s)
    // Must come after sales_engineering so "sales engineering candidates" hits that first.
    // Also gates on "sales candidates/hire/reps" — not bare "sales" — to avoid firing
    // on "OT cybersecurity sales leaders" (which should only trigger manages_people).
    patterns: [
      /\bsales\s+candidate(s)?\b/i,
      /\bsales\s+hire(s)?\b/i,
      /\bsales\s+rep(s|resentative(s)?)?\b/i,
    ],
    category: 'sales',
  },
]

// ── Manages-people intent patterns ───────────────────────────────────────────
// Each regex must clearly imply people-leadership, not just any "manager" role.
// "product manager", "account manager", "manager role" — intentionally excluded.

const MANAGES_PEOPLE_PATTERNS: RegExp[] = [
  /\bmanages?\s+people\b/i,
  /\bpeople\s+manager(s)?\b/i,
  /\bpeople\s+management\b/i,
  /\bdirect\s+reports?\b/i,
  /\bleadership\s+experience\b/i,
  /\bteam\s+lead(er(s)?)?\b/i,
  /\bmanaged\s+a\s+team\b/i,
  /\bmanages?\s+a\s+team\b/i,
  /\bleads?\s+a\s+team\b/i,
]

// ── Main export ───────────────────────────────────────────────────────────────

export function parseCandidateHardFilters(query: string): CandidateHardFilters | null {
  const filters: CandidateHardFilters = {}

  // Check category intent
  const matchedCategories = new Set<CandidateCategory>()
  for (const { patterns, category } of CATEGORY_PATTERNS) {
    if (patterns.some((p) => p.test(query))) {
      matchedCategories.add(category)
    }
  }
  if (matchedCategories.size > 0) {
    filters.categories = matchedCategories
  }

  // Check manages_people intent
  if (MANAGES_PEOPLE_PATTERNS.some((p) => p.test(query))) {
    filters.managesPeople = true
  }

  // Return null when nothing was detected — caller skips filter entirely
  if (filters.categories === undefined && filters.managesPeople === undefined) {
    return null
  }

  return filters
}
