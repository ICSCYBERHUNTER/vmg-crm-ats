/**
 * Backfill Voyage AI embeddings for all existing records in the database.
 * Processes only records where embedding_updated_at IS NULL (resumable).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-embeddings.ts --entity=all
 *   npx tsx --env-file=.env.local scripts/backfill-embeddings.ts --entity=candidates
 *
 * Or via the npm script:
 *   npm run backfill:embeddings -- --entity=all
 */

import { createServiceClient } from '../src/lib/supabase/service'
import {
  formatCandidate,
  formatCompany,
  formatCompanyContact,
  formatJobOpening,
  formatNote,
} from '../src/lib/voyage/format'
import { embedText } from '../src/lib/voyage/embed'
import { withRetry } from '../src/lib/voyage/retry'
import type { WorkHistory } from '../src/types/database'
import cliProgress from 'cli-progress'

// ── Types ────────────────────────────────────────────────────────────────────

type EntityArg = 'candidates' | 'companies' | 'contacts' | 'jobs' | 'notes' | 'all'

interface EntityResult {
  entity: string
  total: number
  succeeded: number
  failed: number
  failedIds: string[]
}

// ── Parse CLI args ───────────────────────────────────────────────────────────

function parseEntityArg(): EntityArg {
  const entityFlag = process.argv.find((arg) => arg.startsWith('--entity='))
  if (!entityFlag) {
    console.error('Usage: backfill-embeddings.ts --entity=candidates|companies|contacts|jobs|notes|all')
    process.exit(1)
  }
  const value = entityFlag.split('=')[1] as EntityArg
  const valid: EntityArg[] = ['candidates', 'companies', 'contacts', 'jobs', 'notes', 'all']
  if (!valid.includes(value)) {
    console.error(`Invalid entity: "${value}". Must be one of: ${valid.join(', ')}`)
    process.exit(1)
  }
  return value
}

// ── Env validation ───────────────────────────────────────────────────────────

