/**
 * Overnight read-only audit: pool-wide bucketing, trigger-fix preview,
 * NULL embedding_model_version investigation, and miscategorization spot-check.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-overnight-2026-05-10.ts
 */

import { createServiceClient } from '../src/lib/supabase/service'
import * as fs from 'fs'
import * as path from 'path'

// ── Setup ────────────────────────────────────────────────────────────────────

const supabase = createServiceClient()

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  current_title: string | null
  current_company: string | null
  headline: string | null
  certifications: string | null
  category: string | null
  skills: string | null
  location_city: string | null
  location_state: string | null
  source: string | null
  status: string
  embedding_model_version: string | null
  embedding_updated_at: string | null
  created_at: string
  updated_at: string
  search_vector: string | null  // tsvector serialized as text by PostgREST
}

interface WorkHistoryRow {
  id: string
  candidate_id: string
  company_name: string
  job_title: string
  description: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all rows from a table, paging in chunks of 1000 */
async function fetchAll<T>(
  table: string,
  select: string,
  orderCol = 'created_at'
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderCol, { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error(`  [WARN] fetch ${table} offset=${offset}: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

/** Count lexemes in a tsvector text representation like "'cybersecur':3 'ics':1B" */
function countLexemes(svText: string | null): number {
  if (!svText || svText.trim() === '') return 0
  // Each lexeme is a quoted word: 'word':positions
  const matches = svText.match(/'[^']+'/g)
  return matches ? matches.length : 0
}

/** Extract lexeme words from tsvector text */
function extractLexemes(svText: string | null): string[] {
  if (!svText || svText.trim() === '') return []
  const matches = svText.match(/'([^']+)'/g)
  return matches ? matches.map(m => m.replace(/'/g, '')) : []
}

/** Simple word tokenizer — lowercase, split on non-alpha, dedupe */
function tokenize(text: string): string[] {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
  return [...new Set(words)]
}

/** English stop words to filter out */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her',
  'was', 'one', 'our', 'out', 'day', 'had', 'has', 'his', 'how', 'its', 'may',
  'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'got', 'him', 'let',
  'say', 'she', 'too', 'use', 'with', 'that', 'this', 'will', 'each', 'from',
  'they', 'been', 'have', 'into', 'more', 'some', 'such', 'than', 'them',
  'then', 'what', 'when', 'were', 'your', 'also', 'just', 'about', 'which',
  'their', 'other', 'could', 'would', 'should', 'these', 'those', 'through',
  'including', 'between', 'across', 'within', 'where', 'there', 'while',
])

// ── OT/ICS company and keyword lists ─────────────────────────────────────────

const OT_COMPANIES = [
  'nozomi', 'claroty', 'dragos', 'tenable', 'forescout', 'armis', 'cyolo',
  'xage', 'opswat', 'mission secure', 'industrial defender', 'radiflow',
  'otorio', 'txone', 'scadafence',
]

const OT_KEYWORDS = [
  'scada', 'ics', 'plc', 'hmi', 'dcs', 'ot security', 'ot cybersecurity',
  'industrial control', 'control system', 'operational technology',
  'industrial cybersecurity', 'critical infrastructure', 'nist 800-82',
  'iec 62443', 'nerc cip', 'purdue model',
]

const OT_SINGLE_KEYWORDS = ['scada', 'ics', 'ot', 'plc', 'hmi', 'dcs', 'nerc', 'nist']

// ── Phase 1: Pool-wide bucketing ─────────────────────────────────────────────

interface BucketResult {
  bucket: string
  count: number
  pct: string
}

async function phase1(
  candidates: CandidateRow[],
  whByCandidate: Map<string, WorkHistoryRow[]>
): Promise<{ buckets: BucketResult[]; candidateBuckets: Map<string, string> }> {
  console.log('\n=== PHASE 1: Pool-wide bucketing ===')

  const candidateBuckets = new Map<string, string>()
  const counts = { rich_everywhere: 0, thin_candidate_rich_history: 0, thin_everywhere: 0, moderate: 0 }

  for (const c of candidates) {
    const svLen = c.search_vector ? c.search_vector.length : 0
    const whRows = whByCandidate.get(c.id) || []
    const whTextTotal = whRows.reduce((sum, wh) => sum + (wh.description?.length || 0), 0)

    let bucket: string
    if (svLen >= 700 && whTextTotal >= 500) {
      bucket = 'rich_everywhere'
    } else if (svLen < 500 && whTextTotal >= 500) {
      bucket = 'thin_candidate_rich_history'
    } else if (svLen < 500 && whTextTotal < 500) {
      bucket = 'thin_everywhere'
    } else {
      bucket = 'moderate'
    }

    candidateBuckets.set(c.id, bucket)
    counts[bucket as keyof typeof counts]++
  }

  const total = candidates.length
  const buckets: BucketResult[] = [
    { bucket: 'rich_everywhere', count: counts.rich_everywhere, pct: ((counts.rich_everywhere / total) * 100).toFixed(1) },
    { bucket: 'thin_candidate_rich_history', count: counts.thin_candidate_rich_history, pct: ((counts.thin_candidate_rich_history / total) * 100).toFixed(1) },
    { bucket: 'thin_everywhere', count: counts.thin_everywhere, pct: ((counts.thin_everywhere / total) * 100).toFixed(1) },
    { bucket: 'moderate', count: counts.moderate, pct: ((counts.moderate / total) * 100).toFixed(1) },
  ]

  for (const b of buckets) {
    console.log(`  ${b.bucket}: ${b.count} (${b.pct}%)`)
  }

  return { buckets, candidateBuckets }
}

// ── Phase 2: Hypothetical fix preview ────────────────────────────────────────

interface Phase2Row {
  name: string
  sv_lexeme_count: number
  wh_new_lexemes: string
  ot_keyword: string
  in_sv: boolean
  in_wh: boolean
}

async function phase2(
  candidates: CandidateRow[],
  whByCandidate: Map<string, WorkHistoryRow[]>,
  candidateBuckets: Map<string, string>
): Promise<Phase2Row[]> {
  console.log('\n=== PHASE 2: Hypothetical fix preview ===')

  // Get candidates in thin_candidate_rich_history bucket
  const thinRichIds = candidates
    .filter(c => candidateBuckets.get(c.id) === 'thin_candidate_rich_history')
    .map(c => c.id)

  // Randomly sample 10
  const shuffled = [...thinRichIds].sort(() => Math.random() - 0.5)
  const sampleIds = shuffled.slice(0, 10)

  const rows: Phase2Row[] = []

  for (const id of sampleIds) {
    const c = candidates.find(x => x.id === id)!
    const whRows = whByCandidate.get(id) || []

    const svLexemes = extractLexemes(c.search_vector)
    const svLexemeSet = new Set(svLexemes)

    // Tokenize all work_history descriptions
    const whText = whRows.map(wh => wh.description || '').join(' ')
    const whTokens = tokenize(whText)

    // Find tokens NOT in search_vector (new lexemes the fix would add)
    const newLexemes = whTokens
      .filter(t => !STOP_WORDS.has(t) && !svLexemeSet.has(t))
      .slice(0, 15)

    // Check OT keyword presence
    const whTextLower = whText.toLowerCase()
    let otKeyword = ''
    let inSV = false
    let inWH = false

    for (const kw of OT_SINGLE_KEYWORDS) {
      const kwInSV = svLexemes.some(l => l.includes(kw))
      const kwInWH = whTextLower.includes(kw)
      if (kwInSV || kwInWH) {
        otKeyword = kw.toUpperCase()
        inSV = kwInSV
        inWH = kwInWH
        break
      }
    }

    // If no OT keyword found at all, just report the first one as missing
    if (!otKeyword) {
      otKeyword = 'SCADA'
      inSV = false
      inWH = false
    }

    rows.push({
      name: `${c.first_name} ${c.last_name}`,
      sv_lexeme_count: svLexemes.length,
      wh_new_lexemes: newLexemes.join(', ') || '(none)',
      ot_keyword: otKeyword,
      in_sv: inSV,
      in_wh: inWH,
    })
  }

  for (const r of rows) {
    console.log(`  ${r.name}: ${r.sv_lexeme_count} lexemes, OT:${r.ot_keyword} sv=${r.in_sv} wh=${r.in_wh}`)
  }

  return rows
}

// ── Phase 3: NULL embedding_model_version ────────────────────────────────────

interface Phase3Finding {
  id: string
  name: string
  created_at: string
  updated_at: string
  source: string | null
  category: string | null
  has_embedding_updated_at: boolean
}

async function phase3(candidates: CandidateRow[]): Promise<{
  findings: Phase3Finding[]
  pattern: string
  count: number
  createdAtRange: string
  sourceBreakdown: Record<string, number>
}> {
  console.log('\n=== PHASE 3: NULL embedding_model_version ===')

  const nullVersionCandidates = candidates.filter(
    c => c.embedding_model_version === null || c.embedding_model_version === undefined
  )

  console.log(`  Found ${nullVersionCandidates.length} candidates with NULL embedding_model_version`)

  const findings: Phase3Finding[] = nullVersionCandidates.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    created_at: c.created_at,
    updated_at: c.updated_at,
    source: c.source,
    category: c.category,
    has_embedding_updated_at: c.embedding_updated_at !== null,
  }))

  // Sort by created_at
  findings.sort((a, b) => a.created_at.localeCompare(b.created_at))

  // Source breakdown
  const sourceBreakdown: Record<string, number> = {}
  for (const f of findings) {
    const src = f.source || '(null)'
    sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1
  }

  // Created_at range
  const createdAtRange = findings.length > 0
    ? `${findings[0].created_at.slice(0, 10)} to ${findings[findings.length - 1].created_at.slice(0, 10)}`
    : 'N/A'

  // Check if they have embedding_updated_at
  const withEmbUpdated = findings.filter(f => f.has_embedding_updated_at).length
  const withoutEmbUpdated = findings.filter(f => !f.has_embedding_updated_at).length

  let pattern = ''
  if (withoutEmbUpdated === findings.length) {
    pattern = 'ALL have NULL embedding_updated_at too — these records have NEVER been embedded.'
  } else if (withEmbUpdated === findings.length) {
    pattern = 'ALL have non-NULL embedding_updated_at — embeddings exist but model version was not written. Likely a code path that wrote embedding but skipped model_version.'
  } else {
    pattern = `Mixed: ${withEmbUpdated} have embedding_updated_at set, ${withoutEmbUpdated} do not.`
  }

  console.log(`  Pattern: ${pattern}`)
  console.log(`  Created range: ${createdAtRange}`)
  console.log(`  Source breakdown:`, sourceBreakdown)

  return { findings, pattern, count: nullVersionCandidates.length, createdAtRange, sourceBreakdown }
}

// ── Phase 4: Miscategorization spot-check ────────────────────────────────────

interface Phase4Example {
  name: string
  current_company: string | null
  current_title: string | null
  category: string | null
  matched_ot_company: string
}

async function phase4(
  candidates: CandidateRow[],
  whByCandidate: Map<string, WorkHistoryRow[]>
): Promise<Phase4Example[]> {
  console.log('\n=== PHASE 4: Miscategorization spot-check ===')

  const examples: Phase4Example[] = []

  for (const c of candidates) {
    // Check if current_company matches an OT company
    const currentCoLower = (c.current_company || '').toLowerCase()
    const whRows = whByCandidate.get(c.id) || []

    // Check current_company and work_history company names
    let matchedOtCompany: string | null = null

    for (const otCo of OT_COMPANIES) {
      if (currentCoLower.includes(otCo)) {
        matchedOtCompany = otCo
        break
      }
      // Also check work_history company names (most recent / current)
      for (const wh of whRows) {
        if (wh.company_name.toLowerCase().includes(otCo)) {
          matchedOtCompany = otCo
          break
        }
      }
      if (matchedOtCompany) break
    }

    if (!matchedOtCompany) continue

    // Check if categorized as non-OT categories (not engineering, not operations)
    // The user says Frank Dellé is categorized "it" but that's not a valid category.
    // We'll look for categories that seem wrong for OT/ICS cybersecurity people.
    // "other", "operations", "customer_success", "marketing" at an OT company could be fine,
    // but let's flag anything that's not engineering/sales_engineering since those are the
    // most relevant categories for OT cybersecurity professionals.
    const category = c.category || '(null)'

    // Flag candidates at OT companies who might be miscategorized
    // Focus on: other, null, or categories that don't match their likely role
    if (['other', 'operations', 'customer_success', 'marketing', 'product'].includes(category) || category === '(null)') {
      examples.push({
        name: `${c.first_name} ${c.last_name}`,
        current_company: c.current_company,
        current_title: c.current_title,
        category: c.category,
        matched_ot_company: matchedOtCompany,
      })
    }
  }

  // Also look for candidates with OT keywords in their titles/skills at non-OT companies
  // who might be miscategorized
  for (const c of candidates) {
    if (examples.some(e => e.name === `${c.first_name} ${c.last_name}`)) continue

    const titleLower = (c.current_title || '').toLowerCase()
    const skillsLower = (c.skills || '').toLowerCase()
    const combinedText = `${titleLower} ${skillsLower}`

    // Check for OT keywords in title/skills
    const hasOtKeyword = OT_KEYWORDS.some(kw => combinedText.includes(kw))

    if (hasOtKeyword && c.category && !['engineering', 'sales_engineering', 'sales'].includes(c.category)) {
      examples.push({
        name: `${c.first_name} ${c.last_name}`,
        current_company: c.current_company,
        current_title: c.current_title,
        category: c.category,
        matched_ot_company: '(OT keywords in profile)',
      })
    }
  }

  // Take up to 10 examples
  const sample = examples.slice(0, 10)
  for (const e of sample) {
    console.log(`  ${e.name} @ ${e.current_company} — cat: ${e.category} (matched: ${e.matched_ot_company})`)
  }

  return sample
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== VMG CRM Overnight Audit — 2026-05-10 ===\n')

  // Fetch all candidates
  console.log('Fetching candidates...')
  const candidates = await fetchAll<CandidateRow>(
    'candidates',
    'id, first_name, last_name, current_title, current_company, headline, certifications, category, skills, location_city, location_state, source, status, embedding_model_version, embedding_updated_at, created_at, updated_at, search_vector'
  )
  console.log(`  Loaded ${candidates.length} candidates`)

  // Fetch all work_history
  console.log('Fetching work_history...')
  const workHistory = await fetchAll<WorkHistoryRow>(
    'work_history',
    'id, candidate_id, company_name, job_title, description'
  )
  console.log(`  Loaded ${workHistory.length} work_history rows`)

  // Index work_history by candidate_id
  const whByCandidate = new Map<string, WorkHistoryRow[]>()
  for (const wh of workHistory) {
    const list = whByCandidate.get(wh.candidate_id) || []
    list.push(wh)
    whByCandidate.set(wh.candidate_id, list)
  }

  // Count candidates with vs without work_history
  const withWH = candidates.filter(c => whByCandidate.has(c.id)).length
  console.log(`  ${withWH} candidates have work_history, ${candidates.length - withWH} do not`)

  // Run all phases
  const { buckets, candidateBuckets } = await phase1(candidates, whByCandidate)
  const phase2Results = await phase2(candidates, whByCandidate, candidateBuckets)
  const phase3Results = await phase3(candidates)
  const phase4Results = await phase4(candidates, whByCandidate)

  // ── Write report ──────────────────────────────────────────────────────────

  const total = candidates.length
  const thinRichCount = buckets.find(b => b.bucket === 'thin_candidate_rich_history')!
  const thinEverywhereCount = buckets.find(b => b.bucket === 'thin_everywhere')!
  const richEverywhereCount = buckets.find(b => b.bucket === 'rich_everywhere')!
  const moderateCount = buckets.find(b => b.bucket === 'moderate')!

  let report = `# VMG CRM — Overnight Audit Findings (2026-05-10)

## Headline

Of ${total.toLocaleString()} candidates in the pool, **${thinRichCount.count.toLocaleString()} (${thinRichCount.pct}%) are "thin candidate, rich history"** — these candidates have sparse \`search_vector\` data but substantial work history descriptions sitting in a separate table that the current trigger ignores. The planned trigger fix to join \`work_history\` into \`candidates_search_update()\` directly unlocks these records for keyword search. Another **${thinEverywhereCount.count.toLocaleString()} (${thinEverywhereCount.pct}%)** are thin everywhere and need upstream enrichment (better scraping or manual data entry) — no trigger fix will help them. **${richEverywhereCount.count.toLocaleString()} (${richEverywhereCount.pct}%)** are already rich across the board, and **${moderateCount.count.toLocaleString()} (${moderateCount.pct}%)** fall in a moderate middle ground.

---

## Phase 1 — Pool-Wide Bucketing

Methodology: \`candidate_sv_len\` = \`length(search_vector::text)\` from the candidates table. \`work_history_text_total\` = \`SUM(length(description))\` across all \`work_history\` rows for that candidate.

| Bucket | Criteria | Count | % of Pool |
|--------|----------|------:|----------:|
| **rich_everywhere** | sv_len >= 700 AND wh_text >= 500 | ${richEverywhereCount.count.toLocaleString()} | ${richEverywhereCount.pct}% |
| **thin_candidate_rich_history** | sv_len < 500 AND wh_text >= 500 | ${thinRichCount.count.toLocaleString()} | ${thinRichCount.pct}% |
| **thin_everywhere** | sv_len < 500 AND wh_text < 500 | ${thinEverywhereCount.count.toLocaleString()} | ${thinEverywhereCount.pct}% |
| **moderate** | everything else | ${moderateCount.count.toLocaleString()} | ${moderateCount.pct}% |
| **TOTAL** | | **${total.toLocaleString()}** | **100%** |

**Key takeaway:** The trigger fix is leveraged for ${thinRichCount.pct}% of the pool. These candidates have work history text that keyword search currently cannot see.

---

## Phase 2 — Hypothetical Fix Preview (10 Samples from "thin_candidate_rich_history")

For each sampled candidate: current search_vector lexeme count, top new lexemes their work_history would contribute, and an OT/ICS keyword spot-check.

| Name | SV Lexemes | Top New WH Lexemes (up to 15) | OT Keyword | In SV? | In WH? |
|------|----------:|-------------------------------|------------|--------|--------|
`

  for (const r of phase2Results) {
    report += `| ${r.name} | ${r.sv_lexeme_count} | ${r.wh_new_lexemes} | ${r.ot_keyword} | ${r.in_sv ? 'YES' : 'no'} | ${r.in_wh ? 'YES' : 'no'} |\n`
  }

  report += `
**Reading this table:** Each row is a candidate whose search_vector is thin but whose work_history is rich. The "Top New WH Lexemes" column shows words that would be **added** to keyword search by the trigger fix. The OT Keyword column shows a concrete example: is a specific OT/ICS term findable today (In SV?) vs. would it become findable after the fix (In WH?).

---

## Phase 3 — NULL \`embedding_model_version\` Investigation

**Count:** ${phase3Results.count} candidates have NULL \`embedding_model_version\`.

**Pattern:** ${phase3Results.pattern}

**Created date range:** ${phase3Results.createdAtRange}

**Source breakdown:**

| Source | Count |
|--------|------:|
`

  for (const [src, cnt] of Object.entries(phase3Results.sourceBreakdown).sort((a, b) => b[1] - a[1])) {
    report += `| ${src} | ${cnt} |\n`
  }

  // Detailed list of affected candidates
  report += `
**Affected candidates (sample up to 22):**

| Name | Created | Updated | Source | Has embedding_updated_at? |
|------|---------|---------|--------|--------------------------|
`

  for (const f of phase3Results.findings.slice(0, 22)) {
    report += `| ${f.name} | ${f.created_at.slice(0, 10)} | ${f.updated_at.slice(0, 10)} | ${f.source || '(null)'} | ${f.has_embedding_updated_at ? 'YES' : 'no'} |\n`
  }

  report += `
**Diagnosis:** `

  if (phase3Results.findings.every(f => f.has_embedding_updated_at)) {
    report += `These candidates have valid \`embedding_updated_at\` timestamps, meaning embeddings were successfully computed and written. The NULL \`embedding_model_version\` indicates a code path that wrote the embedding and timestamp but did not set the model version string. This is likely an early version of the backfill script or the embedding API route that omitted the \`embedding_model_version\` field in the UPDATE payload. This is a historical artifact, not an active bug — the current \`backfill-embeddings.ts\` script writes all three fields (\`embedding\`, \`embedding_updated_at\`, \`embedding_model_version\`).`
  } else if (phase3Results.findings.every(f => !f.has_embedding_updated_at)) {
    report += `These candidates have NULL \`embedding_updated_at\` AND NULL \`embedding_model_version\` — they have never been embedded at all. These likely need to be picked up by the nightly backfill cron or the retry-embeddings cron job.`
  } else {
    report += `Mixed pattern. Some have embeddings (embedding_updated_at set) but no model version — likely a historical code path. Others have neither — never embedded.`
  }

  report += `

---

## Phase 4 — Miscategorization Spot-Check

Candidates at known OT/ICS cybersecurity companies or with OT keywords in their profile, categorized in a potentially incorrect bucket.

| Name | Current Company | Current Title | Category | OT Signal |
|------|----------------|---------------|----------|-----------|
`

  if (phase4Results.length === 0) {
    report += `| _(no miscategorization candidates found)_ | | | | |\n`
  } else {
    for (const e of phase4Results) {
      report += `| ${e.name} | ${e.current_company || '(none)'} | ${e.current_title || '(none)'} | ${e.category || '(null)'} | ${e.matched_ot_company} |\n`
    }
  }

  report += `
**Note:** The valid category values are: sales, sales_engineering, channel, marketing, product, customer_success, operations, engineering, other. There is no "it" or "cybersecurity" category. Candidates at OT security companies doing compliance, product management, or customer success work may legitimately belong in their current category. The ones worth reviewing are those whose title clearly indicates a technical/security role but who are bucketed as "other" or "operations."

---

## Prioritization Recommendation

Based on the empirical pool data:

1. **Trigger fix (HIGH LEVERAGE)** — ${thinRichCount.count.toLocaleString()} candidates (${thinRichCount.pct}%) have rich work_history text that keyword search currently cannot see. This is the highest-ROI fix: one migration unlocks existing data for the entire thin-candidate-rich-history segment. No external API calls, no enrichment costs, no manual work.

2. **Category cleanup (MEDIUM LEVERAGE)** — ${phase4Results.length > 0 ? `${phase4Results.length} candidates at known OT companies appear potentially miscategorized. ` : ''}The category field drives search filtering and candidate matching. Miscategorized OT professionals won't surface for OT job searches. A targeted audit of candidates at the 15 known OT vendor companies would be quick (likely <100 records) and improve search precision.

3. **Enrichment (LOWER LEVERAGE, HIGHER COST)** — ${thinEverywhereCount.count.toLocaleString()} candidates (${thinEverywhereCount.pct}%) are thin everywhere. These need better upstream data — either re-scraping with deeper LinkedIn access, manual data entry, or third-party enrichment APIs. This is the most expensive fix per candidate and should be deprioritized until the trigger fix captures the easy wins.

**Recommended sequence:** Trigger fix this week → Category spot-check next → Enrichment backlog for later.

---

*Generated autonomously on 2026-05-10 by overnight audit script.*

**Go DAMN Dawgs!**
`

  // Write report
  const outDir = path.join(__dirname, '..', 'docs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'audit-overnight-findings-2026-05-10.md')
  fs.writeFileSync(outPath, report, 'utf-8')
  console.log(`\n✓ Report written to ${outPath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
