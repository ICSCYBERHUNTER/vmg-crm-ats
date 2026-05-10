/**
 * Audit script for POST /api/smart-search on production.
 *
 * Loads a corpus of test queries, runs each against the endpoint, and writes
 * raw response data + metadata for human review. Discovery only — no processing,
 * no categorization, no automation beyond fetching and logging.
 *
 * Required env var (from browser DevTools):
 *   AUDIT_COOKIE_HEADER — Full cookie header string copied from DevTools Network tab
 *
 * Optional env vars:
 *   SMART_SEARCH_BASE_URL (default: https://vmg-crm-ats.vercel.app)
 *   AUDIT_CORPUS_PATH (default: scripts/audit-corpus.json)
 *
 * Usage:
 *   npm run audit:smart-search
 *   or: npx tsx --env-file=.env.local scripts/audit-smart-search.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditQuery = {
  id: string
  category: string
  query: string
  scope?: 'all' | 'candidate' | 'company' | 'contact' | 'job_opening' | 'note'
  include_notes?: boolean
  positive_expectations?: unknown
  negative_expectations?: unknown
  relative_expectations?: unknown
  reasoning?: string
  likely_gap_categories?: string[]
}

type Corpus = {
  queries: AuditQuery[]
}

type SmartSearchResult = {
  entity_type: string
  entity_id: string
  entity_name: string
  snippet: string
  result_type: string
  similarity_score: number
  keyword_rank: number
  rerank_score: number | null
  match_label: string | null
  created_at: string
  note_parent_entity_type?: string
  note_parent_entity_id?: string
  contact_company_id?: string
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
    returned: string[]
  }
}

type ApiResponse =
  | {
      success: true
      data: {
        results: SmartSearchResult[]
        _debug: DebugPayload
      }
    }
  | {
      success: false
      error: string
    }

type AuditResult = {
  corpus_entry: AuditQuery
  request: {
    url: string
    method: string
    body: {
      query: string
      entityScope: string
      includeNotes: boolean
    }
  }
  response: {
    status: number
    ok: boolean
    body: unknown
  }
  client_timing_ms: number
  timestamp_iso: string
}

type Summary = {
  run_id: string
  started_iso: string
  finished_iso: string
  total_queries: number
  succeeded: number
  failed_4xx: number
  failed_other: number
  total_runtime_ms: number
  average_latency_ms: number
  base_url: string
  corpus_path: string
}

// ── Env validation ───────────────────────────────────────────────────────────

function validateEnv(): { cookieHeader: string; baseUrl: string; corpusPath: string } {
  const cookieHeader = process.env.AUDIT_COOKIE_HEADER

  if (!cookieHeader || cookieHeader.trim() === '') {
    console.error(
      'Missing or empty AUDIT_COOKIE_HEADER in .env.local\n' +
        'Steps to get the cookie:\n' +
        '  1. Log into https://vmg-crm-ats.vercel.app in your browser\n' +
        '  2. Open DevTools → Network tab\n' +
        '  3. Click any request to the app\n' +
        '  4. In Request Headers, find the line starting with "cookie:"\n' +
        '  5. Copy the ENTIRE value after "cookie:" (the full string)\n' +
        '  6. Add to .env.local: AUDIT_COOKIE_HEADER=<paste here>'
    )
    process.exit(1)
  }

  const baseUrl = process.env.SMART_SEARCH_BASE_URL ?? 'https://vmg-crm-ats.vercel.app'
  const corpusPath = process.env.AUDIT_CORPUS_PATH ?? 'scripts/audit-corpus.json'

  return { cookieHeader, baseUrl, corpusPath }
}

// ── Corpus loading & validation ───────────────────────────────────────────────

function loadCorpus(corpusPath: string): Corpus {
  try {
    const raw = fs.readFileSync(corpusPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const queries = Array.isArray(parsed) ? parsed : parsed.queries
    return { queries }
  } catch (err) {
    console.error(`Failed to read or parse corpus file at ${corpusPath}:`, err)
    process.exit(1)
  }
}

function validateCorpus(corpus: unknown): Corpus {
  const errors: string[] = []

  if (typeof corpus !== 'object' || corpus === null) {
    console.error('Corpus must be a JSON object')
    process.exit(1)
  }

  const c = corpus as Record<string, unknown>

  if (!Array.isArray(c.queries)) {
    errors.push('corpus.queries must be an array')
  } else {
    if (c.queries.length === 0) {
      errors.push('corpus.queries must be non-empty')
    }

    const seenIds = new Set<string>()
    for (let i = 0; i < c.queries.length; i++) {
      const q = c.queries[i]
      if (typeof q !== 'object' || q === null) {
        errors.push(`queries[${i}]: entry must be an object`)
        continue
      }

      const entry = q as Record<string, unknown>

      if (typeof entry.id !== 'string' || entry.id.trim() === '') {
        errors.push(`queries[${i}]: missing or empty id`)
      } else {
        if (seenIds.has(entry.id)) {
          errors.push(`queries[${i}]: duplicate id "${entry.id}"`)
        }
        seenIds.add(entry.id)
      }

      if (typeof entry.query !== 'string') {
        errors.push(`queries[${i}] (id="${entry.id}"): query must be a string`)
      } else if (entry.query.length === 0 || entry.query.length > 1000) {
        errors.push(
          `queries[${i}] (id="${entry.id}"): query must be 1-1000 chars (got ${entry.query.length})`
        )
      }

      if (entry.scope !== undefined) {
        const validScopes = ['all', 'candidate', 'company', 'contact', 'job_opening', 'note']
        if (typeof entry.scope !== 'string' || !validScopes.includes(entry.scope)) {
          errors.push(
            `queries[${i}] (id="${entry.id}"): scope must be one of ${validScopes.join(', ')} (got "${entry.scope}")`
          )
        }
      }

      if (entry.include_notes !== undefined && typeof entry.include_notes !== 'boolean') {
        errors.push(`queries[${i}] (id="${entry.id}"): include_notes must be boolean`)
      }
    }
  }

  if (errors.length > 0) {
    console.error('Corpus validation failed:')
    for (const err of errors) {
      console.error(`  - ${err}`)
    }
    process.exit(1)
  }

  return corpus as Corpus
}

// ── Output directory setup ────────────────────────────────────────────────────

function createOutputDir(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const mins = String(now.getMinutes()).padStart(2, '0')
  const runId = `run-${year}${month}${date}-${hours}${mins}`

  const dirPath = path.join(process.cwd(), 'scripts', 'output', 'audit-runs', runId)

  fs.mkdirSync(dirPath, { recursive: true })
  return dirPath
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const scriptStart = new Date()
  const { cookieHeader, baseUrl, corpusPath } = validateEnv()

  console.log(`Loading corpus from ${corpusPath}...`)
  const rawCorpus = loadCorpus(corpusPath)
  const corpus = validateCorpus(rawCorpus)

  const outputDir = createOutputDir()
  console.log(`Output directory: ${outputDir}\n`)

  const results: AuditResult[] = []
  const timings: number[] = []

  let succeeded = 0
  let failed4xx = 0
  let failedOther = 0
  let consecutiveFailures = 0
  let halted = false

  for (let i = 0; i < corpus.queries.length; i++) {
    if (halted) break
    const entry = corpus.queries[i]
    const progressIdx = i + 1

    const postBody = {
      query: entry.query,
      entityScope: entry.scope ?? 'all',
      includeNotes: entry.include_notes ?? false,
    }

    const timestamp = new Date().toISOString()
    const clientStart = Date.now()

    let status = 0
    let ok = false
    let responseBody: unknown = null
    let bodyText = ''

    try {
      const response = await fetch(`${baseUrl}/api/smart-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
        },
        body: JSON.stringify(postBody),
      })

      status = response.status
      ok = response.ok

      // Read body exactly once, as text
      try {
        bodyText = await response.text()
      } catch (e) {
        bodyText = `<body read failed: ${e instanceof Error ? e.message : String(e)}>`
      }

      // Parse from saved text if it's JSON
      let bodyParsed: unknown = null
      try {
        bodyParsed = JSON.parse(bodyText)
      } catch {
        // Not JSON — bodyText preserved as-is for logging
      }
      responseBody = bodyParsed || bodyText

      const clientEnd = Date.now()
      const clientTiming = clientEnd - clientStart
      timings.push(clientTiming)

      // Count results for logging
      let resultCount: string | number = 'ERROR'
      if (ok && typeof bodyParsed === 'object' && bodyParsed !== null) {
        const rb = bodyParsed as Record<string, unknown>
        if (rb.data && typeof rb.data === 'object') {
          const data = rb.data as Record<string, unknown>
          if (Array.isArray(data.results)) {
            resultCount = data.results.length
          }
        }
      }

      if (status === 200) {
        succeeded++
        consecutiveFailures = 0
        console.log(
          `[${progressIdx}/${corpus.queries.length}] ${entry.id}: "${entry.query.slice(0, 60)}..." → 200 (${clientTiming}ms, ${resultCount} results)`
        )
      } else {
        // Non-200 HTTP response
        failedOther++
        consecutiveFailures++
        console.warn(
          `[${progressIdx}/${corpus.queries.length}] ${entry.id}: "${entry.query.slice(0, 60)}..." → HTTP ${status} (${clientTiming}ms)`
        )

        // Halt on 2 consecutive failures
        if (consecutiveFailures >= 2) {
          console.error('')
          console.error('═══════════════════════════════════════════════════════════════')
          console.error('HALTING: 2 consecutive failures')
          console.error('═══════════════════════════════════════════════════════════════')
          console.error(`Last status:  HTTP ${status}`)
          console.error(`Last reason:  ${bodyText.slice(0, 200)}`)
          console.error('Likely causes:')
          console.error('  - Cookie expired → refresh AUDIT_COOKIE_HEADER in .env.local')
          console.error('  - App is down or Vercel deploy in progress')
          console.error('  - Rate limit hit')
          console.error('═══════════════════════════════════════════════════════════════')
          process.exitCode = 2
          halted = true
        }
      }
    } catch (err) {
      const clientEnd = Date.now()
      const clientTiming = clientEnd - clientStart
      timings.push(clientTiming)

      failedOther++
      consecutiveFailures++
      responseBody = {
        _fetch_error: String(err),
      }

      const errorMsg = err instanceof Error ? err.message : String(err)
      const errorSnippet = errorMsg.slice(0, 80)
      console.warn(
        `[${progressIdx}/${corpus.queries.length}] ${entry.id}: "${entry.query.slice(0, 60)}..." → FETCH ERROR (${clientTiming}ms): ${errorSnippet}`
      )

      // Halt on 2 consecutive failures
      if (consecutiveFailures >= 2) {
        console.error('')
        console.error('═══════════════════════════════════════════════════════════════')
        console.error('HALTING: 2 consecutive failures')
        console.error('═══════════════════════════════════════════════════════════════')
        console.error(`Last status:  fetch threw`)
        console.error(`Last reason:  ${errorMsg.slice(0, 200)}`)
        console.error('Likely causes:')
        console.error('  - Cookie expired → refresh AUDIT_COOKIE_HEADER in .env.local')
        console.error('  - App is down or Vercel deploy in progress')
        console.error('  - Rate limit hit')
        console.error('═══════════════════════════════════════════════════════════════')
        process.exitCode = 2
        halted = true
      }
    }

    const clientEnd = Date.now()
    const clientTiming = clientEnd - clientStart

    const auditResult: AuditResult = {
      corpus_entry: entry,
      request: {
        url: `${baseUrl}/api/smart-search`,
        method: 'POST',
        body: postBody,
      },
      response: {
        status,
        ok,
        body: responseBody,
      },
      client_timing_ms: clientTiming,
      timestamp_iso: timestamp,
    }

    results.push(auditResult)

    // Write individual result file
    const resultPath = path.join(outputDir, `${entry.id}.json`)
    fs.writeFileSync(resultPath, JSON.stringify(auditResult, null, 2), 'utf-8')
  }

  // Write summary
  const scriptEnd = new Date()
  const totalRuntimeMs = scriptEnd.getTime() - scriptStart.getTime()
  const avgLatency =
    succeeded > 0 ? timings.slice(0, succeeded).reduce((a, b) => a + b, 0) / succeeded : 0

  const summary: Summary = {
    run_id: path.basename(outputDir),
    started_iso: scriptStart.toISOString(),
    finished_iso: scriptEnd.toISOString(),
    total_queries: corpus.queries.length,
    succeeded,
    failed_4xx: failed4xx,
    failed_other: failedOther,
    total_runtime_ms: totalRuntimeMs,
    average_latency_ms: Math.round(avgLatency),
    base_url: baseUrl,
    corpus_path: corpusPath,
  }

  const summaryPath = path.join(outputDir, '_summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')

  // Print summary
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('Audit Complete')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Run ID:             ${summary.run_id}`)
  console.log(`Started:            ${summary.started_iso}`)
  console.log(`Finished:           ${summary.finished_iso}`)
  console.log(`Total Queries:      ${summary.total_queries}`)
  console.log(`Succeeded (200):    ${summary.succeeded}`)
  console.log(`Failed (4xx):       ${summary.failed_4xx}`)
  console.log(`Failed (other):     ${summary.failed_other}`)
  console.log(`Total Runtime:      ${summary.total_runtime_ms}ms`)
  console.log(`Avg Latency (OK):   ${summary.average_latency_ms}ms`)
  console.log(`Base URL:           ${summary.base_url}`)
  console.log(`Corpus Path:        ${summary.corpus_path}`)
  console.log(`Output:             ${outputDir}`)
  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