function validateEnv() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VOYAGE_API_KEY']
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing ${key} in environment. Make sure .env.local is loaded.`)
      process.exit(1)
    }
  }
}

// ── Batch helper ─────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ── Delay helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── DB update helper ─────────────────────────────────────────────────────────

async function updateEmbedding(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
  id: string,
  vector: number[],
  modelVersion: string
) {
  const { error } = await supabase
    .from(table)
    .update({
      embedding: JSON.stringify(vector),
      embedding_updated_at: new Date().toISOString(),
      embedding_model_version: modelVersion,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`DB update failed for ${table}/${id}: ${error.message}`)
  }
}

// ── Entity processors ────────────────────────────────────────────────────────

async function processCandidates(supabase: ReturnType<typeof createServiceClient>): Promise<EntityResult> {
  const result: EntityResult = { entity: 'candidates', total: 0, succeeded: 0, failed: 0, failedIds: [] }

  // Fetch candidates in fixed-size pages without offset pagination.
  // Each iteration always queries the first N rows where embedding_updated_at IS NULL.
  // As records are embedded and updated, they leave the stale set, so the next query
  // naturally returns the next batch of unprocessed rows. This avoids the offset-skipping
  // bug where increasing offsets over a shrinking filtered set skip records.
  // Work history is fetched per-page using .in() so we never scan the full table globally.
  const fetchPageSize = 200

  // Count total stale candidates upfront for the progress bar only
  const { count, error: countError } = await supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true })
    .is('embedding_updated_at', null)

  if (countError) {
    console.error('Failed to count candidates:', countError.message)
    return result
  }

  result.total = count ?? 0
  if (result.total === 0) {
    console.log('No candidates need embedding.')
    return result
  }

  const bar = createProgressBar('candidates')
  bar.start(result.total, 0, { failed: 0 })

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Always fetch from offset 0 — processed records leave the IS NULL set,
    // so this always returns the next unprocessed batch.
    const { data: candidates, error: candError } = await supabase
      .from('candidates')
      .select('*')
      .is('embedding_updated_at', null)
      .order('id')
      .limit(fetchPageSize)

    if (candError) {
      console.error('Failed to fetch candidates:', candError.message)
      bar.stop()
      return result
    }

    if (!candidates || candidates.length === 0) break

    // Fetch work history only for the candidate IDs in this page
    const pageIds = candidates.map((c) => c.id)
    const { data: pageWorkHistory, error: whError } = await supabase
      .from('work_history')
      .select('*')
      .in('candidate_id', pageIds)
      .order('sort_order', { ascending: true })

    if (whError) {
      console.error('Failed to fetch work_history for page:', whError.message)
      bar.stop()
      return result
    }

    const workHistoryMap = new Map<string, WorkHistory[]>()
    for (const row of (pageWorkHistory ?? []) as WorkHistory[]) {
      const existing = workHistoryMap.get(row.candidate_id) ?? []
      existing.push(row)
      workHistoryMap.set(row.candidate_id, existing)
    }

    // Process this page in concurrent chunks of 5
    const concurrentChunks = chunk(candidates, 5)
    for (const concurrent of concurrentChunks) {
      const results = await Promise.allSettled(
        concurrent.map(async (candidate) => {
          const wh = workHistoryMap.get(candidate.id) ?? []
          const formatted = formatCandidate(candidate, wh)
          const embedResult = await withRetry(() => embedText(formatted))
          await updateEmbedding(supabase, 'candidates', candidate.id, embedResult.vector, embedResult.modelVersion)
          await sleep(100)
          return candidate.id
        })
      )

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          result.succeeded++
        } else {
          result.failed++
          result.failedIds.push(concurrent[i].id)
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error(`\nFailed candidate ${concurrent[i].id}: ${reason}`)
        }
        bar.update(result.succeeded + result.failed, { failed: result.failed })
      }
    }

    await sleep(500)
  }

  bar.stop()
  return result
}

async function processCompanies(supabase: ReturnType<typeof createServiceClient>): Promise<EntityResult> {
  const result: EntityResult = { entity: 'companies', total: 0, succeeded: 0, failed: 0, failedIds: [] }

  // Fetch companies needing embeddings (paginated, may exceed 1000 rows)
  let companies: any[] = []
  let start = 0
  const pageSize = 1000
  let keepFetching = true

  while (keepFetching) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .is('embedding_updated_at', null)
      .range(start, start + pageSize - 1)

    if (error) {
      console.error('Failed to fetch companies:', error.message)
      return result
    }

    if (data) companies.push(...data)
    if (!data || data.length < pageSize) keepFetching = false
    start += pageSize
  }
  if (!companies || companies.length === 0) {
    console.log('No companies need embedding.')
    return result
  }

  result.total = companies.length
  const bar = createProgressBar('companies')
  bar.start(result.total, 0, { failed: 0 })

  const batches = chunk(companies, 50)
  for (const batch of batches) {
    const concurrentChunks = chunk(batch, 5)
    for (const concurrent of concurrentChunks) {
      const results = await Promise.allSettled(
        concurrent.map(async (company) => {
          const formatted = formatCompany(company)
          const embedResult = await withRetry(() => embedText(formatted))
          await updateEmbedding(supabase, 'companies', company.id, embedResult.vector, embedResult.modelVersion)
          await sleep(100)
          return company.id
        })
      )

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          result.succeeded++
        } else {
          result.failed++
          result.failedIds.push(concurrent[i].id)
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error(`\nFailed company ${concurrent[i].id}: ${reason}`)
        }
        bar.update(result.succeeded + result.failed, { failed: result.failed })
      }
    }
    await sleep(1000)
  }

  bar.stop()
  return result
}

async function processContacts(supabase: ReturnType<typeof createServiceClient>): Promise<EntityResult> {
  const result: EntityResult = { entity: 'contacts', total: 0, succeeded: 0, failed: 0, failedIds: [] }

  // Fetch contacts needing embeddings (paginated, may exceed 1000 rows)
  let contacts: any[] = []
  let start = 0
  const pageSize = 1000
  let keepFetching = true

  while (keepFetching) {
    const { data, error } = await supabase
      .from('company_contacts')
      .select('*')
      .is('embedding_updated_at', null)
      .range(start, start + pageSize - 1)

    if (error) {
      console.error('Failed to fetch contacts:', error.message)
      return result
    }

    if (data) contacts.push(...data)
    if (!data || data.length < pageSize) keepFetching = false
    start += pageSize
  }
  if (!contacts || contacts.length === 0) {
    console.log('No contacts need embedding.')
    return result
  }

  result.total = contacts.length
  const bar = createProgressBar('contacts')
  bar.start(result.total, 0, { failed: 0 })

  const batches = chunk(contacts, 50)
  for (const batch of batches) {
    const concurrentChunks = chunk(batch, 5)
    for (const concurrent of concurrentChunks) {
      const results = await Promise.allSettled(
        concurrent.map(async (contact) => {
          const formatted = formatCompanyContact(contact)
          const embedResult = await withRetry(() => embedText(formatted))
          await updateEmbedding(supabase, 'company_contacts', contact.id, embedResult.vector, embedResult.modelVersion)
          await sleep(100)
          return contact.id
        })
      )

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          result.succeeded++
        } else {
          result.failed++
          result.failedIds.push(concurrent[i].id)
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error(`\nFailed contact ${concurrent[i].id}: ${reason}`)
        }
        bar.update(result.succeeded + result.failed, { failed: result.failed })
      }
    }
    await sleep(1000)
  }

  bar.stop()
  return result
}

async function processJobs(supabase: ReturnType<typeof createServiceClient>): Promise<EntityResult> {
  const result: EntityResult = { entity: 'jobs', total: 0, succeeded: 0, failed: 0, failedIds: [] }

  // Fetch jobs needing embeddings (paginated, may exceed 1000 rows)
  let jobs: any[] = []
  let start = 0
  const pageSize = 1000
  let keepFetching = true

  while (keepFetching) {
    const { data, error } = await supabase
      .from('job_openings')
      .select('*')
      .is('embedding_updated_at', null)
      .range(start, start + pageSize - 1)

    if (error) {
      console.error('Failed to fetch jobs:', error.message)
      return result
    }

    if (data) jobs.push(...data)
    if (!data || data.length < pageSize) keepFetching = false
    start += pageSize
  }
  if (!jobs || jobs.length === 0) {
    console.log('No jobs need embedding.')
    return result
  }

  result.total = jobs.length
  const bar = createProgressBar('jobs')
  bar.start(result.total, 0, { failed: 0 })

  const batches = chunk(jobs, 50)
  for (const batch of batches) {
    const concurrentChunks = chunk(batch, 5)
    for (const concurrent of concurrentChunks) {
      const results = await Promise.allSettled(
        concurrent.map(async (job) => {
          const formatted = formatJobOpening(job)
          const embedResult = await withRetry(() => embedText(formatted))
          await updateEmbedding(supabase, 'job_openings', job.id, embedResult.vector, embedResult.modelVersion)
          await sleep(100)
          return job.id
        })
      )

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          result.succeeded++
        } else {
          result.failed++
          result.failedIds.push(concurrent[i].id)
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error(`\nFailed job ${concurrent[i].id}: ${reason}`)
        }
        bar.update(result.succeeded + result.failed, { failed: result.failed })
      }
    }
    await sleep(1000)
  }

  bar.stop()
  return result
}

async function processNotes(supabase: ReturnType<typeof createServiceClient>): Promise<EntityResult> {
  const result: EntityResult = { entity: 'notes', total: 0, succeeded: 0, failed: 0, failedIds: [] }

  // Fetch notes needing embeddings (paginated, may exceed 1000 rows)
  let notes: any[] = []
  let start = 0
  const pageSize = 1000
  let keepFetching = true

  while (keepFetching) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .is('embedding_updated_at', null)
      .range(start, start + pageSize - 1)

    if (error) {
      console.error('Failed to fetch notes:', error.message)
      return result
    }

    if (data) notes.push(...data)
    if (!data || data.length < pageSize) keepFetching = false
    start += pageSize
  }
  if (!notes || notes.length === 0) {
    console.log('No notes need embedding.')
    return result
  }

  result.total = notes.length
  const bar = createProgressBar('notes')
  bar.start(result.total, 0, { failed: 0 })

  const batches = chunk(notes, 50)
  for (const batch of batches) {
    const concurrentChunks = chunk(batch, 5)
    for (const concurrent of concurrentChunks) {
      const results = await Promise.allSettled(
        concurrent.map(async (note) => {
          const formatted = formatNote(note)
          const embedResult = await withRetry(() => embedText(formatted))
          await updateEmbedding(supabase, 'notes', note.id, embedResult.vector, embedResult.modelVersion)
          await sleep(100)
          return note.id
        })
      )

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          result.succeeded++
        } else {
          result.failed++
          result.failedIds.push(concurrent[i].id)
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error(`\nFailed note ${concurrent[i].id}: ${reason}`)
        }
        bar.update(result.succeeded + result.failed, { failed: result.failed })
      }
    }
    await sleep(1000)
  }

  bar.stop()
  return result
}

// ── Progress bar factory ─────────────────────────────────────────────────────

function createProgressBar(entity: string) {
  return new cliProgress.SingleBar(
    {
      format: `Embedding ${entity}: [{bar}] {value}/{total} | {failed} failed | ETA: {eta_formatted}`,
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  validateEnv()
  const entity = parseEntityArg()
  const supabase = createServiceClient()

  const entityOrder: Exclude<EntityArg, 'all'>[] = ['jobs', 'companies', 'contacts', 'candidates', 'notes']
  const toProcess = entity === 'all' ? entityOrder : [entity]

  const allResults: EntityResult[] = []

  for (const e of toProcess) {
    console.log(`\n── Processing ${e} ──`)
    let entityResult: EntityResult

    switch (e) {
      case 'candidates':
        entityResult = await processCandidates(supabase)
        break
      case 'companies':
        entityResult = await processCompanies(supabase)
        break
      case 'contacts':
        entityResult = await processContacts(supabase)
        break
      case 'jobs':
        entityResult = await processJobs(supabase)
        break
      case 'notes':
        entityResult = await processNotes(supabase)
        break
    }

    allResults.push(entityResult)
  }

  // Print summary
  console.log('\n══════════════════════════════════════════')
  console.log('  BACKFILL SUMMARY')
  console.log('══════════════════════════════════════════')

  let grandTotal = 0
  let grandSucceeded = 0
  let grandFailed = 0

  for (const r of allResults) {
    grandTotal += r.total
    grandSucceeded += r.succeeded
    grandFailed += r.failed
    console.log(`  ${r.entity}: ${r.succeeded}/${r.total} succeeded, ${r.failed} failed`)
    if (r.failedIds.length > 0) {
      console.log(`    Failed IDs: ${r.failedIds.join(', ')}`)
    }
  }

  console.log('──────────────────────────────────────────')
  console.log(`  TOTAL: ${grandSucceeded}/${grandTotal} succeeded, ${grandFailed} failed`)
  console.log('══════════════════════════════════════════\n')

  if (grandFailed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
