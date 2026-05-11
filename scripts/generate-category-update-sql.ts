/**
 * Generate a bulk-update SQL file for future-category candidates.
 *
 * Loads future-category-candidates.json, runs the same 5-bucket classification
 * as audit-category-drift.ts, and emits a SQL file with UPDATE statements for
 * rows that need updating (reclassify_applied, drifted, safe buckets).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-category-update-sql.ts
 *
 * Read-only against Supabase. No SQL is executed — only a file is written.
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

function mapCategory(idealCategory: string): string {
  switch (idealCategory) {
    case 'hr':
      return 'hr'
    case 'it':
      return 'it'
    case 'finance':
      return 'finance_accounting'
    case 'accounting':
      return 'finance_accounting'
    case 'finance_accounting':
      return 'finance_accounting'
    default:
      throw new Error(
        `Unexpected ideal_category value: '${idealCategory}'. Schema only allows: hr, it, finance_accounting.`
      )
  }
}

function sqlStr(value: string): string {
  // Escape single quotes by doubling them
  return `'${value.replace(/'/g, "''")}'`
}

function sqlBool(value: boolean | null): string {
  if (value === null) return 'NULL'
  return value ? 'true' : 'false'
}

function formatIdList(ids: string[]): string {
  return ids.map((id) => `'${id}'`).join(', ')
}

function formatIdArray(ids: string[]): string {
  return ids.map((id) => `'${id}'`).join(', ')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load JSON
  const jsonPath = path.join(__dirname, 'output', 'review', 'future-category-candidates.json')
  const raw: JsonCandidate[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  // 2. Filter: same logic as audit-category-drift.ts
  const filtered = raw.filter(
    (r) =>
      r.status === 'success' &&
      r.has_changes === true &&
      (r.proposed.confidence === 'high' || r.proposed.confidence === 'medium') &&
      r.proposed.ideal_category !== undefined &&
      FUTURE_CATEGORIES.has(r.proposed.ideal_category!)
  )

  // 3. Query Supabase
  const ids = filtered.map((r) => r.candidate_id)
  const dbRows = await fetchInBatches(ids)
  const dbMap = new Map<string, DbRow>(dbRows.map((row) => [row.id, row]))

  // 4. Classify — VERBATIM from audit-category-drift.ts
  const classified: ClassifiedRecord[] = filtered.map((json) => {
    const db = dbMap.get(json.candidate_id) ?? null

    if (!db) {
      return { bucket: 'missing', json, db: null }
    }

    const alreadyAppliedMatch = fieldsMatch(db, {
      category: json.proposed.ideal_category ?? json.proposed.category,
      seniority_level: json.proposed.seniority_level,
      manages_people: json.proposed.manages_people,
    })
    if (alreadyAppliedMatch) {
      return { bucket: 'already_applied', json, db }
    }

    const reclassifyAppliedMatch = fieldsMatch(db, {
      category: json.proposed.category,
      seniority_level: json.proposed.seniority_level,
      manages_people: json.proposed.manages_people,
    })
    if (reclassifyAppliedMatch) {
      return { bucket: 'reclassify_applied', json, db }
    }

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

  // 5. Build row sets
  const rowsCategoryOnly = classified.filter(
    (r) => r.bucket === 'reclassify_applied' || r.bucket === 'drifted'
  )
  const rowsFullUpdate = classified.filter((r) => r.bucket === 'safe')
  const missing = classified.filter((r) => r.bucket === 'missing')
  const alreadyApplied = classified.filter((r) => r.bucket === 'already_applied')

  const n1 = rowsCategoryOnly.length
  const n2 = rowsFullUpdate.length
  const total = n1 + n2

  // 6. Map ideal_category for all rows that need updating (throws on unknown value)
  for (const r of [...rowsCategoryOnly, ...rowsFullUpdate]) {
    mapCategory(r.json.proposed.ideal_category!)
  }

  // 7. Build SQL
  const timestamp = new Date().toISOString()

  const categoryOnlyIds = rowsCategoryOnly.map((r) => r.json.candidate_id)
  const safeIds = rowsFullUpdate.map((r) => r.json.candidate_id)
  const allUpdatedIds = [...categoryOnlyIds, ...safeIds]

  const lines: string[] = []

  // Header
  lines.push(`-- ============================================================`)
  lines.push(`-- VMG Category Bulk Update`)
  lines.push(`-- Generated: ${timestamp}`)
  lines.push(`-- Source: scripts/output/review/future-category-candidates.json`)
  lines.push(`--`)
  lines.push(`-- Expected counts:`)
  lines.push(`--   Category-only updates: ${n1} rows`)
  lines.push(`--   Full updates:          ${n2} rows`)
  lines.push(`--   Total:                 ${total} rows`)
  lines.push(`--`)
  lines.push(`-- WORKFLOW: Run each statement one at a time in Supabase SQL Editor.`)
  lines.push(`-- Verify the row counts after each UPDATE matches expected.`)
  lines.push(`-- ============================================================`)
  lines.push(``)

  // Step 1: Pre-flight
  lines.push(`-- ─── Step 1: Pre-flight verification ───────────────────────`)
  lines.push(`-- Confirm the rows we expect to update exist with the expected current state.`)
  lines.push(``)

  if (categoryOnlyIds.length > 0) {
    lines.push(`SELECT COUNT(*) AS rows_with_placeholder_category`)
    lines.push(`FROM candidates`)
    lines.push(`WHERE id IN (${formatIdList(categoryOnlyIds)});`)
    lines.push(`-- Expected: ${n1}`)
  } else {
    lines.push(`-- (No category-only rows to verify)`)
  }
  lines.push(``)

  if (safeIds.length > 0) {
    lines.push(`SELECT COUNT(*) AS rows_in_safe_bucket`)
    lines.push(`FROM candidates`)
    lines.push(`WHERE id IN (${formatIdList(safeIds)});`)
    lines.push(`-- Expected: ${n2}`)
  } else {
    lines.push(`-- (No safe-bucket rows to verify)`)
  }
  lines.push(``)

  // Step 2: Category-only UPDATE
  lines.push(`-- ─── Step 2: Category-only UPDATE (reclassify_applied + drifted) ───`)
  lines.push(`-- ${n1} rows. Sets category and nulls embedding_updated_at.`)
  lines.push(`-- Leaves seniority_level and manages_people unchanged.`)
  lines.push(``)

  if (rowsCategoryOnly.length > 0) {
    lines.push(`UPDATE candidates AS c`)
    lines.push(`SET`)
    lines.push(`  category = v.new_category,`)
    lines.push(`  embedding_updated_at = NULL`)
    lines.push(`FROM (VALUES`)

    for (let i = 0; i < rowsCategoryOnly.length; i++) {
      const r = rowsCategoryOnly[i]
      const newCategory = mapCategory(r.json.proposed.ideal_category!)
      const isLast = i === rowsCategoryOnly.length - 1
      const comma = isLast ? '' : ','
      lines.push(
        `  ('${r.json.candidate_id}'::uuid, ${sqlStr(newCategory)})${comma}  -- ${r.json.candidate_name}`
      )
    }

    lines.push(`) AS v(id, new_category)`)
    lines.push(`WHERE c.id = v.id;`)
    lines.push(`-- Expected affected rows: ${n1}`)
  } else {
    lines.push(`-- (No category-only rows to update)`)
  }
  lines.push(``)

  // Step 3: Full UPDATE
  lines.push(`-- ─── Step 3: Full UPDATE (safe bucket) ─────────────────────`)
  lines.push(`-- ${n2} rows. Sets all three fields and nulls embedding_updated_at.`)
  lines.push(``)

  if (rowsFullUpdate.length > 0) {
    lines.push(`UPDATE candidates AS c`)
    lines.push(`SET`)
    lines.push(`  category = v.new_category,`)
    lines.push(`  seniority_level = v.new_seniority,`)
    lines.push(`  manages_people = v.new_manages,`)
    lines.push(`  embedding_updated_at = NULL`)
    lines.push(`FROM (VALUES`)

    for (let i = 0; i < rowsFullUpdate.length; i++) {
      const r = rowsFullUpdate[i]
      const newCategory = mapCategory(r.json.proposed.ideal_category!)
      const newSeniority = r.json.proposed.seniority_level
      const newManages = r.json.proposed.manages_people
      const isLast = i === rowsFullUpdate.length - 1
      const comma = isLast ? '' : ','
      lines.push(
        `  ('${r.json.candidate_id}'::uuid, ${sqlStr(newCategory)}, ${sqlStr(newSeniority)}, ${sqlBool(newManages)}::boolean)${comma}  -- ${r.json.candidate_name}`
      )
    }

    lines.push(`) AS v(id, new_category, new_seniority, new_manages)`)
    lines.push(`WHERE c.id = v.id;`)
    lines.push(`-- Expected affected rows: ${n2}`)
  } else {
    lines.push(`-- (No full-update rows)`)
  }
  lines.push(``)

  // Step 4: Post-update verification
  lines.push(`-- ─── Step 4: Post-update verification ──────────────────────`)
  lines.push(`-- Confirm no candidates landed on disallowed categories.`)
  lines.push(``)

  if (allUpdatedIds.length > 0) {
    lines.push(`SELECT category, COUNT(*) AS row_count`)
    lines.push(`FROM candidates`)
    lines.push(`WHERE id = ANY(ARRAY[${formatIdArray(allUpdatedIds)}]::uuid[])`)
    lines.push(`GROUP BY category`)
    lines.push(`ORDER BY category;`)
    lines.push(`-- Expected: rows distributed across hr, finance_accounting, it (no 'other', no nulls).`)
  } else {
    lines.push(`-- (No rows were updated — nothing to verify)`)
  }
  lines.push(``)

  // 8. Write file
  const outPath = path.join(__dirname, 'output', 'review', 'bulk-update-categories.sql')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8')

  // 9. Console summary
  console.log(`=== SQL Generation Complete ===`)
  console.log(`Category-only update rows: ${n1}`)
  console.log(`Full update rows:          ${n2}`)
  console.log(`Total rows:                ${total}`)
  console.log(`Skipped (missing):         ${missing.length}`)
  console.log(`Skipped (already_applied): ${alreadyApplied.length}`)
  console.log(`File written: scripts/output/review/bulk-update-categories.sql`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
