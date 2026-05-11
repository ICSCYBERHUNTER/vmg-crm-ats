/**
 * Audit category drift for future-category candidates.
 *
 * Loads future-category-candidates.json, queries Supabase, and classifies
 * each record as: missing, already_applied, reclassify_applied, safe, or drifted.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-category-drift.ts
 *
 * Read-only. No writes to Supabase.
 */

import { createServiceClient } from '../src/lib/supabase/service'
import * as fs from 'fs'
import * as path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JsonCandidate {
  candidate_id: string
  candidate_name: string
  current: {
    category: string | null
    seniority_level: string | null
    manages_people: boolean | null
  }
  proposed: {
    category: string
    ideal_category?: string
    seniority_level: string
    manages_people: boolean | null
    confidence: 'high' | 'medium' | 'low'
    reasoning: string
    role_tags?: string[]
    gtm_tags?: string[]
  }
  has_changes: boolean
  status: string
}

interface DbRow {
  id: string
  first_name: string
  last_name: string
  category: string | null
  seniority_level: string | null
  manages_people: boolean | null
}

type Bucket = 'missing' | 'already_applied' | 'reclassify_applied' | 'safe' | 'drifted'

interface ClassifiedRecord {
  bucket: Bucket
  json: JsonCandidate
  db: DbRow | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

// future categories we want to inspect — includes compound form used in JSON
const FUTURE_CATEGORIES = new Set(['hr', 'finance', 'it', 'accounting', 'finance_accounting'])

const BATCH_SIZE = 100

// ── Helpers ───────────────────────────────────────────────────────────────────

function fieldsMatch(
  a: { category: string | null; seniority_level: string | null; manages_people: boolean | null },
  b: { category: string | null; seniority_level: string | null; manages_people: boolean | null }
): boolean {
  return (
    a.category === b.category &&
    a.seniority_level === b.seniority_level &&
    a.manages_people === b.manages_people
  )
}

async function fetchInBatches(ids: string[]): Promise<DbRow[]> {
  const supabase = createServiceClient()
  const rows: DbRow[] = []

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, category, seniority_level, manages_people')
      .in('id', batch)

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`)
    }

    rows.push(...(data as DbRow[]))
  }

  return rows
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load JSON
  const jsonPath = path.join(__dirname, 'output', 'review', 'future-category-candidates.json')
  const raw: JsonCandidate[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  // 2. Filter: future category + (high|medium) confidence + has_changes + success
  const filtered = raw.filter(
    (r) =>
      r.status === 'success' &&
      r.has_changes === true &&
      (r.proposed.confidence === 'high' || r.proposed.confidence === 'medium') &&
      r.proposed.ideal_category !== undefined &&
      FUTURE_CATEGORIES.has(r.proposed.ideal_category!)
  )

  console.log(`Inspecting ${filtered.length} records (high + medium confidence, future categories)`)

  // 3. Query Supabase
  const ids = filtered.map((r) => r.candidate_id)
  const dbRows = await fetchInBatches(ids)
  const dbMap = new Map<string, DbRow>(dbRows.map((row) => [row.id, row]))

  // 4. Classify each record (priority order: missing → already_applied → reclassify_applied → safe → drifted)
  const classified: ClassifiedRecord[] = filtered.map((json) => {
    const db = dbMap.get(json.candidate_id) ?? null

    if (!db) {
      return { bucket: 'missing', json, db: null }
    }

    // already_applied: DB matches proposed using ideal_category for the category field
    const alreadyAppliedMatch = fieldsMatch(db, {
      category: json.proposed.ideal_category ?? json.proposed.category,
      seniority_level: json.proposed.seniority_level,
      manages_people: json.proposed.manages_people,
    })
    if (alreadyAppliedMatch) {
      return { bucket: 'already_applied', json, db }
    }

    // reclassify_applied: DB matches proposed seniority + manages, but category is the placeholder (e.g. "other")
    // The original reclassify script wrote seniority/manages but couldn't write the new category values.
    const reclassifyAppliedMatch = fieldsMatch(db, {
      category: json.proposed.category,
      seniority_level: json.proposed.seniority_level,
      manages_people: json.proposed.manages_people,
    })
    if (reclassifyAppliedMatch) {
      return { bucket: 'reclassify_applied', json, db }
    }

    // safe: DB still matches JSON.current — no changes have been applied yet
    const currentMatch = fieldsMatch(db, {
      category: json.current.category,
      seniority_level: json.current.seniority_level,
      manages_people: json.current.manages_people,
    })
    if (currentMatch) {
      return { bucket: 'safe', json, db }
    }

    return { bucket: 'drifted', json, db }
  })

  const alreadyApplied = classified.filter((r) => r.bucket === 'already_applied')
  const reclassifyApplied = classified.filter((r) => r.bucket === 'reclassify_applied')
  const safe = classified.filter((r) => r.bucket === 'safe')
  const drifted = classified.filter((r) => r.bucket === 'drifted')
  const missing = classified.filter((r) => r.bucket === 'missing')

  // 5. Print summary
  console.log('')
  console.log('=== Category Drift Audit ===')
  console.log(`Inspected: ${filtered.length}`)
  console.log(`Already applied (full): ${alreadyApplied.length}`)
  console.log(`Reclassify applied (category-only update needed): ${reclassifyApplied.length}`)
  console.log(`Safe to update: ${safe.length}`)
  console.log(`Truly drifted: ${drifted.length}`)
  console.log(`Missing from DB: ${missing.length}`)

  if (drifted.length > 0) {
    console.log('')
    console.log('--- Truly drifted rows (need manual review) ---')
    for (const { json, db } of drifted) {
      const idealCat = json.proposed.ideal_category ?? json.proposed.category
      console.log(
        `${json.candidate_id} | ${json.candidate_name} | ` +
          `DB: cat=${db!.category} seniority=${db!.seniority_level} manages=${db!.manages_people} | ` +
          `Current: cat=${json.current.category} seniority=${json.current.seniority_level} manages=${json.current.manages_people} | ` +
          `Proposed: cat=${idealCat} seniority=${json.proposed.seniority_level} manages=${json.proposed.manages_people}`
      )
    }
  }

  if (alreadyApplied.length > 0) {
    console.log('')
    console.log('--- Already applied (full) rows ---')
    for (const { json } of alreadyApplied) {
      console.log(`${json.candidate_id} | ${json.candidate_name}`)
    }
  }

  if (missing.length > 0) {
    console.log('')
    console.log('--- Missing rows ---')
    for (const { json } of missing) {
      console.log(`${json.candidate_id} | ${json.candidate_name}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
