/**
 * Manual test script for the Voyage AI embedding pipeline.
 * Fetches a real candidate, formats it, embeds it, and prints the results.
 * Does NOT write anything to the database.
 *
 * Required env vars (loaded from .env.local via --env-file):
 *   NEXT_PUBLIC_SUPABASE_URL     — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — service role key (bypasses RLS for this read)
 *   VOYAGE_API_KEY               — Voyage AI key
 *
 * Run with:
 *   npm run test:voyage
 */

import { createClient } from '@supabase/supabase-js'
import { formatCandidate } from '../src/lib/voyage/format'
import { embedText } from '../src/lib/voyage/embed'
import type { Candidate, WorkHistory } from '../src/types/database'

// ── Validate env vars ────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}
if (!serviceRoleKey) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY in .env.local\n' +
    'Add it from: Supabase dashboard → Settings → API → service_role key'
  )
  process.exit(1)
}

// VOYAGE_API_KEY is validated at import time by src/lib/voyage/client.ts —
// if it's missing the process will already have exited with a clear message.

// ── Supabase client (service role — bypasses RLS) ────────────────────────────

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching one candidate from Supabase...')

  const { data: candidates, error: candidateError } = await supabase
    .from('candidates')
    .select('*')
    .limit(1)

  if (candidateError) {
    console.error('Supabase error fetching candidate:', candidateError.message)
    process.exit(1)
  }
  if (!candidates || candidates.length === 0) {
    console.error('No candidates found in the database.')
    process.exit(1)
  }

  const candidate = candidates[0] as Candidate
  console.log(`Found candidate: ${candidate.first_name} ${candidate.last_name} (${candidate.id})\n`)

  // Fetch work history for this candidate, oldest first
  const { data: workHistoryRows, error: whError } = await supabase
    .from('work_history')
    .select('*')
    .eq('candidate_id', candidate.id)
    .order('sort_order', { ascending: true })

  if (whError) {
    console.error('Supabase error fetching work_history:', whError.message)
    process.exit(1)
  }
  const workHistory: WorkHistory[] = (workHistoryRows ?? []) as WorkHistory[]
  console.log(`Work history entries: ${workHistory.length}\n`)

  // Format
  console.log('─── Formatted text sent to Voyage ───────────────────────────')
  const formatted = formatCandidate(candidate, workHistory)
  console.log(formatted)
  console.log('─────────────────────────────────────────────────────────────\n')

  // Embed
  console.log('Calling Voyage AI...')
  const result = await embedText(formatted)

  // Results
  console.log('\n── Embedding results ────────────────────────────────────────')
  console.log(`Model:       ${result.modelVersion}`)
  console.log(`Vector length: ${result.vector.length} (expected 1024)`)
  console.log(`Token count: ${result.tokenCount ?? 'not reported'}`)
  console.log(`First 5 values: [${result.vector.slice(0, 5).map((v) => v.toFixed(6)).join(', ')}]`)
  console.log('─────────────────────────────────────────────────────────────')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
