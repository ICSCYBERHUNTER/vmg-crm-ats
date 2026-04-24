// Required env var: CRON_SECRET
// Generate with: openssl rand -hex 32
// Add to Vercel env vars (Production + Preview) — NOT needed locally
// unless you want to test the endpoint by curling localhost.

import { createServiceClient } from '@/lib/supabase/service'
import { embedText } from '@/lib/voyage/embed'
import {
  formatCandidate,
  formatCompany,
  formatCompanyContact,
  formatJobOpening,
  formatNote,
} from '@/lib/voyage/format'
import type {
  Candidate,
  Company,
  CompanyContact,
  JobOpening,
  Note,
  WorkHistory,
} from '@/types/database'

export const maxDuration = 10
export const dynamic = 'force-dynamic'

interface TableResult {
  attempted: number
  succeeded: number
  failed: number
}

function makeResult(): TableResult {
  return { attempted: 0, succeeded: 0, failed: 0 }
}

/**
 * Runs `fn` on each item in batches of `batchSize` (parallel within a batch,
 * sequential across batches). Keeps concurrency predictable under the 10s limit.
 */
async function processInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn))
  }
}

export async function GET(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // ── Candidates ────────────────────────────────────────────────────────────
  const candidates = makeResult()
  {
    const { data: rows } = await supabase
      .from('candidates')
      .select('*')
      .is('embedding_updated_at', null)
      .limit(100)

    if (rows && rows.length > 0) {
      const ids = (rows as Candidate[]).map((r) => r.id)
      const { data: whRows } = await supabase
        .from('work_history')
        .select('*')
        .in('candidate_id', ids)

      const whMap = new Map<string, WorkHistory[]>()
      for (const wh of (whRows ?? []) as WorkHistory[]) {
        const list = whMap.get(wh.candidate_id) ?? []
        list.push(wh)
        whMap.set(wh.candidate_id, list)
      }

      await processInBatches(rows as Candidate[], 5, async (row) => {
        candidates.attempted++
        try {
          const text = formatCandidate(row, whMap.get(row.id) ?? [])
          const { vector } = await embedText(text)
          const { error } = await supabase
            .from('candidates')
            .update({ embedding: vector, embedding_updated_at: now })
            .eq('id', row.id)
          if (error) throw error
          candidates.succeeded++
        } catch (err) {
          console.error(`[cron/retry-embeddings] candidates ${row.id}:`, err)
          candidates.failed++
        }
      })
    }
  }

  // ── Companies ─────────────────────────────────────────────────────────────
  const companies = makeResult()
  {
    const { data: rows } = await supabase
      .from('companies')
      .select('*')
      .is('embedding_updated_at', null)
      .limit(100)

    if (rows && rows.length > 0) {
      await processInBatches(rows as Company[], 5, async (row) => {
        companies.attempted++
        try {
          const text = formatCompany(row)
          const { vector } = await embedText(text)
          const { error } = await supabase
            .from('companies')
            .update({ embedding: vector, embedding_updated_at: now })
            .eq('id', row.id)
          if (error) throw error
          companies.succeeded++
        } catch (err) {
          console.error(`[cron/retry-embeddings] companies ${row.id}:`, err)
          companies.failed++
        }
      })
    }
  }

  // ── Company Contacts ──────────────────────────────────────────────────────
  const company_contacts = makeResult()
  {
    const { data: rows } = await supabase
      .from('company_contacts')
      .select('*')
      .is('embedding_updated_at', null)
      .limit(100)

    if (rows && rows.length > 0) {
      await processInBatches(rows as CompanyContact[], 5, async (row) => {
        company_contacts.attempted++
        try {
          const text = formatCompanyContact(row)
          const { vector } = await embedText(text)
          const { error } = await supabase
            .from('company_contacts')
            .update({ embedding: vector, embedding_updated_at: now })
            .eq('id', row.id)
          if (error) throw error
          company_contacts.succeeded++
        } catch (err) {
          console.error(`[cron/retry-embeddings] company_contacts ${row.id}:`, err)
          company_contacts.failed++
        }
      })
    }
  }

  // ── Job Openings ──────────────────────────────────────────────────────────
  const job_openings = makeResult()
  {
    const { data: rows } = await supabase
      .from('job_openings')
      .select('*')
      .is('embedding_updated_at', null)
      .limit(100)

    if (rows && rows.length > 0) {
      await processInBatches(rows as JobOpening[], 5, async (row) => {
        job_openings.attempted++
        try {
          const text = formatJobOpening(row)
          const { vector } = await embedText(text)
          const { error } = await supabase
            .from('job_openings')
            .update({ embedding: vector, embedding_updated_at: now })
            .eq('id', row.id)
          if (error) throw error
          job_openings.succeeded++
        } catch (err) {
          console.error(`[cron/retry-embeddings] job_openings ${row.id}:`, err)
          job_openings.failed++
        }
      })
    }
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notes = makeResult()
  {
    const { data: rows } = await supabase
      .from('notes')
      .select('*')
      .is('embedding_updated_at', null)
      .limit(100)

    if (rows && rows.length > 0) {
      await processInBatches(rows as Note[], 5, async (row) => {
        notes.attempted++
        try {
          const text = formatNote(row)
          const { vector } = await embedText(text)
          const { error } = await supabase
            .from('notes')
            .update({ embedding: vector, embedding_updated_at: now })
            .eq('id', row.id)
          if (error) throw error
          notes.succeeded++
        } catch (err) {
          console.error(`[cron/retry-embeddings] notes ${row.id}:`, err)
          notes.failed++
        }
      })
    }
  }

  return Response.json({
    candidates,
    companies,
    company_contacts,
    job_openings,
    notes,
    totalDurationMs: Date.now() - startTime,
  })
}
