import { createClient } from '@/lib/supabase/server'
import {
  CANDIDATE_COLUMNS,
  COMPANY_COLUMNS,
  CONTACT_COLUMNS,
  JOB_OPENING_COLUMNS,
  NOTE_COLUMNS,
} from '@/lib/supabase/columns'
import { embedQuery, rerankResults } from '@/lib/voyage/search'
import type { RerankResultItem } from '@/lib/voyage/search'
import { parseQuery } from '@/lib/supabase/search-parser'
import {
  formatCandidate,
  formatCompany,
  formatCompanyContact,
  formatJobOpening,
  formatNote,
} from '@/lib/voyage/format'
import {
  HYBRID_SEARCH_RESULT_LIMIT,
  RERANK_CHAR_LIMITS,
  STRONG_MATCH_THRESHOLD,
  GOOD_MATCH_THRESHOLD,
  MAX_QUERY_LENGTH,
  FILTER_BOOST_WEIGHT,
  RERANK_TOP_K,
} from '@/lib/voyage/config'
import type { SmartSearchResult } from '@/types/database'
import type {
  Candidate,
  CandidateCategory,
  Company,
  CompanyContact,
  JobOpening,
  Note,
  WorkHistory,
} from '@/types/database'
import { parseLocationFilter, normalizeLocationState } from '@/lib/smart-search/location-filter'
import { parseCandidateHardFilters } from '@/lib/smart-search/candidate-filter'

// ── Internal types ───────────────────────────────────────────────────────────

type HybridSearchRow = {
  entity_type: 'candidate' | 'company' | 'contact' | 'job_opening' | 'note'
  entity_id: string
  entity_name: string
  snippet: string
  result_type: 'semantic' | 'keyword' | 'both'
  similarity_score: number
  keyword_rank: number
  created_at: string
}

type RerankCandidate = {
  hybrid_row: HybridSearchRow
  entity_data: Candidate | Company | CompanyContact | JobOpening | Note
  content_text: string
  original_chars: number
  was_truncated: boolean
}

type DebugPayload = {
  timings_ms: {
    embed: number | null
    hybrid_search: number | null
    hydration: number | null
    rerank: number | null
    total: number
  }
  counts: {
    hybrid_rows: number
    after_hydration: number
    after_scope_filter: number
    after_location_filter: number
    after_candidate_hard_filter: number
    rerank_candidates: number
    returned: number
  }
  fallbacks: {
    embed_failed: boolean
    rerank_failed: boolean
  }
  truncations: Array<{
    entity_type: string
    entity_id: string
    original_chars: number
    final_chars: number
  }>
  raw_scores: Array<{
    entity_type: string
    entity_id: string
    relevance_score: number | null
    similarity_score: number
    keyword_rank: number
  }>
  parsed_filters: {
    location: {
      fired: boolean
      states: string[]
    }
    candidate_hard: {
      fired: boolean
      categories: string[] | null
      manages_people: boolean | null
    }
  }
  pipeline_ids: {
    hybrid_rows: string[]
    after_hydration: string[]
    after_scope_filter: string[]
    after_location_filter: string[]
    after_candidate_hard_filter: string[]
    rerank: string[]
    returned: string[]
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMatchLabel(
  score: number
): 'Strong match' | 'Good match' | 'Possible match' {
  if (score >= STRONG_MATCH_THRESHOLD) return 'Strong match'
  if (score >= GOOD_MATCH_THRESHOLD) return 'Good match'
  return 'Possible match'
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const tStart = performance.now()

  // Step 0 — Validate
  const VALID_SCOPES = ['all', 'candidate', 'company', 'contact', 'job_opening', 'note'] as const
  type EntityScope = (typeof VALID_SCOPES)[number]

  let body: { query?: string; includeNotes?: boolean; entityScope?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) {
    return Response.json(
      { success: false, error: 'Query is required' },
      { status: 400 }
    )
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json(
      { success: false, error: 'Query exceeds 1000 characters' },
      { status: 400 }
    )
  }

  const rawScope = body.entityScope
  const entityScope: EntityScope =
    typeof rawScope === 'string' && (VALID_SCOPES as readonly string[]).includes(rawScope)
      ? (rawScope as EntityScope)
      : 'all'

  // Notes scope forces include_notes regardless of the toggle
  const includeNotes = entityScope === 'note' ? true : (body.includeNotes ?? false)

  // Step 1 — Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Step 2 — Embed query
  let queryEmbedding: number[]
  let embedMs: number | null = null

  const t0 = performance.now()
  try {
    const result = await embedQuery(query)
    queryEmbedding = result.vector
    embedMs = performance.now() - t0
  } catch (err) {
    // ── EMBED FALLBACK PATH ──────────────────────────────────────────────
    console.error('Voyage embed failed, falling back to keyword search:', err)

    // Use the same parser as the main keyword wrapper so quoted phrases
    // behave consistently between the primary keyword path and this fallback.
    const { looseWords: fbLooseWords, phrases: fbPhrases } = parseQuery(query)
    const { data: fallbackRows, error: fallbackError } = await supabase.rpc(
      'global_search_v2',
      { search_query: fbLooseWords, phrases: fbPhrases }
    )

    if (fallbackError) {
      console.error('global_search fallback also failed:', fallbackError)
      return Response.json(
        { success: false, error: 'Search failed' },
        { status: 500 }
      )
    }

    const rows = (fallbackRows ?? []) as Array<{
      entity_type: string
      entity_id: string
      entity_name: string
      match_source: string
      snippet: string
      rank: number
      created_at: string
    }>

    const top10 = rows.slice(0, 10)

    const results: SmartSearchResult[] = top10.map((row) => ({
      entity_type: row.entity_type as SmartSearchResult['entity_type'],
      entity_id: row.entity_id,
      entity_name: row.entity_name,
      snippet: row.snippet,
      result_type: 'keyword' as const,
      similarity_score: 0,
      keyword_rank: row.rank,
      rerank_score: null,
      match_label: null,
      created_at: row.created_at,
    }))

    const _debug: DebugPayload = {
      timings_ms: {
        embed: null,
        hybrid_search: null,
        hydration: null,
        rerank: null,
        total: performance.now() - tStart,
      },
      counts: {
        hybrid_rows: 0,
        after_hydration: 0,
        after_scope_filter: 0,
        after_location_filter: 0,
        after_candidate_hard_filter: 0,
        rerank_candidates: 0,
        returned: results.length,
      },
      fallbacks: { embed_failed: true, rerank_failed: false },
      truncations: [],
      raw_scores: results.map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        relevance_score: null,
        similarity_score: 0,
        keyword_rank: r.keyword_rank,
      })),
      parsed_filters: {
        location: { fired: false, states: [] },
        candidate_hard: { fired: false, categories: null, manages_people: null },
      },
      pipeline_ids: {
        hybrid_rows: [],
        after_hydration: [],
        after_scope_filter: [],
        after_location_filter: [],
        after_candidate_hard_filter: [],
        rerank: [],
        returned: results.map((r) => r.entity_id),
      },
    }

    return Response.json({ success: true, data: { results, _debug } })
  }

  // Step 3 — Hybrid search
  const t1 = performance.now()
  const { data: hybridRows, error: hybridError } = await supabase.rpc(
    'hybrid_search',
    {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      query_text: query,
      include_notes: includeNotes,
      result_limit: HYBRID_SEARCH_RESULT_LIMIT,
      filter_entity_type: entityScope === 'all' ? null : entityScope,
    }
  )
  const hybridSearchMs = performance.now() - t1

  if (hybridError) {
    console.error('hybrid_search RPC failed:', hybridError)
    return Response.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    )
  }

  const typedRows = (hybridRows ?? []) as HybridSearchRow[]

  // Empty results — return early with full _debug
  if (typedRows.length === 0) {
    const _debug: DebugPayload = {
      timings_ms: {
        embed: embedMs,
        hybrid_search: hybridSearchMs,
        hydration: null,
        rerank: null,
        total: performance.now() - tStart,
      },
      counts: {
        hybrid_rows: 0,
        after_hydration: 0,
        after_scope_filter: 0,
        after_location_filter: 0,
        after_candidate_hard_filter: 0,
        rerank_candidates: 0,
        returned: 0,
      },
      fallbacks: { embed_failed: false, rerank_failed: false },
      truncations: [],
      raw_scores: [],
      parsed_filters: {
        location: { fired: false, states: [] },
        candidate_hard: { fired: false, categories: null, manages_people: null },
      },
      pipeline_ids: {
        hybrid_rows: [],
        after_hydration: [],
        after_scope_filter: [],
        after_location_filter: [],
        after_candidate_hard_filter: [],
        rerank: [],
        returned: [],
      },
    }
    return Response.json({
      success: true,
      data: { results: [], _debug },
    })
  }

  // Step 4 — Hydration (fan-out fetch)
  const t2 = performance.now()

  const candidateIds = typedRows
    .filter((r) => r.entity_type === 'candidate')
    .map((r) => r.entity_id)
  const companyIds = typedRows
    .filter((r) => r.entity_type === 'company')
    .map((r) => r.entity_id)
  const contactIds = typedRows
    .filter((r) => r.entity_type === 'contact')
    .map((r) => r.entity_id)
  const jobIds = typedRows
    .filter((r) => r.entity_type === 'job_opening')
    .map((r) => r.entity_id)
  const noteIds = typedRows
    .filter((r) => r.entity_type === 'note')
    .map((r) => r.entity_id)

  const [
    candidatesResult,
    companiesResult,
    contactsResult,
    jobsResult,
    notesResult,
  ] = await Promise.all([
    candidateIds.length
      ? supabase
          .from('candidates')
          .select(`${CANDIDATE_COLUMNS}, work_history(*)`)
          .in('id', candidateIds)
      : Promise.resolve({ data: [] as (Candidate & { work_history: WorkHistory[] })[], error: null }),
    companyIds.length
      ? supabase.from('companies').select(COMPANY_COLUMNS).in('id', companyIds)
      : Promise.resolve({ data: [] as Company[], error: null }),
    contactIds.length
      ? supabase.from('company_contacts').select(`${CONTACT_COLUMNS}, company:companies(name)`).in('id', contactIds)
      : Promise.resolve({ data: [] as ContactWithCompany[], error: null }),
    jobIds.length
      ? supabase.from('job_openings').select(JOB_OPENING_COLUMNS).in('id', jobIds)
      : Promise.resolve({ data: [] as JobOpening[], error: null }),
    noteIds.length
      ? supabase.from('notes').select(NOTE_COLUMNS).in('id', noteIds)
      : Promise.resolve({ data: [] as Note[], error: null }),
  ])

  // Build O(1) lookup maps
  const candidateMap = new Map<string, Candidate & { work_history: WorkHistory[] }>()
  for (const c of (candidatesResult.data ?? []) as (Candidate & { work_history: WorkHistory[] })[]) {
    // Sort work_history by sort_order ASC.
    // Per LinkedIn/Apify import convention, sort_order = 0 is the CURRENT/most-recent role.
    // ASC puts the current role first (newest first). Note: formatCandidate also re-sorts
    // internally with the same comparator, so this pre-sort is currently redundant. Kept
    // here for consistency with format.ts and as defense against future refactors that
    // might remove the internal re-sort.
    c.work_history = [...(c.work_history ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    )
    candidateMap.set(c.id, c)
  }

  const companyMap = new Map<string, Company>()
  for (const co of (companiesResult.data ?? []) as Company[]) {
    companyMap.set(co.id, co)
  }

  type ContactWithCompany = CompanyContact & { company: { name: string } | null }
  const contactMap = new Map<string, ContactWithCompany>()
  for (const cc of (contactsResult.data ?? []) as ContactWithCompany[]) {
    contactMap.set(cc.id, cc)
  }

  const jobMap = new Map<string, JobOpening>()
  for (const j of (jobsResult.data ?? []) as JobOpening[]) {
    jobMap.set(j.id, j)
  }

  const noteMap = new Map<string, Note>()
  for (const n of (notesResult.data ?? []) as Note[]) {
    noteMap.set(n.id, n)
  }

  // Step 5 — Build the aligned array
  const rerankCandidates: RerankCandidate[] = []

  for (const row of typedRows) {
    let entity: Candidate | Company | CompanyContact | JobOpening | Note | undefined
    let formatted = ''

    switch (row.entity_type) {
      case 'candidate': {
        const c = candidateMap.get(row.entity_id)
        if (!c) continue
        entity = c
        formatted = formatCandidate(c, c.work_history)
        break
      }
      case 'company': {
        const co = companyMap.get(row.entity_id)
        if (!co) continue
        entity = co
        formatted = formatCompany(co)
        break
      }
      case 'contact': {
        const cc = contactMap.get(row.entity_id)
        if (!cc) continue
        entity = cc
        formatted = formatCompanyContact(cc, cc.company?.name)
        break
      }
      case 'job_opening': {
        const j = jobMap.get(row.entity_id)
        if (!j) continue
        entity = j
        formatted = formatJobOpening(j)
        break
      }
      case 'note': {
        const n = noteMap.get(row.entity_id)
        if (!n) continue
        entity = n
        formatted = formatNote(n)
        break
      }
    }

    if (!entity || !formatted.trim()) continue

    const limit = RERANK_CHAR_LIMITS[row.entity_type] ?? 3000
    const original_chars = formatted.length
    const was_truncated = original_chars > limit
    const content_text = was_truncated
      ? formatted.substring(0, limit)
      : formatted

    rerankCandidates.push({
      hybrid_row: row,
      entity_data: entity,
      content_text,
      original_chars,
      was_truncated,
    })
  }

  const hydrationMs = performance.now() - t2

  // Step 5b — Entity scope filter (applied before rerank to reduce Voyage token usage)
  const scopedCandidates =
    entityScope === 'all'
      ? rerankCandidates
      : rerankCandidates.filter((rc) => rc.hybrid_row.entity_type === entityScope)

  // Step 5c — Candidate location filter REMOVED in Phase 2X.1.
  // locationFilter signal still parsed (above) and applied as soft-boost after rerank.
  const locationFilter = parseLocationFilter(query)
  const locationFilteredCandidates = scopedCandidates

  // Step 5d — Candidate category / manages_people filter REMOVED in Phase 2X.1.
  // candidateHardFilters signal still parsed (above) and applied as soft-boost after rerank.
  const candidateHardFilters = parseCandidateHardFilters(query)
  const finalCandidates = locationFilteredCandidates

  // All rows had missing entities, empty content, or were filtered out by scope/location/hard-filter
  if (finalCandidates.length === 0) {
    const _debug: DebugPayload = {
      timings_ms: {
        embed: embedMs,
        hybrid_search: hybridSearchMs,
        hydration: hydrationMs,
        rerank: null,
        total: performance.now() - tStart,
      },
      counts: {
        hybrid_rows: typedRows.length,
        after_hydration: rerankCandidates.length,
        after_scope_filter: scopedCandidates.length,
        after_location_filter: locationFilteredCandidates.length,
        after_candidate_hard_filter: 0,
        rerank_candidates: 0,
        returned: 0,
      },
      fallbacks: { embed_failed: false, rerank_failed: false },
      truncations: [],
      raw_scores: [],
      parsed_filters: {
        location: {
          fired: locationFilter !== null,
          states: locationFilter ? [...locationFilter.states] : [],
        },
        candidate_hard: {
          fired: candidateHardFilters !== null,
          categories: candidateHardFilters?.categories ? [...candidateHardFilters.categories] : null,
          manages_people: candidateHardFilters?.managesPeople ?? null,
        },
      },
      pipeline_ids: {
        hybrid_rows: typedRows.map((r) => r.entity_id),
        after_hydration: rerankCandidates.map((rc) => rc.hybrid_row.entity_id),
        after_scope_filter: scopedCandidates.map((rc) => rc.hybrid_row.entity_id),
        after_location_filter: locationFilteredCandidates.map((rc) => rc.hybrid_row.entity_id),
        after_candidate_hard_filter: [],
        rerank: [],
        returned: [],
      },
    }
    return Response.json({
      success: true,
      data: { results: [], _debug },
    })
  }

  // Step 6 — Rerank
  const documents = finalCandidates.map((c) => c.content_text)
  let rerankItems: RerankResultItem[] | null = null
  let rerankFallback = false
  let rerankMs: number | null = null
  let rerankPipelineIds: string[] = []

  const t3 = performance.now()
  try {
    const response = await rerankResults(query, documents)
    rerankItems = response.data
    rerankMs = performance.now() - t3
  } catch (err) {
    console.error('Voyage rerank failed:', err)
    rerankFallback = true
  }

  // rawScoreMap captures the pre-boost Voyage relevance_score for each entity
  // so _debug.raw_scores can report the true raw score (not the boosted one).
  // Only populated in the success path; Map.get() returns undefined in fallback → ?? null.
  const rawScoreMap = new Map<string, number>()

  let results: SmartSearchResult[]

  if (rerankFallback || !rerankItems) {
    // ── RERANK FALLBACK PATH ─────────────────────────────────────────────
    // Sort by keyword_rank DESC, then similarity_score DESC. Take top 10.
    const sorted = [...finalCandidates].sort((a, b) => {
      const rankDiff = b.hybrid_row.keyword_rank - a.hybrid_row.keyword_rank
      if (rankDiff !== 0) return rankDiff
      return b.hybrid_row.similarity_score - a.hybrid_row.similarity_score
    })
    const top10 = sorted.slice(0, 10)

    results = top10.map((rc) => {
      const r: SmartSearchResult = {
        entity_type: rc.hybrid_row.entity_type,
        entity_id: rc.hybrid_row.entity_id,
        entity_name: rc.hybrid_row.entity_name,
        snippet: rc.hybrid_row.snippet,
        result_type: rc.hybrid_row.result_type,
        similarity_score: rc.hybrid_row.similarity_score,
        keyword_rank: rc.hybrid_row.keyword_rank,
        rerank_score: null,
        match_label: null,
        created_at: rc.hybrid_row.created_at,
      }

      // Note parent routing
      if (rc.hybrid_row.entity_type === 'note') {
        const note = rc.entity_data as Note
        r.note_parent_entity_type = note.entity_type
        r.note_parent_entity_id = note.entity_id
      }

      // Contact routing — detail page requires company_id
      if (rc.hybrid_row.entity_type === 'contact') {
        const cc = rc.entity_data as CompanyContact
        r.contact_company_id = cc.company_id
      }

      return r
    })
  } else {
    // ── RERANK SUCCESS PATH ──────────────────────────────────────────────

    // Step 6.5 — Apply filter soft-boost (Phase 2X.1)
    // For each Voyage-scored candidate, add boost based on matched filter signals.
    // Boost only applies to entity_type === 'candidate' rows. Non-candidates get 0.

    type BoostedItem = { item: RerankResultItem; boostedScore: number }

    const boostedItems: BoostedItem[] = rerankItems.map((item) => {
      const rc = finalCandidates[item.index]
      rawScoreMap.set(rc.hybrid_row.entity_id, item.relevance_score)
      let boost = 0

      if (rc.hybrid_row.entity_type === 'candidate') {
        const c = rc.entity_data as Candidate

        // Location boost
        if (locationFilter !== null) {
          const normalized = normalizeLocationState(c.location_state)
          if (normalized !== null && locationFilter.states.has(normalized)) {
            boost += FILTER_BOOST_WEIGHT
          }
        }

        // Category boost
        if (
          candidateHardFilters !== null &&
          candidateHardFilters.categories !== undefined &&
          candidateHardFilters.categories.has(c.category as CandidateCategory)
        ) {
          boost += FILTER_BOOST_WEIGHT
        }

        // manages_people boost
        if (
          candidateHardFilters !== null &&
          candidateHardFilters.managesPeople !== undefined &&
          c.manages_people === candidateHardFilters.managesPeople
        ) {
          boost += FILTER_BOOST_WEIGHT
        }
      }

      return {
        item,
        boostedScore: item.relevance_score + boost,
      }
    })

    // Sort by boosted score descending
    boostedItems.sort((a, b) => b.boostedScore - a.boostedScore)

    // Capture rerank pipeline_ids snapshot (post-boost-sort, PRE-trim)
    // This is the diagnostic value — exposes candidates ranked beyond top K
    // that got trimmed after boost was applied.
    rerankPipelineIds = boostedItems.map(
      (b) => finalCandidates[b.item.index].hybrid_row.entity_id
    )

    // Trim to top RERANK_TOP_K client-side
    const trimmed = boostedItems.slice(0, RERANK_TOP_K)

    // Build results from trimmed list
    results = trimmed.map(({ item, boostedScore }) => {
      const rc = finalCandidates[item.index]
      const r: SmartSearchResult = {
        entity_type: rc.hybrid_row.entity_type,
        entity_id: rc.hybrid_row.entity_id,
        entity_name: rc.hybrid_row.entity_name,
        snippet: rc.hybrid_row.snippet,
        result_type: rc.hybrid_row.result_type,
        similarity_score: rc.hybrid_row.similarity_score,
        keyword_rank: rc.hybrid_row.keyword_rank,
        rerank_score: boostedScore,
        match_label: buildMatchLabel(boostedScore),
        created_at: rc.hybrid_row.created_at,
      }

      // Note parent routing
      if (rc.hybrid_row.entity_type === 'note') {
        const note = rc.entity_data as Note
        r.note_parent_entity_type = note.entity_type
        r.note_parent_entity_id = note.entity_id
      }

      // Contact routing — detail page requires company_id
      if (rc.hybrid_row.entity_type === 'contact') {
        const cc = rc.entity_data as CompanyContact
        r.contact_company_id = cc.company_id
      }

      return r
    })
  }

  // Step 7 — Build _debug and return
  const totalMs = performance.now() - tStart

  const _debug: DebugPayload = {
    timings_ms: {
      embed: embedMs,
      hybrid_search: hybridSearchMs,
      hydration: hydrationMs,
      rerank: rerankMs,
      total: totalMs,
    },
    counts: {
      hybrid_rows: typedRows.length,
      after_hydration: rerankCandidates.length,
      after_scope_filter: scopedCandidates.length,
      after_location_filter: locationFilteredCandidates.length,
      after_candidate_hard_filter: finalCandidates.length,
      rerank_candidates: documents.length,
      returned: results.length,
    },
    fallbacks: {
      embed_failed: false,
      rerank_failed: rerankFallback,
    },
    truncations: finalCandidates
      .filter((c) => c.was_truncated)
      .map((c) => ({
        entity_type: c.hybrid_row.entity_type,
        entity_id: c.hybrid_row.entity_id,
        original_chars: c.original_chars,
        final_chars: c.content_text.length,
      })),
    raw_scores: results.map((r) => ({
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      relevance_score: rawScoreMap.get(r.entity_id) ?? r.rerank_score,
      similarity_score: r.similarity_score,
      keyword_rank: r.keyword_rank,
    })),
    parsed_filters: {
      location: {
        fired: locationFilter !== null,
        states: locationFilter ? [...locationFilter.states] : [],
      },
      candidate_hard: {
        fired: candidateHardFilters !== null,
        categories: candidateHardFilters?.categories ? [...candidateHardFilters.categories] : null,
        manages_people: candidateHardFilters?.managesPeople ?? null,
      },
    },
    pipeline_ids: {
      hybrid_rows: typedRows.map((r) => r.entity_id),
      after_hydration: rerankCandidates.map((rc) => rc.hybrid_row.entity_id),
      after_scope_filter: scopedCandidates.map((rc) => rc.hybrid_row.entity_id),
      after_location_filter: locationFilteredCandidates.map((rc) => rc.hybrid_row.entity_id),
      after_candidate_hard_filter: finalCandidates.map((rc) => rc.hybrid_row.entity_id),
      rerank: rerankPipelineIds,
      returned: results.map((r) => r.entity_id),
    },
  }

  return Response.json({ success: true, data: { results, _debug } })
}
